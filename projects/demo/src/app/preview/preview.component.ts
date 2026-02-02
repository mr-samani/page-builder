import { Component, OnInit } from '@angular/core';
import {
  IPagebuilderOutput,
  IStyleSheetFile,
  NgxPagePreviewComponent,
  PageBuilderConfig,
} from '@ngx-page-builder';
import { DynamicData } from '../dynamic-data/dynamic-data';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-preview',
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.scss'],
  imports: [NgxPagePreviewComponent, FormsModule],
})
export class PreviewComponent implements OnInit {
  dynamicData = DynamicData;

  data: IPagebuilderOutput;
  constructor() {
    const savedData = localStorage.getItem('page') || '{}';
    const parsed = JSON.parse(savedData);
    this.data = parsed;
  }

  ngOnInit() {}
}
