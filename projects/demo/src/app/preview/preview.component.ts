import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { NgxPagePreviewComponent, providePagePreview } from 'ngx-page-builder/preview';
import { IPagebuilderOutput } from 'ngx-page-builder/core';
import { InitializeDynamicData } from '../dynamic-data/dynamic-data';
import { FormsModule } from '@angular/forms';
import { CustomSources } from '../custom-source/custom-sources';

@Component({
  selector: 'app-preview',
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.scss'],
  imports: [NgxPagePreviewComponent, FormsModule],
  providers: [
    providePagePreview({
      customSources: CustomSources,
      publicCss: ['/bootstrap.min.css'],
      publicJs: ['/bootstrap.min.js'],
    }),
  ],
})
export class PreviewComponent implements OnInit {
  private readonly dynamicDatainitializer = inject(InitializeDynamicData);

  dynamicData = this.dynamicDatainitializer.DynamicData;

  data?: IPagebuilderOutput;
  chdr = inject(ChangeDetectorRef);
  constructor() {}

  ngOnInit() {
    const savedData = localStorage.getItem('page') || '{}';

    const parsed = JSON.parse(savedData);
    this.data = parsed;
  }

  reload() {
    const d = Object.assign({}, this.data);

    this.data = undefined;

    setTimeout(() => {
      this.data = d;
      this.chdr.detectChanges();
    }, 1000);
  }
}
