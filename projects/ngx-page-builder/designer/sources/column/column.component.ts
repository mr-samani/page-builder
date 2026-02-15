import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgxDragDropKitModule } from 'ngx-drag-drop-kit';
import { PageBuilderService } from '../../services/page-builder.service';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { PageItem } from 'ngx-page-builder/core';

@Component({
  selector: 'page-column',
  templateUrl: './column.component.html',
  styleUrls: ['./column.component.scss'],
  imports: [NgxDragDropKitModule, SvgIconDirective],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnComponent implements OnInit {
  // inputs auto filled by create dynamic element
  @Input() editMode: boolean = false;
  @Input() pageItem!: PageItem;

  @ViewChild('colContainer', { static: true }) colContainer!: ElementRef<HTMLDivElement>;
  constructor(public pageBuilder: PageBuilderService) {}

  ngOnInit() {
    if (this.pageItem.children.length == 0) {
      this.addNewColumn();
      this.addNewColumn();
    } else {
      this.loadCols();
    }
  }
  async loadCols() {
    for (const child of this.pageItem.children) {
      let el = await this.pageBuilder.createBlockElement(
        this.editMode,
        child,
        this.colContainer.nativeElement
      );
    }
  }

  addNewColumn(index?: number) {
    const newColumn = new PageItem(
      {
        tag: 'div',
        canHaveChild: true,
        options: {
          attributes: {
            class: 'col-item',
          },
        },
      },
      this.pageItem
    );
    this.pageBuilder.createBlockElement(
      this.editMode,
      newColumn,
      this.colContainer.nativeElement,
      index
    );
    this.pageItem.children.splice(index ?? this.pageItem.children.length, 0, newColumn);
  }

  addColumnToLast() {
    this.addNewColumn(this.pageItem.children.length);
  }
  addColumnToFirst() {
    this.addNewColumn(0);
  }
}
