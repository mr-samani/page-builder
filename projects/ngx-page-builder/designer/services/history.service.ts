import { Injectable, signal, computed } from '@angular/core';
import { LibConsts, PageItem, cloneDeep, isEqual } from 'ngx-page-builder/core';

type HistoryAction = 'add' | 'delete' | 'edit';

interface HistoryState {
  snapshot: PageItem;
  description?: string;
  timestamp: number;
  action: HistoryAction;
}

@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private _history = signal<HistoryState[]>([]);
  private _currentIndex = signal<number>(-1);

  readonly canUndo = computed(() => this._currentIndex() >= 0 && LibConsts.enableHistory);
  readonly canRedo = computed(() => this._currentIndex() < this._history().length - 1 && LibConsts.enableHistory);

  /** وضعیت فعلی بلاک‌ها */
  readonly currentState = computed(() => this._history()[this._currentIndex()]?.snapshot ?? []);

  /**
   * ذخیره وضعیت جدید فقط اگر تغییر واقعی وجود داشته باشد
   */
  save(action: HistoryAction, state: PageItem, description?: string) {
    if (!LibConsts.enableHistory) return;
    const clone = cloneDeep(state);
    const last = this._history()[this._currentIndex()];
    if (last && isEqual(last.snapshot, clone)) return;

    const newHistory = this._history().slice(0, this._currentIndex() + 1);
    newHistory.push({
      action,
      snapshot: clone,
      description,
      timestamp: Date.now(),
    });

    this._history.set(newHistory);
    this._currentIndex.set(newHistory.length - 1);
  }

  /**
   * بازگردانی وضعیت قبلی
   */
  undo(allBlocks: PageItem[]): PageItem[] {
    if (!this.canUndo()) return allBlocks;
    const u = this._applySnapshot(allBlocks, this.currentState(), true);
    this._currentIndex.set(this._currentIndex() - 1);
    return u;
  }

  /**
   * بازگردانی وضعیت بعدی
   */
  redo(allBlocks: PageItem[]): PageItem[] {
    if (!this.canRedo()) return allBlocks;

    this._currentIndex.set(this._currentIndex() + 1);
    return this._applySnapshot(allBlocks, this.currentState(), false);
  }

  clear() {
    this._history.set([]);
    this._currentIndex.set(-1);
  }

  getHistory(): HistoryState[] {
    return this._history();
  }

  /**
   * اعمال وضعیت جدید روی لیست فعلی
   */
  private _applySnapshot(allBlocks: PageItem[], next: PageItem | null, isUndo: boolean): PageItem[] {
    const blocks = cloneDeep(allBlocks);
    const currentHistory = this._history()[this._currentIndex()];

    if (!currentHistory) return blocks;

    const findIndexById = (
      blocks: PageItem[],
      id: string,
    ): { parent: PageItem | null; index: number; container: PageItem[] } | null => {
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].id === id) {
          return { parent: null, index: i, container: blocks };
        }
        if (blocks[i].children?.length) {
          const result = deepFind(blocks[i], blocks[i].children!, id);
          if (result) return result;
        }
      }
      return null;
    };

    const deepFind = (
      parent: PageItem,
      children: PageItem[],
      id: string,
    ): { parent: PageItem; index: number; container: PageItem[] } | null => {
      for (let i = 0; i < children.length; i++) {
        if (children[i].id === id) {
          return { parent, index: i, container: children };
        }
        if (children[i].children?.length) {
          const result = deepFind(children[i], children[i].children!, id);
          if (result) return result;
        }
      }
      return null;
    };

    // بر اساس نوع اکشن عمل می‌کنیم
    switch (currentHistory.action) {
      case 'add':
        if (next) {
          if (isUndo) {
            // undo add: بلاک اضافه شده را حذف می‌کنیم
            const target = findIndexById(blocks, next.id!);
            if (target) {
              target.container.splice(target.index, 1);
            }
          } else {
            // redo add: بلاک را دوباره اضافه می‌کنیم
            const target = findIndexById(blocks, next.id!);
            if (!target) {
              if (next.parent?.id) {
                const parent = findIndexById(blocks, next.parent.id);
                if (parent) {
                  parent.container.splice(parent.index + 1, 0, cloneDeep(next));
                } else {
                  blocks.push(cloneDeep(next));
                }
              } else {
                blocks.push(cloneDeep(next));
              }
            }
          }
        }
        break;

      case 'delete':
        if (next) {
          if (isUndo) {
            // undo delete: بلاک حذف شده را دوباره اضافه می‌کنیم
            const target = findIndexById(blocks, next.id!);
            if (!target) {
              if (next.parent?.id) {
                const parent = findIndexById(blocks, next.parent.id);
                if (parent) {
                  parent.container.splice(parent.index + 1, 0, cloneDeep(next));
                } else {
                  blocks.push(cloneDeep(next));
                }
              } else {
                blocks.push(cloneDeep(next));
              }
            }
          } else {
            // redo delete: بلاک را دوباره حذف می‌کنیم
            const target = findIndexById(blocks, next.id!);
            if (target) {
              target.container.splice(target.index, 1);
            }
          }
        }
        break;

      case 'edit':
        if (next) {
          // undo/redo edit: بلاک را به حالت snapshot برمی‌گردانیم
          const target = findIndexById(blocks, next.id!);
          if (target) {
            target.container[target.index] = cloneDeep(next);
          }
        }
        break;
    }

    return blocks;
  }
}
