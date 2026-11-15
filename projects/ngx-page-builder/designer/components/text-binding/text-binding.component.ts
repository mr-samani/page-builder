import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  input,
  linkedSignal,
  Output,
  Renderer2,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Notify } from 'ngx-kit/notify';
import { NgxDialogService } from 'ngx-kit/dialog';
import {
  DataSourceSetting,
  DEFAULT_IMAGE_URL,
  DynamicDataService,
  findParentCollection,
  PageItem,
  toBindingToken,
} from 'ngx-page-builder/core';
import { BaseComponent } from '../BaseComponent';
import { TextEditorComponent } from '../text-editor/text-editor.component';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { BindingScope, DataSourceSelectorComponent } from './data-source-selector/data-source-selector.component';
import { IPageBuilderFilePicker } from '../../services/file-picker/IFilePicker';
import { NGX_PAGE_BUILDER_FILE_PICKER } from '../../services/file-picker/token.filepicker';
import { NgxIconComponent } from 'ngx-page-builder/icons';
import { SwitchComponent } from '../../controls/switch/switch.component';
import { NGX_PAGE_BUILDER_HTML_EDITOR } from '../../services/html-editor/token.html-editor';
import { IPageBuilderHtmlEditor } from '../../services/html-editor/IHtmlEditor';

/**
 * Binds the text (or the image) of a block to dynamic data.
 *
 * The binding is stored in `item.dataSource.binding` and `item.content` shows it as `{{binding}}`.
 * Where the block is decides what it can be bound to:
 * - inside a collection: a field of the records of that collection (`price`, `address.city`)
 * - anywhere else: a non list field of an object data source (`personalInfo.job.title`)
 */
@Component({
  selector: 'text-binding',
  templateUrl: './text-binding.component.html',
  styleUrls: ['./text-binding.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SafeHtmlPipe, DataSourceSelectorComponent, NgxIconComponent, SwitchComponent],
})
export class TextBindingComponent extends BaseComponent {
  readonly item = input.required<PageItem>();
  @Output() change = new EventEmitter<string>();

  /** img tag src url */
  imageUrl = '';

  private readonly filePicker = inject<IPageBuilderFilePicker | null>(NGX_PAGE_BUILDER_FILE_PICKER);
  private readonly htmlEditor = inject<IPageBuilderHtmlEditor | null>(NGX_PAGE_BUILDER_HTML_EDITOR);
  protected readonly renderer = inject(Renderer2);
  protected readonly dynamicDataService = inject(DynamicDataService);
  protected readonly dialog = inject(NgxDialogService);

  /** the collection that contains the block (undefined when the block is not used in a list) */
  protected readonly collection = computed(() => findParentCollection(this.item()));
  protected readonly scope = computed<BindingScope>(() => (this.collection() ? 'collection' : 'object'));
  protected readonly collectionId = computed(() => this.collection()?.dataSource.id);

  /** the switch: can be on while no field is chosen yet. Reset when another block is selected */
  protected readonly bound = linkedSignal(() => !!this.item().dataSource?.binding);
  protected readonly binding = linkedSignal(() => this.item().dataSource?.binding ?? '');

  /** false when there is nothing to bind to (no data source / no fields) */
  protected readonly canBind = computed(() => {
    const collection = this.collection();
    if (collection) return !!this.dynamicDataService.findDataSource(collection.dataSource.id)?.fields?.length;
    return this.dynamicDataService.objectSources.length > 0;
  });

  get isImage(): boolean {
    return !!this.item()?.isImageTag;
  }

  get switchLabel(): string {
    if (this.scope() === 'collection') return this.isImage ? 'Get image from collection' : 'Get text from collection';
    return this.isImage ? 'Bind image to dynamic data' : 'Binding to dynamic data';
  }

  toggleBinding(enabled: boolean) {
    this.bound.set(enabled);
    if (!enabled) this.applyBinding('');
  }

  /** a field (leaf) has been chosen, `path` is the value to store */
  onPathChange(path: string) {
    this.applyBinding(path);
  }

  private applyBinding(path: string) {
    const block = this.item();
    block.dataSource ??= new DataSourceSetting();
    if (path) {
      block.dataSource.binding = path;
    } else {
      delete block.dataSource.binding;
    }
    this.binding.set(path);

    if (this.isImage) {
      // the address comes from the data: the old one must not stay
      if (block.options?.attributes) delete block.options.attributes['src'];
      if (block.el) this.renderer.setAttribute(block.el, 'src', DEFAULT_IMAGE_URL);
      this.change.emit(path);
    } else {
      block.content = toBindingToken(path);
      this.pb.writeItemValue(block);
    }
    this.chdRef.markForCheck();
  }

  openTextEditor() {
    if (!this.item()) return;
    if (this.htmlEditor) {
      this.htmlEditor.openEditor(this.item().content ?? '').then((content) => {
        this.item().content = content;
        this.pb.writeItemValue(this.item());
      });
    } else {
      this.dialog
        .open(TextEditorComponent, {
          data: this.item(),
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
          if (result && this.item()) {
            this.item().content = result;
            this.pb.writeItemValue(this.item());
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
      const block = this.item();
      block.options ??= {};
      block.options.attributes ??= {};
      block.options.attributes['src'] = this.imageUrl;
      this.renderer.setAttribute(this.item()!.el, 'src', this.imageUrl);
      this.change.emit(this.imageUrl);
    });
  }
}
