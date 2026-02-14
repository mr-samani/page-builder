import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { PageItem } from 'ngx-page-builder/core';

@Component({
  selector: 'page-break',
  templateUrl: './page-break.component.html',
  styleUrls: ['./page-break.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewPageBreakComponent implements OnInit {
  // inputs auto filled by create dynamic element
  @Input() editMode: boolean = false;
  @Input() pageItem!: PageItem;
  constructor() {}

  ngOnInit() {}
}
