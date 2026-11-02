import { computed, Service, signal, type Type } from '@angular/core';
import { BlockLayoutsComponent } from './block-layouts/block-layouts.component';
import { BlockLibraryComponent } from './block-library/block-library.component';
import { PluginsComponent } from './plugins/plugins.component';

export type PanelType = 'layout' | 'block-library' | 'plugins' | null;

@Service()
export class PanelService {
  readonly activePanel = signal<PanelType>(null);

  readonly panelComponent = computed<Type<unknown> | null>(() => {
    switch (this.activePanel()) {
      case 'layout':
        return BlockLayoutsComponent;

      case 'block-library':
        return BlockLibraryComponent;
      case 'plugins':
        return PluginsComponent;
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
