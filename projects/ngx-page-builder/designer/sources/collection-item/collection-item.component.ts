import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  Input,
  OnDestroy,
} from '@angular/core';
import { debounceTime, Subscription } from 'rxjs';
import {
  COMPONENT_DATA,
  CollectionController,
  ComponentDataContext,
  DynamicDataService,
  PageItem,
  Repeater,
  bindRowOnce,
  buildRowPlan,
  createScope,
  findScope,
  type RowPlan,
} from 'ngx-page-builder/core';
import { PageBuilderService, type PageItemChange } from '../../services/page-builder.service';
import { CollectionTemplate } from './definition';

/**
 * DESIGNER collection list.
 *
 *  - `pageItem.template` is the ONE editable prototype (shown first, bound to the first record)
 *  - every other record is a read-only clone of it: cloneNode + binding patch, a few microseconds each
 *  - style edits cost nothing (all copies share the template's `blk-` class); structure / content edits re-clone from the prototype
 *    (no data refetch, no block pipeline) after a short debounce
 *  - clicking a copy selects the matching block of the prototype
 */
@Component({
  selector: 'collection-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class CollectionItemComponent implements AfterViewInit, OnDestroy {
  @Input() editMode = true;
  @Input() pageItem!: PageItem;

  private readonly host = inject(ElementRef).nativeElement as HTMLElement;
  private readonly pb = inject(PageBuilderService);
  private readonly dd = inject(DynamicDataService);
  private readonly context = inject<ComponentDataContext>(COMPONENT_DATA, { optional: true });

  private protoEl?: HTMLElement;
  private plan?: RowPlan;
  private repeater?: Repeater;
  private controller?: CollectionController;
  private plain: Element[] = [];
  private subs: Subscription[] = [];
  private offContext?: () => void;
  private lastRow?: Record<string, unknown>;

  async ngAfterViewInit(): Promise<void> {
    const item = this.pageItem;
    if (!item?.template) {
      item.template = new PageItem(CollectionTemplate);
    }
    const tpl = item.template as PageItem;
    tpl.parent = item;
    item.children = [tpl]; // the prototype is a real child: it can be selected, edited, dragged into

    await this.pb.createBlockElement(true, tpl, this.host);
    this.protoEl = tpl.el as HTMLElement;
    this.host.addEventListener('pointerdown', this.onPointerDown, true);

    this.build();
    this.subs.push(
      this.pb.changed$.pipe(debounceTime(60)).subscribe((ev: PageItemChange) => {
        if (ev.item && this.inTemplate(ev.item)) this.rebuild();
      }),
    );
    const settings = (this.context as { onChangeCustomData?: { subscribe(fn: () => void): Subscription } } | null)
      ?.onChangeCustomData;
    if (settings) this.subs.push(settings.subscribe(() => this.rebuild()));
    this.offContext = this.dd.onContextChange(() => void this.controller?.refresh());
    await this.controller?.refresh();
  }

  ngOnDestroy(): void {
    this.host.removeEventListener('pointerdown', this.onPointerDown, true);
    this.subs.forEach((s) => s.unsubscribe());
    this.offContext?.();
    this.controller?.destroy();
    this.repeater?.destroy();
  }

  //---------------------------------------------------------------- build / rebuild

  private build(): void {
    const item = this.pageItem;
    const protoEl = this.protoEl;
    if (!protoEl) return;
    this.repeater?.destroy();
    this.controller?.destroy();
    this.clearPlain();

    this.plan = buildRowPlan(item.template as never, protoEl);
    const connected = !!item.dataSource?.id;
    if (!connected) {
      // nothing to bind yet: show N copies exactly as designed, like a static list
      this.showPlain(Math.max(1, item.dataSource?.maxResultCount ?? 3) - 1);
      return;
    }

    this.repeater = new Repeater({
      container: this.host,
      anchor: protoEl,
      prototype: protoEl,
      plan: this.plan,
      indexOffset: 1,
      getContext: () => this.dd.context,
      parentScope: () => findScope(this.host.parentNode),
      keyField: item.dataSource?.keyField || 'id',
      decorate: (el) => this.freeze(el),
    });
    this.controller = new CollectionController({
      store: this.dd.store,
      getContext: () => this.dd.context,
      getParentScope: () => findScope(this.host.parentNode),
      host: {
        render: (rows) => {
          this.bindPrototype(rows[0], rows.length);
          return this.repeater!.render(rows.slice(1));
        },
      },
    });
    this.controller.bind(item as never);
  }

  private rebuild(): void {
    this.build();
    void this.controller?.refresh({ force: true });
  }

  private bindPrototype(row: Record<string, unknown> | undefined, count: number): void {
    if (!row || !this.plan || !this.protoEl) return;
    this.lastRow = row;
    bindRowOnce(this.protoEl, this.plan, createScope(this.dd.context, row, findScope(this.host.parentNode), 0, count));
  }

  /** copies must not look or behave like editable blocks */
  private freeze(el: Element): void {
    el.setAttribute('data-pb-clone', '');
    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('data-id');
    el.querySelectorAll('[data-id],[contenteditable],[draggable]').forEach((n) => {
      n.removeAttribute('data-id');
      n.removeAttribute('contenteditable');
      n.removeAttribute('draggable');
    });
  }

  private showPlain(n: number): void {
    if (!this.protoEl) return;
    for (let i = 0; i < n; i++) {
      const c = this.protoEl.cloneNode(true) as Element;
      this.freeze(c);
      this.host.appendChild(c);
      this.plain.push(c);
    }
  }

  private clearPlain(): void {
    this.plain.forEach((c) => c.remove());
    this.plain = [];
  }

  //---------------------------------------------------------------- editing helpers

  private inTemplate(changed: PageItem | undefined): boolean {
    for (let n: PageItem | undefined = changed; n; n = n.parent as PageItem | undefined)
      if (n === this.pageItem) return true;
    return false;
  }

  /** a click on a COPY selects the same block inside the prototype */
  private readonly onPointerDown = (ev: PointerEvent): void => {
    const target = ev.target as Node;
    const hit = this.repeater?.rowOf(target);
    if (!hit || !this.protoEl || hit.el === this.protoEl) return;
    const path: number[] = [];
    for (let n: Node | null = target; n && n !== hit.el; n = n.parentNode)
      path.unshift(Array.prototype.indexOf.call(n.parentNode!.childNodes, n));
    let node: Node | undefined = this.protoEl;
    for (const i of path) node = node?.childNodes[i];
    const found = node ? this.findByEl(this.pageItem.template as PageItem, node) : undefined;
    if (found) {
      ev.stopPropagation();
      ev.preventDefault();
      this.pb.activeEl.set(found);
    }
  };

  private findByEl(root: PageItem, el: Node): PageItem | undefined {
    if (root.el === el) return root;
    for (const c of (root.children ?? []) as PageItem[]) {
      const f = this.findByEl(c, el);
      if (f) return f;
    }
    return undefined;
  }
}
