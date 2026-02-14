import {
  Component,
  EventEmitter,
  inject,
  Inject,
  Injector,
  Input,
  OnInit,
  Output,
  Renderer2,
} from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { MatDialog } from '@angular/material/dialog';
import { TextEditorComponent } from '../text-editor/text-editor.component';
import { FormsModule } from '@angular/forms';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { DataSourceSelectorComponent } from './data-source-selector/data-source-selector.component';
import { IPageBuilderFilePicker } from '../../services/file-picker/IFilePicker';
import { NGX_PAGE_BUILDER_FILE_PICKER } from '../../services/file-picker/token.filepicker';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { SwitchComponent } from '../../controls/switch/switch.component';
import { NGX_PAGE_BUILDER_HTML_EDITOR } from '../../services/html-editor/token.html-editor';
import { IPageBuilderHtmlEditor } from '../../services/html-editor/IHtmlEditor';
import { Notify } from '../../extensions/notify';
import {
  DEFAULT_IMAGE_URL,
  DynamicDataService,
  DynamicDataStructure,
  PageItem,
} from 'ngx-page-builder/core';

@Component({
  selector: 'text-binding',
  templateUrl: './text-binding.component.html',
  styleUrls: ['./text-binding.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    SafeHtmlPipe,
    DataSourceSelectorComponent,
    SvgIconDirective,
    SwitchComponent,
  ],
})
export class TextBindingComponent extends BaseComponent implements OnInit {
  @Input() item!: PageItem;
  @Input() parentCollection?: PageItem;
  @Input() collectionDsList: DynamicDataStructure[] = [];
  @Output() change = new EventEmitter<string>();

  isCollectionItem: boolean = false;
  dataSourceName = '';

  bindingColumns: DynamicDataStructure[] = [];

  dsList: DynamicDataStructure[] = [];
  selectedNamespace = '';
  useDynamicData = false;

  /** img tag src url */
  imageUrl = '';
  private filePicker = inject<IPageBuilderFilePicker | null>(NGX_PAGE_BUILDER_FILE_PICKER);
  private htmlEditor = inject<IPageBuilderHtmlEditor | null>(NGX_PAGE_BUILDER_HTML_EDITOR);
  constructor(
    injector: Injector,
    private matDialog: MatDialog,
    public dynamicDataService: DynamicDataService,
    private renderer: Renderer2
  ) {
    super(injector);
    // dynamic data if is not item collection
    this.dsList = this.dynamicDataService.dynamicData.filter((x: DynamicDataStructure) => !x.list);
  }

  ngOnInit() {
    if (!this.item.dataSource) {
      this.item.dataSource = {};
    }
    let c = (this.item.content ?? '').trim();
    if (c.startsWith('{{') && c.endsWith('}}')) {
      this.selectedNamespace = c.substring(2, c.length - 2);
      this.useDynamicData = true;
    }

    this.imageUrl = '';
    if (this.item && this.item.isImageTag) {
      this.imageUrl = this.item.el?.getAttribute('src') ?? '';
    }
  }

  openTextEditor() {
    if (!this.item) return;
    if (this.htmlEditor) {
      this.htmlEditor.openEditor(this.item.content ?? '').then((content) => {
        this.item.content = content;
        this.pageBuilder.writeItemValue(this.item);
      });
    } else {
      this.matDialog
        .open(TextEditorComponent, {
          data: this.item,
          width: '80vw',
          maxWidth: '100%',
          height: '90vh',
        })
        .afterClosed()
        .subscribe((result) => {
          if (result && this.item) {
            this.item.content = result;
            this.pageBuilder.writeItemValue(this.item);
          }
        });
    }
  }
  onChangeKey(event: string[]) {
    this.item.content = `{{${event.join('.')}}}`;
    this.change.emit(this.item.content);
  }
  onChangeCollectionKey(event: string[]) {
    if (event.length > 0) {
      this.useDynamicData = false;
      this.selectedNamespace = '';
    }
    this.item.dataSource ??= {};
    this.item.dataSource.binding = `${event.join('.')}`;
    this.change.emit(this.item.dataSource.binding);
  }
  onChangeUseDs() {
    if (this.useDynamicData) {
      this.item.dataSource!.binding = '';
    }
  }

  onChangeSrcImage() {
    if (this.item.dataSource) this.item.dataSource.binding = '';
    if (!this.filePicker) {
      console.warn('Provider for file picker is not available');
      Notify.warning('Provider for file picker is not available');
      return;
    }
    this.filePicker.openFilePicker('image').then((result) => {
      // TODO base address must be set with pipe
      this.imageUrl = result ? this.filePicker?.baseUrlAddress + result : DEFAULT_IMAGE_URL;
      this.item.options ??= {};
      this.item.options.attributes ??= {};
      this.item.options.attributes['src'] = this.imageUrl;
      this.renderer.setAttribute(this.item!.el, 'src', this.imageUrl);
      this.change.emit(this.imageUrl);
    });
  }
}
