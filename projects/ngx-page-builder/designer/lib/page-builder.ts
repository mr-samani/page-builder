import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  input,
  Input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { PageBuilderBaseComponent } from './page-builder-base-component';
import { IStorageService } from '../services/storage/IStorageService';
import { Subscription } from 'rxjs';
import { SideConfigComponent } from '../components/side-config/side-config.component';
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
  SourceItem,
} from 'ngx-page-builder/core';
import { ClassManagerService } from '../services/class-manager.service';
import { NgxDialogModule, NgxDialogService } from 'ngx-kit/dialog';
import { Notify } from 'ngx-kit/notify';
import { NgxDropListGroup, NgxResizable, type IResizableOutput, NgxResizeHandle } from 'ngx-kit/drag-resize';
import { PanelService } from '../panels/panel.service';
import { NgComponentOutlet } from '@angular/common';
import { ConfigDialogComponent } from '../dialogs/config-dialog/config-dialog.component';
import { NgxIconComponent } from 'ngx-page-builder/icons';

@Component({
  standalone: true,
  selector: 'ngx-page-builder',
  templateUrl: './page-builder.html',
  styleUrls: ['../styles/all.scss'],
  imports: [
    InnerContentComponent,
    ToolbarComponent,
    SideConfigComponent,
    NgxIconComponent,
    NgxDialogModule,
    NgxDropListGroup,
    NgxResizable,
    NgComponentOutlet,
    NgxResizeHandle,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PanelService],
})
export class NgxPageBuilder extends PageBuilderBaseComponent implements OnInit, OnDestroy {
  readonly innerContent = viewChild<InnerContentComponent>('innerContent');

  toolbarConfig = LibConsts.toolbarConfig;
  readonly data = input<IPage[]>();

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
      this.cls.setCssVariables(val);
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
  @Input('cmsPages') set setCmsPages(val: CMSPage[]) {
    if (val && Array.isArray(val)) {
      LibConsts.cmsPages = val;
    } else {
      LibConsts.cmsPages = [];
    }
  }

  subscriptions: Subscription[] = [];

  showSnippets = LibConsts.showSnippets;

  private storageService = inject<IStorageService>(NGX_PAGE_BUILDER_STORAGE_SERVICE);
  protected readonly dialog = inject(NgxDialogService);
  readonly panelService = inject(PanelService);

  isLoading = signal(false);
  sideConfigSize = signal<number>(270);
  constructor(
    private injector: Injector,
    private cls: ClassManagerService,
  ) {
    super();
    this.pb.storageService = this.storageService;
    this.pb.changed$.subscribe((data: PageItemChange) => {
      if (data.type == 'ChangePageConfig') {
        this.chdRef.detectChanges();
      }
    });

    effect(() => {
      const d = this.data();
      if (!d || Array.isArray(d) == false) {
        console.warn('NgxPageBuilder', 'Input data not valid!');
        Notify.error('Input data not valid!');
        return;
      }
      if (d.length > 0) {
        const pages = d.map((m) => Page.fromJSON(m));
        this.loadPageData(pages);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // this.cls.initialize();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private async loadPageData(data: Page[]) {
    try {
      this.isLoading.set(true);
      this.pb.pageInfo.pages = data;
      // check has body block
      //console.log('load data:', data, 'converted class:', this.pb.pageInfo);
      if (this.pb.pageInfo.pages.length == 0) {
        await this.pb.addPage();
        this.isLoading.set(false);
      } else {
        setTimeout(async () => {
          await this.pb.changePage(1);
          const body = this.pb.pageInfo.pages[0].bodyItems[0];
          this.isLoading.set(false);
        }, 100);
        //console.log('after load:', this.pb.pageInfo);
      }
    } catch (error) {
      await this.pb.addPage();
      console.error('Error loading page data:', error);
      Notify.error('Error loading page data: ' + error);
      this.isLoading.set(false);
    }
  }

  onResizeSideConfig(ev: IResizableOutput) {
    this.sideConfigSize.set(ev.width);
    this.innerContent()?.updateScale();
  }
  openConfigDialog() {
    this.dialog
      .open(ConfigDialogComponent, {
        size: 'lg',
        header: {
          showMaximizeButton: true,
          showCloseButton: true,
        },
        panelClass: 'ngx-page-builder',
      })
      .afterClosed.subscribe((r) => {
        if (r) {
          this.pb.onUpdateBaseConfig$.next(r);
        }
      });
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

  async addItem(item: SourceItem) {
    await this.pb.addBlockToBody(item);
    console.log(this.pb);
  }
}
