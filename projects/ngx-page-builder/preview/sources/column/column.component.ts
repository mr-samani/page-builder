import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { PageItem, PagePreviewService } from 'ngx-page-builder/core';

@Component({
  selector: 'page-column',
  templateUrl: './column.component.html',
  styleUrls: ['./column.component.scss'],
  imports: [],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewColumnComponent implements OnInit {
  // inputs auto filled by create dynamic element
  @Input() pageItem!: PageItem;

  @ViewChild('colContainer', { static: true }) colContainer!: ElementRef<HTMLDivElement>;
  constructor(private pagePreviewService: PagePreviewService) {}

  ngOnInit() {
    this.loadCols();
  }
  async loadCols() {
    for (const child of this.pageItem.children) {
      let el = await this.pagePreviewService.createBlockElement(child, this.colContainer.nativeElement);
    }
  }
}
