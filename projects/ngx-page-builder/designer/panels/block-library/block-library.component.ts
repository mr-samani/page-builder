import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgxDraggable, NgxDropList, type IPosition } from 'ngx-kit/drag-resize';
import { SourceItem } from 'ngx-page-builder/core';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { PageBuilderBaseComponent } from '../../lib/page-builder-base-component';
import { PanelService } from 'ngx-page-builder/designer/panels/panel.service';
import { PbPanel } from '../panel.layout';

interface BlockCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface BlockGroup extends BlockCategory {
  items: SourceItem[];
}

const CATEGORIES: BlockCategory[] = [
  {
    id: 'layout',
    title: 'Layout & Structure',
    description: 'Containers and semantic page regions',
    icon: 'assets/icons/layout.svg',
  },
  {
    id: 'typography',
    title: 'Text & Typography',
    description: 'Headings, text, emphasis and separators',
    icon: 'assets/icons/h.svg',
  },
  {
    id: 'media',
    title: 'Media & Embeds',
    description: 'Images, audio, video and embedded content',
    icon: 'assets/icons/img.svg',
  },
  {
    id: 'actions',
    title: 'Links & Actions',
    description: 'Navigation, buttons and disclosure controls',
    icon: 'assets/icons/link.svg',
  },
  {
    id: 'forms',
    title: 'Forms & Inputs',
    description: 'Accessible form fields and controls',
    icon: 'assets/icons/input.svg',
  },
  {
    id: 'data',
    title: 'Lists & Data',
    description: 'Lists, tables, metrics and dynamic collections',
    icon: 'assets/icons/table.svg',
  },
  {
    id: 'document',
    title: 'Print & Document',
    description: 'Page-oriented blocks for document layouts',
    icon: 'assets/icons/page.svg',
  },
  {
    id: 'custom',
    title: 'Custom Blocks',
    description: 'Blocks registered by the application',
    icon: 'assets/icons/hexagon-plus.svg',
  },
];

@Component({
  selector: 'block-library',
  standalone: true,
  imports: [CommonModule, SvgIconDirective, NgxDropList, NgxDraggable, PbPanel],
  templateUrl: './block-library.component.html',
  styleUrls: ['./block-library.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockLibraryComponent extends PageBuilderBaseComponent {
  readonly isDragging = signal<boolean>(false);

  readonly panelService = inject(PanelService);
  readonly searchTerm = signal('');
  readonly openCategories = signal<ReadonlySet<string>>(new Set(['layout']));
  readonly query = computed(() => this.searchTerm().trim().toLocaleLowerCase());

  /**
   * Each visible card is a draggable source. This array is also the drop-list data,
   * so the drag index always resolves to the same SourceItem in PageBuilderService.
   */
  readonly groups = computed<BlockGroup[]>(() => {
    const query = this.query();
    const sourceItems = this.pb.sources;
    const categories = [...CATEGORIES];
    const known = new Set(categories.map((category) => category.id));

    for (const source of sourceItems) {
      const id = source.category || 'custom';
      if (!known.has(id)) {
        categories.push({
          id,
          title: this.categoryTitle(id),
          description: 'Application-defined blocks',
          icon: 'assets/icons/hexagon-plus.svg',
        });
        known.add(id);
      }
    }

    return categories
      .map((category) => {
        const items = sourceItems.filter((item) => {
          const itemCategory = item.category || 'custom';
          if (itemCategory !== category.id) return false;
          if (!query) return true;
          const haystack = [item.title, item.tag, item.description, ...(item.keywords ?? []), category.title]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();
          return haystack.includes(query);
        });
        return { ...category, items };
      })
      .filter((group) => group.items.length > 0);
  });

  readonly totalCount = computed(() => this.groups().reduce((count, group) => count + group.items.length, 0));
  readonly isSearching = computed(() => this.query().length > 0);

  setSearch(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  isCategoryOpen(id: string): boolean {
    return this.isSearching() || this.openCategories().has(id);
  }

  onCategoryToggle(event: Event, id: string): void {
    const isOpen = (event.currentTarget as HTMLDetailsElement).open;
    this.openCategories.update((current) => {
      const next = new Set(current);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async addBlock(item: SourceItem): Promise<void> {
    await this.pb.addBlockToBody(item);
  }

  onCardKeydown(event: KeyboardEvent, item: SourceItem): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    void this.addBlock(item);
  }

  trackCategory(_: number, group: BlockGroup): string {
    return group.id;
  }

  trackSource(_: number, item: SourceItem): string {
    return `${item.category || 'custom'}:${item.tag}:${item.title || ''}:${item.customComponent?.componentKey || ''}`;
  }

  private categoryTitle(id: string): string {
    return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
  }
}
