import { Component, OnInit } from '@angular/core';
import { PageBuilderService } from '../../services/page-builder.service';
import { IDropEvent, moveItemInArray, NgxDragDropKitModule } from 'ngx-drag-drop-kit';
import { MatButtonModule } from '@angular/material/button';
import { Page } from 'ngx-page-builder/core';
import { NgxDialogModule, NgxDialogRef } from '../../extensions/dialog';

@Component({
  selector: 'app-sort-page-list',
  templateUrl: './sort-page-list.component.html',
  styleUrls: ['./sort-page-list.component.scss'],
  standalone: true,
  imports: [NgxDialogModule, NgxDragDropKitModule, MatButtonModule],
})
export class SortPageListComponent implements OnInit {
  pageList: Page[] = [];
  constructor(
    private dialogRef: NgxDialogRef,
    private pb: PageBuilderService,
  ) {
    this.pageList = [...(pb.pageInfo.pages ?? [])];
    this.pageList.map((m: Page, index: number) => (m.order = index));
  }

  ngOnInit() {}

  ok() {
    this.pb.pageInfo.pages = this.pageList;
    this.dialogRef.close(true);
  }
  onDrop(event: IDropEvent) {
    if (event.previousIndex == event.currentIndex) {
      return;
    }
    moveItemInArray(this.pageList, event.previousIndex, event.currentIndex);
  }
}
