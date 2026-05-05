import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  inject,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgxDragDropKitModule } from 'ngx-drag-drop-kit';
import { BlockSelectorComponent } from '../components/block-selector/block-selector.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { PageBuilderBaseComponent } from './page-builder-base-component';
import { IStorageService } from '../services/storage/IStorageService';
import { Subscription } from 'rxjs';
import { SideConfigComponent } from '../components/side-config/side-config.component';
import { NgxPgNotifyModule, Notify } from '../extensions/notify';
import { SvgIconDirective } from '../directives/svg-icon.directive';
import { FocusContext } from '../services/shortcut.service';
import { preparePageDataForSave } from '../helper/prepare-page-builder-data';
import { InnerContentComponent } from './inner-content/inner-content.component';
import { NGX_PAGE_BUILDER_STORAGE_SERVICE } from '../services/storage/token.storage';
import { PageItemChange } from '../services/page-builder.service';

import {
  DynamicDataStructure,
  IPage,
  IPagebuilderOutput,
  IStyleSheetFile,
  LibConsts,
  Page,
  PageBuilderConfig,
  ViewMode,
  validateViewMode,
  CustomToolbarButtons,
  CMSPage,
  ICssVariable,
} from 'ngx-page-builder/core';
import { ClassManagerService } from '../services/class-manager.service';
import { Dialog, NgxDialogModule } from '../extensions/dialog';

@Component({
  standalone: true,
  selector: 'ngx-page-builder',
  templateUrl: './page-builder.html',
  styleUrls: ['./page-builder.scss', '../styles/paper.scss'],
  imports: [
    InnerContentComponent,
    NgxDragDropKitModule,
    ToolbarComponent,
    BlockSelectorComponent,
    SideConfigComponent,
    NgxPgNotifyModule,
    SvgIconDirective,
    NgxDialogModule,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgxPageBuilder extends PageBuilderBaseComponent implements OnInit, OnDestroy {
  @Input() set data(val: IPage[] | undefined) {
    if (!val || Array.isArray(val) == false) {
      console.warn('NgxPageBuilder', 'Input data not valid!');
      Notify.error('Input data not valid!');
      return;
    }
    const pages = val.map((m) => Page.fromJSON(m));
    this.loadPageData(pages);
  }

  @Input('config') set setPageConfig(val: PageBuilderConfig | undefined) {
    if (val) {
      this.pb.pageInfo.config = new PageBuilderConfig(val);
    }
  }

  @Input('styles') set setStyles(val: IStyleSheetFile[]) {
    if (val && Array.isArray(val)) {
      for (let f of val) this.cls.addToDefaultStyles(f.data);
    }
  }
  @Input('cssVariables') set setCssVariables(val: ICssVariable[]) {
    if (val && Array.isArray(val)) {
      this.pb.cssVariables = val;
    }
  }

  @Input('dynamicData') set setDynamicData(val: DynamicDataStructure[]) {
    this.dynamicDataService.dynamicData = val ?? [];
  }

  @Input({
    alias: 'viewMode',
    transform: validateViewMode,
  })
  set SetViewMode(val: ViewMode) {
    super.viewMode = val;
  }

  @Input() customToolbarButtons: CustomToolbarButtons[] = [];

  /**
   * used in link tag
   */
  @Input('cmsPages') setCmsPages(val: CMSPage[] | undefined) {
    if (val && Array.isArray(val)) {
      LibConsts.cmsPages = val;
    } else {
      LibConsts.cmsPages = [];
    }
  }

  blockSelector = viewChild<BlockSelectorComponent>('blockSelector');

  subscriptions: Subscription[] = [];

  showPlugins = LibConsts.showPlugins;

  private storageService = inject<IStorageService>(NGX_PAGE_BUILDER_STORAGE_SERVICE);
  private doc = inject(DOCUMENT);

  constructor(
    private injector: Injector,
    private cls: ClassManagerService,
  ) {
    super(injector);
    this.pb.storageService = this.storageService;
    this.pb.changed$.subscribe((data: PageItemChange) => {
      if (data.type == 'ChangePageConfig') {
        this.chdRef.detectChanges();
      }
    });
  }

  ngOnInit(): void {
    this.pb.blockSelector = this.blockSelector();
    this.cls.initialize();
    this.registerShortcuts();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.unregisterShortcuts();
  }

  private async loadPageData(data: Page[]) {
    try {
      // let data = await this.storageService.loadData();
      //this.pb.pageInfo = PageBuilderDto.fromJSON(data);
      this.pb.pageInfo.pages = data;
      //console.log('load data:', data, 'converted class:', this.pb.pageInfo);
      if (this.pb.pageInfo.pages.length == 0) {
        await this.pb.addPage();
      } else {
        await this.pb.changePage(1);
        //console.log('after load:', this.pb.pageInfo);
      }
    } catch (error) {
      await this.pb.addPage();
      console.error('Error loading page data:', error);
      Notify.error('Error loading page data: ' + error);
    }
  }

  async viewPlugins() {
    const { PluginsDialogComponent } = await import('./plugins-dialog/plugins-dialog.component');
    Dialog.open(PluginsDialogComponent, {
      width: '80vw',
      minHeight: '80%',
      injector: this.injector,
    }).afterClosed.subscribe((p) => {
      if (p) {
      }
    });
  }

  /**
   * ✅ Register all page builder shortcuts
   */
  private registerShortcuts(): void {
    // ========================================
    // DELETE - حذف بلاک (فقط در CANVAS context)
    // ========================================
    this.shortcuts.register('delete-block', {
      key: 'Delete',
      contexts: [FocusContext.CANVAS], // 👈 فقط وقتی focus روی canvas است
      description: 'Delete selected block',
      action: async () => {
        const currentBlock = this.pb.activeEl();
        if (currentBlock) {
          await this.pb.removeBlock(currentBlock);
        }
      },
    });

    // همچنین Backspace برای Mac users
    this.shortcuts.register('delete-block-backspace', {
      key: 'Backspace',
      contexts: [FocusContext.CANVAS],
      description: 'Delete selected block',
      action: async () => {
        const currentBlock = this.pb.activeEl();
        if (currentBlock) {
          await this.pb.removeBlock(currentBlock);
        }
      },
    });

    // ========================================
    // COPY - کپی بلاک (فقط در CANVAS)
    // ========================================
    this.shortcuts.register('copy-block', {
      key: 'c',
      ctrl: true,
      contexts: [FocusContext.CANVAS],
      description: 'Copy selected block',
      action: () => {
        const currentBlock = this.pb.activeEl();
        if (currentBlock) {
          this.pb.copyBlock(currentBlock);
        }
      },
    });

    // ========================================
    // PASTE - پیست بلاک (فقط در CANVAS)
    // ========================================
    this.shortcuts.register('paste-block', {
      key: 'v',
      ctrl: true,
      contexts: [FocusContext.CANVAS],
      description: 'Paste copied block',
      action: () => {
        this.pb.pasteBlock();
      },
    });

    // ========================================
    // DUPLICATE - دوبل کردن بلاک
    // ========================================
    this.shortcuts.register('duplicate-block', {
      key: 'd',
      ctrl: true,
      contexts: [FocusContext.CANVAS],
      description: 'Duplicate selected block',
      action: () => {
        const currentBlock = this.pb.activeEl();
        if (currentBlock) {
          this.pb.duplicateBlock(currentBlock);
        }
      },
    });

    // ========================================
    // UNDO / REDO
    // ========================================
    this.shortcuts.register('undo', {
      key: 'z',
      ctrl: true,
      contexts: [FocusContext.CANVAS, FocusContext.SIDEBAR], // در canvas و sidebar
      description: 'Undo last action',
      action: () => {
        this.pb.undo();
      },
    });

    this.shortcuts.register('redo', {
      key: 'z',
      ctrl: true,
      shift: true,
      contexts: [FocusContext.CANVAS, FocusContext.SIDEBAR],
      description: 'Redo last action',
      action: () => {
        this.pb.redo();
      },
    });

    // ========================================
    // ESCAPE - لغو انتخاب
    // ========================================
    this.shortcuts.register('deselect', {
      key: 'Escape',
      contexts: [FocusContext.CANVAS, FocusContext.TEXT_EDITING],
      description: 'Deselect / Exit edit mode',
      action: () => {
        const context = this.shortcuts.getCurrentContext();
        if (context === FocusContext.TEXT_EDITING) {
          // خروج از حالت ویرایش متن
          (this.doc.activeElement as HTMLElement)?.blur();
        } else {
          // لغو انتخاب بلاک
          this.pb.deSelectBlock();
        }
      },
    });

    // ========================================
    // SAVE - ذخیره (در همه context ها)
    // ========================================
    this.shortcuts.register('save', {
      key: 's',
      ctrl: true,
      contexts: [FocusContext.CANVAS, FocusContext.TEXT_EDITING, FocusContext.SIDEBAR],
      description: 'Save page',
      action: () => {
        this.pb.save();
      },
    });

    // ========================================
    // ARROW KEYS - حرکت بلاک (فقط در CANVAS)
    // ========================================
    // const moveDistance = 1;
    // const moveDistanceLarge = 10;

    // this.shortcuts.register('move-up', {
    //   key: 'ArrowUp',
    //   contexts: [FocusContext.CANVAS],
    //   description: 'Move block up',
    //   action: (event) => {
    //     const distance = event.shiftKey ? moveDistanceLarge : moveDistance;
    //     this.pb.moveActiveBlock(0, -distance);
    //   },
    // });

    // this.shortcuts.register('move-down', {
    //   key: 'ArrowDown',
    //   contexts: [FocusContext.CANVAS],
    //   description: 'Move block down',
    //   action: (event) => {
    //     const distance = event.shiftKey ? moveDistanceLarge : moveDistance;
    //     this.pb.moveActiveBlock(0, distance);
    //   },
    // });

    // this.shortcuts.register('move-left', {
    //   key: 'ArrowLeft',
    //   contexts: [FocusContext.CANVAS],
    //   description: 'Move block left',
    //   action: (event) => {
    //     const distance = event.shiftKey ? moveDistanceLarge : moveDistance;
    //     this.pb.moveActiveBlock(-distance, 0);
    //   },
    // });

    // this.shortcuts.register('move-right', {
    //   key: 'ArrowRight',
    //   contexts: [FocusContext.CANVAS],
    //   description: 'Move block right',
    //   action: (event) => {
    //     const distance = event.shiftKey ? moveDistanceLarge : moveDistance;
    //     this.pb.moveActiveBlock(distance, 0);
    //   },
    // });

    // ========================================
    // debuge log pageinfo
    // ========================================
    this.shortcuts.register('logconsole', {
      key: 'p',
      ctrl: true,
      shift: true,
      alt: true,
      contexts: [FocusContext.CANVAS, FocusContext.TEXT_EDITING, FocusContext.SIDEBAR],
      description: 'log console',
      action: () => {
        console.log(this.pb.pageInfo);
      },
    });
  }

  /**
   * ✅ Unregister shortcuts
   */
  private unregisterShortcuts(): void {
    const shortcutIds = [
      'delete-block',
      'delete-block-backspace',
      'copy-block',
      'paste-block',
      'duplicate-block',
      'undo',
      'redo',
      'select-all',
      'deselect',
      'save',
      'move-up',
      'move-down',
      'move-left',
      'move-right',
    ];

    shortcutIds.forEach((id) => this.shortcuts.unregister(id));
  }

  /**
   * Get page builder data for save to DB
   * @returns Promise JSONData
   */
  public getData(): Promise<IPagebuilderOutput> {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await preparePageDataForSave(this.pb);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }
}
