import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageItem } from 'ngx-page-builder/core';

@Component({
  selector: 'preview-import-tree',
  templateUrl: './preview-import-tree.component.html',
  styleUrls: ['./preview-import-tree.component.scss'],
  imports: [CommonModule],
})
export class PreviewImportTreeComponent implements OnInit {
  @Input() item!: PageItem;
  isExpanded = false;

  constructor() {}

  ngOnInit() {}
  toggle() {
    this.isExpanded = !this.isExpanded;
  }
}
