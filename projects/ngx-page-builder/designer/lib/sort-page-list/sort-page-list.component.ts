import { Component, inject, OnInit } from '@angular/core';
import { PageBuilderService } from '../../services/page-builder.service';
import { IDropEvent, moveItemInArray, NgxDragDropKitModule } from 'ngx-drag-drop-kit';
import { Page } from 'ngx-page-builder/core';
import { DIALOG_REF, NgxDialogModule } from '../../extensions/dialog';

@Component({
  selector: 'app-sort-page-list',
  templateUrl: './sort-page-list.component.html',
  styleUrls: ['./sort-page-list.component.scss'],
  standalone: true,
  imports: [NgxDialogModule, NgxDragDropKitModule],
})
export class SortPageListComponent implements OnInit {
  pageList: Page[] = [];
  private dialogRef = inject(DIALOG_REF);

  constructor(private pb: PageBuilderService) {
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

  cancel() {
    this.dialogRef.close();
  }
}
