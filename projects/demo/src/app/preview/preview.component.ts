import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { NgxPagePreviewComponent, providePagePreview } from 'ngx-page-builder/preview';
import { IPagebuilderOutput } from 'ngx-page-builder/core';
import { InitializeDynamicData } from '../dynamic-data/dynamic-data';
import { FormsModule } from '@angular/forms';
import { CustomSources } from '../custom-source/custom-sources';
import { FilePickerService } from '../builder/file-picker.service';

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
    FilePickerService,
  ],
})
export class PreviewComponent implements OnInit {
  private readonly dynamicDatainitializer = inject(InitializeDynamicData);

  dynamicData = this.dynamicDatainitializer.DynamicData;

  data?: IPagebuilderOutput;
  chdr = inject(ChangeDetectorRef);
  filePicker = inject(FilePickerService);
  constructor() {}

  ngOnInit() {
    // const savedData = localStorage.getItem('page') || '{}';
    // const parsed = JSON.parse(savedData);
    // this.data = parsed;
  }

  openFile() {
    this.filePicker.openFilePicker('file').then((result) => {
      performance.mark('before-parse');
      const obj = JSON.parse(result);
      this.data = obj;
      performance.mark('after-parse');
      performance.measure('parse', 'before-parse', 'after-parse');
      this.chdr.detectChanges();
      console.log(performance.getEntriesByName('parse'));
    });
  }
}
