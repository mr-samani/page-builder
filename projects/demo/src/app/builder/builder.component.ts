import { AfterViewInit, Component, DOCUMENT, inject, OnInit, viewChild } from '@angular/core';
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
import { DynamicData } from '../dynamic-data/dynamic-data';
import { HtmlEditorService } from './html-editor.service';
import { Router, RouterLink } from '@angular/router';
import { CustomSources } from '../custom-source/custom-sources';
import { LocalStoreService } from '../custom-storage/localstore.service';
import { PluginService } from './plugin.service';
@Component({
  selector: 'app-builder',
  templateUrl: './builder.component.html',
  styleUrls: ['./builder.component.css'],
  imports: [NgxPageBuilder],
  providers: [
    providePageBuilder({
      customSources: CustomSources,
      storageType: StorageType.JSONFile,
      enableExportAsPlugin: true,
      showPlugins: true,
      canDeletePlugin: true,
      toolbarConfig: {
        showSaveButton: true,
        showOpenButton: false,
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
    {
      provide: NGX_PAGE_BUILDER_STORAGE_SERVICE,
      useClass: LocalStoreService,
    },
    // {
    //   provide: NGX_PAGE_BUILDER_STORAGE_SERVICE,
    //   useClass: MessagePackStorageService,
    // },
  ],
})
export class BuilderComponent implements OnInit, AfterViewInit {
  pageBuilder = viewChild<NgxPageBuilder>('pageBuilder');
  dynamicData = DynamicData;

  styles: IStyleSheetFile[] = [
    {
      name: 'default',
      data: `
          .blur-card {
            background-size: cover;
            background-position: center center;
            background-repeat: repeat-y;
            box-shadow: rgba(76, 48, 255, 0.2) 0px 0px 20px 0px;
            color: rgb(0, 0, 237);
            background-color: rgba(0, 0, 0, 0);
            margin: 0px;
            backdrop-filter: blur(14px);
            display: block;
            padding: 20px;
            border-radius: 5px;
            border: 1px solid rgba(236, 236, 236, 0.37);
          }

          .center {
            padding: 0px;
            margin: 0px;
            display: flex;
            flex-flow: column;
            place-content: center;
            align-items: center;
          }

          .header {
            background:green;
            width: 100%;
            min-width: auto;
            min-height: 50vh;
            display: flex;
            flex-flow: column;
            place-content: center;
            align-items: center;
            gap: 15px;
          }

  `,
    },
  ];

  config?: PageBuilderConfig;
  data: IPage[] = [
    {
      headerItems: [],
      bodyItems: [
        {
          id: 'mivg5lkw-LfMxd',

          tag: 'section',
          canHaveChild: true,
          classList: ['center', 'header'],
          disableMovement: false,
          lockMoveInnerChild: false,
          disableDelete: false,
          children: [
            {
              id: 'miu3rvp9-Gzmms',
              classList: ['blur-card'],
              tag: 'h1',
              canHaveChild: false,
              content: 'Heading 1',
              options: {
                attributes: {
                  class: '',
                },
              },
              disableMovement: false,
              lockMoveInnerChild: false,
              disableDelete: false,
            },
            {
              id: 'mivma9c8-IRvrb',

              children: [],
              tag: 'h5',
              canHaveChild: false,
              content: 'Heading 5',
              options: {
                attributes: {
                  class: '',
                },
              },
              disableMovement: false,
              lockMoveInnerChild: false,
              disableDelete: false,
            },
          ],
        },
      ],
      footerItems: [],
      config: {
        title: '',
        description: '',
      },
      order: 0,
    },
  ];

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

  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  constructor() {}

  ngOnInit() {
    try {
      const savedData = localStorage.getItem('page');
      const parsed = JSON.parse(savedData || '{}');
      this.data = parsed?.data ?? [];
      this.config = parsed?.config;
      this.styles = parsed?.styles;
    } catch (error) {}
  }
  ngAfterViewInit(): void {
    this.doc.querySelector('ngx-page-builder')?.scrollIntoView();
  }
  getData() {
    this.pageBuilder()
      ?.getData()
      .then((result) => {
        localStorage.setItem('page', JSON.stringify(result));
        console.log('get data:', result);
      });
  }
}
