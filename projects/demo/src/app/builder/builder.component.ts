import {
  AfterViewInit,
  Component,
  DOCUMENT,
  inject,
  OnInit,
  viewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CustomToolbarButtons, IPage, IStyleSheetFile, PageBuilderConfig, StorageType } from 'ngx-page-builder/core';
import {
  NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE,
  NGX_PAGE_BUILDER_FILE_PICKER,
  NGX_PAGE_BUILDER_HTML_EDITOR,
  NGX_PAGE_BUILDER_STORAGE_SERVICE,
  NgxPageBuilder,
  providePageBuilder,
} from 'ngx-page-builder/designer';
import { FilePickerService } from './file-picker.service';
import { InitializeDynamicData } from '../dynamic-data/dynamic-data';
import { HtmlEditorService } from './html-editor.service';
import { Router } from '@angular/router';
import { CustomSources } from '../custom-source/custom-sources';
import { LocalStoreService } from '../custom-storage/localstore.service';
import { PluginService } from './plugin.service';
import { ICssVariable } from 'ngx-page-builder/core';
@Component({
  selector: 'app-builder',
  templateUrl: './builder.component.html',
  styleUrls: ['./builder.component.css'],
  imports: [NgxPageBuilder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    providePageBuilder({
      customSources: CustomSources,
      storageType: StorageType.LocalStorage,
      enableExportAsPlugin: true,
      enableShotcuts: true,
      showPlugins: true,
      canDeletePlugin: true,
      enableHistory: true,
      toolbarConfig: {
        showSaveButton: true,
        showOpenButton: true,
        showPreviewButton: true,
      },
      publicCss: ['/bootstrap.min.css'],
      publicJs: ['/bootstrap.min.js'],
    }),
    { provide: NGX_PAGE_BUILDER_FILE_PICKER, useClass: FilePickerService },
    { provide: NGX_PAGE_BUILDER_HTML_EDITOR, useClass: HtmlEditorService },

    {
      provide: NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE,
      useExisting: PluginService,
    },
    // {
    //   provide: NGX_PAGE_BUILDER_STORAGE_SERVICE,
    //   useClass: LocalStoreService,
    // },
    // {
    //   provide: NGX_PAGE_BUILDER_STORAGE_SERVICE,
    //   useClass: MessagePackStorageService,
    // },
  ],
})
export class BuilderComponent implements OnInit, AfterViewInit {
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly chdr = inject(ChangeDetectorRef);
  private readonly dynamicDatainitializer = inject(InitializeDynamicData);

  pb = viewChild<NgxPageBuilder>('pageBuilder');
  dynamicData = this.dynamicDatainitializer.DynamicData;

  styles: IStyleSheetFile[] = [];

  config?: PageBuilderConfig;
  data: IPage[] = [];

  cssVariables: ICssVariable[] = [];
  customButtons: CustomToolbarButtons[] = [
    {
      title: 'preview page',
      icon: '<i class="fa fa-preview">ppp</p>',
      callback: () => {
        let newRelativeUrl = this.router.createUrlTree(['/preview']);
        window.open(newRelativeUrl.toString(), '_blank');
      },
    },
  ];

  constructor() {}

  ngOnInit() {
    //setTimeout(() => {
    try {
      const savedData = localStorage.getItem('page');
      const parsed = JSON.parse(savedData || '{}');
      this.data = parsed?.data ?? [];
      this.config = parsed?.config;
      this.styles = parsed?.styles;
      this.cssVariables = parsed.cssVariables;

      this.chdr.markForCheck();
    } catch (error) {}
    //}, 1000);
  }
  ngAfterViewInit(): void {
    this.doc.querySelector('ngx-page-builder')?.scrollIntoView();
  }
  getData() {
    this.pb()
      ?.getData()
      .then((result) => {
        localStorage.setItem('page', JSON.stringify(result));
        console.log('get data:', result);
      });
  }
}
