import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { PageBuilderService } from '../../services/page-builder.service';
import { Page } from 'ngx-page-builder/core';
import { DIALOG_REF, NgxDialogModule } from 'ngx-kit/dialog';
import { moveItemInArray, NgxDropList, IDropEvent, NgxDropListGroup } from 'ngx-kit/drag-resize';

@Component({
  selector: 'app-sort-page-list',
  templateUrl: './sort-page-list.component.html',
  styleUrls: ['./sort-page-list.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxDialogModule, NgxDropList, NgxDropListGroup],
})
export class SortPageListComponent implements OnInit {
  pageList: Page[] = [];
  private dialogRef = inject(DIALOG_REF);
  protected readonly pb = inject(PageBuilderService);

  constructor() {
    this.pageList = [...(this.pb.pageInfo.pages ?? [])];
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
