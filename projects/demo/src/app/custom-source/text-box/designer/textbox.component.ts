import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { PageBuilderService } from 'ngx-page-builder/designer';
import {
  COMPONENT_DATA,
  ComponentDataContext,
  DynamicElementService,
  PageItem,
  itemInThisTemplate,
  snapshotTemplate,
} from 'ngx-page-builder/core';
import { createTextboxSettings, TextboxSettings } from '../shared/textbox.model';
import { attachTextboxValidation } from '../shared/textbox-validation';
import {
  applyTextboxAppearance,
  applyTextboxSettingsToTemplate,
  createTextboxTemplate,
  findTextboxRole,
} from '../shared/textbox-template';

@Component({
  selector: 'custom-textbox',
  template: '',
  styleUrls: ['./textbox.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextboxComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() editMode = false;
  @Input() pageItem!: PageItem;

  private host = inject<ElementRef<HTMLElement>>(ElementRef<HTMLElement>).nativeElement;

  private readonly context = inject<ComponentDataContext<TextboxSettings>>(COMPONENT_DATA);
  private readonly pb = inject(PageBuilderService);
  private readonly dynamicElement = inject(DynamicElementService);
  private readonly cdr = inject(ChangeDetectorRef);

  private contextSubscription?: Subscription;
  private builderSubscription?: Subscription;
  private removeValidationListeners?: () => void;
  private renderVersion = 0;
  private destroyed = false;
  private renderQueue: Promise<void> = Promise.resolve();

  private settings: TextboxSettings = createTextboxSettings();

  ngOnInit(): void {
    this.settings = createTextboxSettings(this.pageItem.customComponent?.componentData ?? this.context.data);

    if (!this.pageItem.template) {
      this.pageItem.template = new PageItem(createTextboxTemplate(), this.pageItem);
    }

    this.prepareTemplate(this.pageItem.template);
    this.pageItem.customComponent!.componentData = this.settings;
  }

  ngAfterViewInit(): void {
    this.contextSubscription = this.context.onChange.subscribe((value) => this.onSettingsChanged(value));

    // Do not debounce this stream: a quick move emits RemoveBlock and MoveBlock back-to-back.
    // Capturing the intermediate RemoveBlock is what persists the source template after a block is moved out.
    this.builderSubscription = this.pb.changed$.subscribe((change) => {
      this.captureTemplateIfChanged(change.item, change.parent);
    });

    this.scheduleRender();
  }

  private onSettingsChanged(value: TextboxSettings): void {
    // Preserve any block-level edits made immediately before the user changed a setting.
    this.captureCurrentTemplate();

    this.settings = createTextboxSettings(value);

    if (!this.pageItem.template) {
      this.pageItem.template = new PageItem(createTextboxTemplate(), this.pageItem);
    }

    this.prepareTemplate(this.pageItem.template);
    this.pageItem.customComponent!.componentData = this.settings;
    this.scheduleRender();
  }

  private prepareTemplate(template: PageItem): void {
    template.isTemplateContainer = true;
    template.lockMoveInnerChild = true;
    template.disableMovement = true;
    template.disableDelete = true;
    applyTextboxAppearance(template, this.settings.appearance);
    applyTextboxSettingsToTemplate(template, this.settings, this.pageItem.id);
  }

  private captureTemplateIfChanged(item: PageItem | null, parent?: PageItem[]): void {
    const root = this.pageItem.children?.[0];
    if (!root) return;

    const itemBelongsToTemplate = itemInThisTemplate(item, this.pageItem.children).result;
    const parentBelongsToTemplate = this.containsChildrenList(root, parent);
    if (!itemBelongsToTemplate && !parentBelongsToTemplate) return;

    this.pageItem.template = snapshotTemplate(root);
    this.pageItem.template.parent = this.pageItem;
  }

  private containsChildrenList(root: PageItem, candidate?: PageItem[]): boolean {
    if (!candidate) return false;
    if (root.children === candidate) return true;
    return root.children.some((child) => this.containsChildrenList(child, candidate));
  }

  private captureCurrentTemplate(): void {
    const root = this.pageItem.children?.[0];
    if (!root) return;
    this.pageItem.template = snapshotTemplate(root);
    this.pageItem.template.parent = this.pageItem;
  }

  private scheduleRender(): void {
    const version = ++this.renderVersion;
    if (this.destroyed) return;
    this.renderQueue = this.renderQueue
      .then(async () => {
        if (this.destroyed || version !== this.renderVersion) return;

        this.removeValidationListeners?.();
        this.removeValidationListeners = undefined;

        const oldChildren = this.pageItem.children ?? [];
        if (oldChildren.length) await this.dynamicElement.destroyBatch(oldChildren);
        if (this.destroyed || version !== this.renderVersion) return;

        this.host.replaceChildren();

        if (!this.pageItem.template) {
          this.pageItem.template = new PageItem(createTextboxTemplate(), this.pageItem);
        }
        this.prepareTemplate(this.pageItem.template);

        const internalRoot = new PageItem(this.pageItem.template, this.pageItem);
        internalRoot.isTemplateContainer = true;
        internalRoot.lockMoveInnerChild = true;
        this.pageItem.children = [internalRoot];

        await this.pb.createBlockElement(this.editMode, internalRoot, this.host);
        if (this.destroyed || version !== this.renderVersion) {
          await this.dynamicElement.destroyBatch([internalRoot]);
          return;
        }

        const input = findTextboxRole(internalRoot, 'input')?.el as HTMLInputElement | undefined;
        const error = findTextboxRole(internalRoot, 'error')?.el ?? null;
        this.removeValidationListeners = attachTextboxValidation(input ?? null, error, this.settings, this.editMode);
        this.cdr.markForCheck();
      })
      .catch((error) => console.error('Textbox block render failed.', error));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.renderVersion++;
    this.contextSubscription?.unsubscribe();
    this.builderSubscription?.unsubscribe();
    this.removeValidationListeners?.();
    // The parent DynamicElementService recursively destroys PageItem.children before it destroys this host component.
  }
}
