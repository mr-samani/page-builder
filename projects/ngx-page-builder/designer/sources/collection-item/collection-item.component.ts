import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { concatMap, debounceTime, filter, from, map, Subject, Subscription } from 'rxjs';
import { PageBuilderService, PageItemChange } from '../../services/page-builder.service';

import {
  COMPONENT_DATA,
  ComponentDataContext,
  DataSourceSetting,
  DynamicDataService,
  DynamicElementService,
  IPageItem,
  PageItem,
  itemInThisTemplate,
} from 'ngx-page-builder/core';
import { CollectionSyncContext, ReconcileEnv, applyTemplateChange, syncRows } from './collection-reconciler';

/** wait for the user to finish (add / move / type / style bursts) before the other items are updated */
const TEMPLATE_DEBOUNCE_MS = 150;
/** while creating many items the browser gets a chance to paint after this many milliseconds */
const TIME_SLICE_MS = 12;

const TEMPLATE_CHANGES: ReadonlySet<PageItemChange['type']> = new Set([
  'AddBlock',
  'RemoveBlock',
  'MoveBlock',
  'ChangeBlockContent',
  'ChangeBlockProperties',
  'ChangeTagName',
  'ChangeClassName',
]);

type SyncRequest = { kind: 'data'; version: number } | { kind: 'template'; origin: PageItem };

/**
 * Repeats its children (the "template") for every record of a data source.
 *
 * Every repeated item is a real, editable block tree. When the user changes ONE of them (adds / removes / moves a
 * block, edits text, changes attributes or style) the same change is applied to all the others:
 *  1. the changed item becomes the new template (a light data copy, see snapshotTemplate);
 *  2. the other items are compared with the template and ONLY the differences are applied in place (see
 *     reconcileRows): nothing is destroyed and created again;
 *  3. styles live in the stylesheet (one rule per block id, all copies share the id and the class), so a style
 *     change is visible in all items immediately and needs no work at all.
 *
 * All updates run one after the other (queue), never at the same time.
 */
@Component({
  selector: 'collection-item',
  templateUrl: './collection-item.component.html',
  styleUrls: ['./collection-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class CollectionItemComponent implements OnInit, OnDestroy, AfterViewInit {
  // inputs auto filled by create dynamic element
  @Input() editMode: boolean = false;
  @Input() pageItem!: PageItem;
  settingChangeSubscription?: Subscription;
  pagebuiderChangeSubscription?: Subscription;
  private queueSubscription?: Subscription;

  _template: IPageItem = {
    tag: 'article',
    isTemplateContainer: true,
    canHaveChild: true,
    disableMovement: true,
    lockMoveInnerChild: true,
    disableDelete: true,
    classList: [],
    children: [],
    css: {
      base: `
    position: relative;
    flex: auto;
    box-shadow: 0 0px 4px rgba(0, 0, 0, 0.3);
    padding: 10px;
    border-radius: 5px;
    overflow: hidden;
    min-height: 220px;
    min-width: 150px;`,
    },
  };

  /** records shown now (one repeated item per record) */
  dataList: any[] = [];

  private context = inject<ComponentDataContext<DataSourceSetting>>(COMPONENT_DATA);
  protected readonly pb = inject(PageBuilderService);

  private readonly queue$ = new Subject<SyncRequest>();
  private destroyed = false;
  /** the repeated items of an earlier life of this block were removed and the stylesheet of the template written */
  private initialized = false;
  private dataVersion = 0;
  private sliceStart = 0;

  private readonly env: ReconcileEnv = {
    // copies share the id of the template: their style rules exist already (skipStyle)
    createBlock: (item, container, index) =>
      this.pb.createBlockElement(this.editMode, item, container, index, { skipStyle: true }),
    destroyBlock: (item) => this.dynamicElementService.destroy(item),
    patchBlock: (item, next) => this.dynamicElementService.patchBlock(item, next),
    isCancelled: () => this.destroyed,
  };

  constructor(
    private chdRef: ChangeDetectorRef,
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
    private elRef: ElementRef<HTMLElement>,
  ) {
    // all updates (settings, data, template) run one after the other
    this.queueSubscription = this.queue$.pipe(concatMap((request) => from(this.process(request)))).subscribe();

    this.settingChangeSubscription = this.context.onChange.subscribe((data: DataSourceSetting) => {
      if (this.pageItem) {
        this.pageItem.dataSource = data;
      }
      this.getData();
    });

    // the changes are filtered BEFORE the debounce: an unrelated event must not swallow the change of this collection
    this.pagebuiderChangeSubscription = this.pb.changed$
      .pipe(
        map((change) => this.findChangedItem(change)),
        filter((origin): origin is PageItem => !!origin),
        debounceTime(TEMPLATE_DEBOUNCE_MS),
      )
      .subscribe((origin) => this.queue$.next({ kind: 'template', origin }));
  }

  ngOnInit() {
    if (!this.pageItem.template) {
      this.pageItem.template = new PageItem(this._template, this.pageItem);
    } else {
      this.pageItem.template.isTemplateContainer = true;
    }
  }

  ngAfterViewInit(): void {
    this.getData();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.settingChangeSubscription?.unsubscribe();
    this.pagebuiderChangeSubscription?.unsubscribe();
    this.queueSubscription?.unsubscribe();
    this.queue$.complete();
  }

  /** (re)loads the records and brings the repeated items to the new records */
  getData(): void {
    this.queue$.next({ kind: 'data', version: ++this.dataVersion });
  }

  /** the repeated item that contains the changed block, or undefined when the change is not in this collection */
  private findChangedItem(change: PageItemChange): PageItem | undefined {
    if (!this.pageItem || !TEMPLATE_CHANGES.has(change.type)) return undefined;
    const found = itemInThisTemplate(change.item, this.pageItem.children);
    return found.result ? found.root : undefined;
  }

  private async process(request: SyncRequest): Promise<void> {
    if (this.destroyed || !this.pageItem?.template) return;
    try {
      if (request.kind === 'data') {
        // a newer request is already waiting in the queue: this one is outdated
        if (request.version !== this.dataVersion) return;
        await this.reloadRows();
      } else {
        await this.applyTemplateChange(request.origin);
      }
    } catch (error) {
      console.error('collection-item: update failed', error);
    } finally {
      if (!this.destroyed) this.chdRef.detectChanges();
    }
  }

  private async reloadRows(): Promise<void> {
    const source = this.pageItem.dataSource;
    if (!source) {
      this.dataList = [];
    } else {
      // filters / sorts / skip / take are applied by the service; when the list is empty the designer shows sample records
      const result = await this.dynamicDataService.queryCollection(source, { sampleWhenEmpty: true });
      if (this.destroyed) return;
      this.dataList = result.rows;
    }
    await this.syncRows();
  }

  /** the user changed `origin` (one of the repeated items): the others must get the same change */
  private async applyTemplateChange(origin: PageItem): Promise<void> {
    await applyTemplateChange(this.syncContext(), origin);
  }

  private async syncRows(): Promise<void> {
    const owner = this.pageItem;
    const template = owner.template;
    if (!template) return;

    if (!this.initialized) {
      // repeated items of an earlier life of this block (their elements are gone)
      await this.dynamicElementService.destroyBatch(owner.children);
      owner.children.splice(0, owner.children.length);
      // style rules of the template: the copies are rendered without touching the stylesheet
      this.pb.cls.addBlockCss(template, true);
      this.initialized = true;
    }

    this.sliceStart = performance.now();
    await syncRows(this.syncContext());
  }

  private syncContext(): CollectionSyncContext {
    return {
      owner: this.pageItem,
      host: this.elRef.nativeElement,
      records: this.dataList,
      env: this.env,
      yieldToBrowser: () => this.yieldIfBusy(),
    };
  }

  /** a long list is created in slices so the page stays responsive */
  private async yieldIfBusy(): Promise<void> {
    if (performance.now() - this.sliceStart < TIME_SLICE_MS) return;
    await nextMacroTask();
    this.sliceStart = performance.now();
  }
}

function nextMacroTask(): Promise<void> {
  const scheduler = (globalThis as any).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}
