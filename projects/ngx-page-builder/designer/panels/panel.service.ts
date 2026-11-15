import { computed, Service, signal, type Type } from '@angular/core';
import { BlockLayoutsComponent } from './block-layouts/block-layouts.component';
import { BlockLibraryComponent } from './block-library/block-library.component';
import { SnippetsComponent } from './snippets/snippets.component';

export type PanelType = 'layout' | 'block-library' | 'snippets' | null;

@Service()
export class PanelService {
  readonly activePanel = signal<PanelType>(null);

  readonly panelComponent = computed<Type<unknown> | null>(() => {
    switch (this.activePanel()) {
      case 'layout':
        return BlockLayoutsComponent;

      case 'block-library':
        return BlockLibraryComponent;
      case 'snippets':
        return SnippetsComponent;
      default:
        return null;
    }
  });

  readonly panelSize = computed(() => (this.activePanel() ? 340 : 0));

  isOpen(panel: Exclude<PanelType, null>): boolean {
    return this.activePanel() === panel;
  }

  open(panel: Exclude<PanelType, null>): void {
    this.activePanel.set(panel);
  }

  close(): void {
    this.activePanel.set(null);
  }

  toggle(panel: Exclude<PanelType, null>): void {
    this.activePanel.update((current) => (current === panel ? null : panel));
  }
}
