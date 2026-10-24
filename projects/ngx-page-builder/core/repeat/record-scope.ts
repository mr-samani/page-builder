import type { DataSourceSetting } from '../models/DataSourceSetting';
import type { ApplyOptions } from '../data/item-binding';
import { createScope, type DataScope } from '../data/scope';
import type { PlanItem } from '../data/plan';
import type { DataStore } from '../data/store';
import type { DataContext, DataRow } from '../data/types';
import { CollectionController, type CollectionState } from './collection-controller';
import { buildRowPlan, bindRowOnce, type RenderedItem, type RowPlan } from './row-plan';
import { registerScope, unregisterScope } from './scope-registry';

/**
 * A block with `dataSource.mode === 'single'` (and no custom component) is a RECORD WRAPPER:
 * it does not repeat — its descendants (already rendered by the normal pipeline) are bound to the loaded record.
 * Nested collections inside it find the record through the scope registry.
 *
 * This is what a product details page needs: one wrapper with `params: { slug: '@route.slug' }`.
 */
export class RecordScope {
  private readonly controller: CollectionController;
  private plan?: RowPlan;
  private row?: DataRow;

  constructor(
    private readonly deps: {
      store: DataStore;
      getContext: () => DataContext;
      getParentScope?: () => DataScope | undefined;
      owner: RenderedItem & PlanItem;
      el: Element;
      apply?: ApplyOptions;
      onState?: (state: CollectionState) => void;
    },
  ) {
    this.controller = new CollectionController({
      store: deps.store,
      getContext: deps.getContext,
      getParentScope: deps.getParentScope,
      host: {
        render: (rows) => this.apply(rows[0]),
        onState: (s) => {
          this.markState(s);
          deps.onState?.(s);
        },
      },
    });
    this.controller.bind(deps.owner);
  }

  get state(): CollectionState {
    return this.controller.state;
  }

  refresh(opts?: { force?: boolean }): Promise<void> {
    return this.controller.refresh(opts);
  }

  destroy(): void {
    this.controller.destroy();
    unregisterScope(this.deps.el);
  }

  private apply(row: DataRow | undefined): void {
    this.row = row;
    const scope = createScope(this.deps.getContext(), row, this.deps.getParentScope?.());
    // the scope is registered BEFORE binding so nested collections created later resolve their params against this record
    registerScope(this.deps.el, scope);
    this.plan = buildRowPlan(this.deps.owner, this.deps.el, { includeRoot: false });
    if (row) bindRowOnce(this.deps.el, this.plan, scope, this.deps.apply);
  }

  /** `data-pb-state` lets themes style loading / empty / not-found without JavaScript. */
  private markState(s: CollectionState): void {
    this.deps.el.setAttribute('data-pb-state', s.status);
  }
}
