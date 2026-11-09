import { Injectable, signal } from '@angular/core';
import type { IconDefinition } from './icon-definition';

/**
 * Runtime registry for icons referenced by *name*.
 * Icons passed directly as definitions (`[icon]="gripDots"`) never touch it.
 *
 * State is a signal holding an immutable Map, so <ngx-icon> instances that were
 * rendered before an icon got registered (e.g. lazy route) update automatically.
 */
@Injectable({ providedIn: 'root' })
export class IconRegistry {
  private readonly store = signal<ReadonlyMap<string, IconDefinition>>(new Map());

  /** Register (or override) icons. Last registration wins. */
  register(...defs: readonly IconDefinition[]): void {
    if (!defs.length) return;
    this.store.update((current) => {
      const next = new Map(current);
      for (const d of defs) next.set(d.name, d);
      return next;
    });
  }

  /** Reactive when called inside computed()/effect()/templates. */
  get(name: string): IconDefinition | undefined {
    return this.store().get(name);
  }

  has(name: string): boolean {
    return this.store().has(name);
  }
}
