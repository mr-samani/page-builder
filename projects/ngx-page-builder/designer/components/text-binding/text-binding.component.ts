import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Notify } from 'ngx-kit/notify';
import { NgxDialogService } from 'ngx-kit/dialog';
import {
  DataSourceSetting,
  DEFAULT_IMAGE_URL,
  DynamicDataService,
  DynamicDataStructure,
  isCollectionSource,
  PageItem,
} from 'ngx-page-builder/core';
import { BaseComponent } from '../BaseComponent';
import { TextEditorComponent } from '../text-editor/text-editor.component';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { DataSourceSelectorComponent } from './data-source-selector/data-source-selector.component';
import { IPageBuilderFilePicker } from '../../services/file-picker/IFilePicker';
import { NGX_PAGE_BUILDER_FILE_PICKER } from '../../services/file-picker/token.filepicker';
import { NgxIconComponent } from 'ngx-page-builder/icons';
import { SwitchComponent } from '../../controls/switch/switch.component';
import { NGX_PAGE_BUILDER_HTML_EDITOR } from '../../services/html-editor/token.html-editor';
import { IPageBuilderHtmlEditor } from '../../services/html-editor/IHtmlEditor';

/**
 * - static     : the text is typed by the user
 * - collection : the text comes from a field of the parent collection (`item.dataSource.binding`)
 * - dynamic    : the text comes from an object data source (`{{namespace.field}}` in `item.content`)
 */
type BindingMode = 'static' | 'collection' | 'dynamic';

@Component({
  selector: 'text-binding',
  templateUrl: './text-binding.component.html',
  styleUrls: ['./text-binding.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SafeHtmlPipe, DataSourceSelectorComponent, NgxIconComponent, SwitchComponent],
})
export class TextBindingComponent extends BaseComponent implements OnChanges {
  @Input() item!: PageItem;
  /** the collection that contains this element (if any) */
  @Input() parentCollection?: PageItem;
  /** STRUCTURE of the collection records - available even when the collection has no data */
  @Input() collectionFields: DynamicDataStructure[] = [];
  @Output() change = new EventEmitter<string>();

  mode: BindingMode = 'static';
  /** selected field of the collection record */
  collectionPath = '';
  /** selected path of an object data source */
  dynamicPath = '';
  /** object data sources (collections are excluded) */
  objectSources: DynamicDataStructure[] = [];
  /** img tag src url */
  imageUrl = '';

  private readonly filePicker = inject<IPageBuilderFilePicker | null>(NGX_PAGE_BUILDER_FILE_PICKER);
  private readonly htmlEditor = inject<IPageBuilderHtmlEditor | null>(NGX_PAGE_BUILDER_HTML_EDITOR);
  protected readonly renderer = inject(Renderer2);
  protected readonly dynamicDataService = inject(DynamicDataService);
  protected readonly dialog = inject(NgxDialogService);

  get isImage(): boolean {
    return !!this.item?.isImageTag;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // block-settings re-uses this component when another element is selected
    if (changes['item']) this.syncFromItem();
  }

  private syncFromItem() {
    this.objectSources = this.dynamicDataService.dynamicData.filter((x) => !isCollectionSource(x));

    const binding = this.item.dataSource?.binding ?? '';
    const content = (this.item.content ?? '').trim();
    this.collectionPath = binding;
    this.dynamicPath = '';

    if (binding && this.parentCollection) {
      this.mode = 'collection';
    } else if (!this.isImage && content.startsWith('{{') && content.endsWith('}}')) {
      this.mode = 'dynamic';
      this.dynamicPath = content.slice(2, -2);
    } else {
      this.mode = 'static';
    }
    this.imageUrl = this.isImage ? (this.item.el?.getAttribute('src') ?? '') : '';
  }

  /* ---------------------------- mode ---------------------------- */

  /** the two switches are mutually exclusive: turning one on turns the other off */
  toggleMode(mode: Exclude<BindingMode, 'static'>, enabled: boolean) {
    const next: BindingMode = enabled ? mode : 'static';
    if (next === this.mode) return;

    this.clearCurrentBinding();
    this.mode = next;
    this.change.emit('');
  }

  private clearCurrentBinding() {
    if (this.mode === 'collection') {
      this.setCollectionBinding('');
    } else if (this.mode === 'dynamic') {
      this.dynamicPath = '';
      this.item.content = '';
      this.pb.writeItemValue(this.item);
    }
  }

  /* ------------------------- collection ------------------------- */

  onCollectionFieldChange(path: string) {
    this.setCollectionBinding(path);
    this.change.emit(path);
  }

  private setCollectionBinding(path: string) {
    this.collectionPath = path;
    if (path) {
      this.item.dataSource ??= new DataSourceSetting();
      this.item.dataSource.binding = path;
    } else if (this.item.dataSource) {
      delete this.item.dataSource.binding;
      // an element has a data source only to hold its binding (collections keep theirs)
      if (!this.item.dataSource.id) delete this.item.dataSource;
    }
  }

  /* ------------------------- dynamic data ------------------------- */

  onDynamicFieldChange(path: string) {
    this.dynamicPath = path;
    this.item.content = path ? `{{${path}}}` : '';
    this.change.emit(this.item.content);
  }

  /* ---------------------------- static ---------------------------- */

  openTextEditor() {
    if (!this.item) return;
    if (this.htmlEditor) {
      this.htmlEditor.openEditor(this.item.content ?? '').then((content) => {
        this.item.content = content;
        this.pb.writeItemValue(this.item);
      });
    } else {
      this.dialog
        .open(TextEditorComponent, {
          data: this.item,
          width: '80vw',
          maxWidth: '100%',
          height: '90vh',
          header: {
            showMaximizeButton: true,
            showCloseButton: true,
          },
          panelClass: 'ngx-page-builder',
        })
        .afterClosed.subscribe((result) => {
          if (result && this.item) {
            this.item.content = result;
            this.pb.writeItemValue(this.item);
          }
        });
    }
  }

  onChangeSrcImage() {
    if (!this.filePicker) {
      console.warn('Provider for file picker is not available');
      Notify.warning('Provider for file picker is not available');
      return;
    }
    this.filePicker.openFilePicker('image').then((result) => {
      // TODO: base address must be set with pipe
      this.imageUrl = result ? this.filePicker?.baseUrlAddress + result : DEFAULT_IMAGE_URL;
      this.item.options ??= {};
      this.item.options.attributes ??= {};
      this.item.options.attributes['src'] = this.imageUrl;
      this.renderer.setAttribute(this.item!.el, 'src', this.imageUrl);
      this.change.emit(this.imageUrl);
    });
  }
}
