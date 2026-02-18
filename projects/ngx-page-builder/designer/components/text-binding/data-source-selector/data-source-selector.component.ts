import { ChangeDetectorRef, Component, EventEmitter, Input, input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicDataStructure } from 'ngx-page-builder/core';

@Component({
  selector: 'data-source-selector',
  templateUrl: './data-source-selector.component.html',
  imports: [FormsModule],
})
export class DataSourceSelectorComponent implements OnInit {
  @Input() title = 'Data source';
  @Input() list: DynamicDataStructure[] = [];

  selectedItem: string = '';
  childs: DynamicDataStructure[] = [];

  @Input('selectedItem') set setSelectedItem(value: string | undefined) {
    setTimeout(() => {
      const parts = (value ?? '').trim().split('.');
      this.selectedItem = parts[0];
      this.childs = this.list.find((x: DynamicDataStructure) => x.name === this.selectedItem)?.values || [];
      this.selectedChild = parts.splice(1).join('.');
      this.chdr.detectChanges();
    }, 0);
  }

  @Output() selectedKey = new EventEmitter<string[]>();

  selectedChild?: string = '';

  constructor(private chdr: ChangeDetectorRef) {}

  ngOnInit() {}

  onChange() {
    let selected = this.list.find((item) => item.name === this.selectedItem);
    this.childs = selected ? selected.values || [] : [];
    this.selectedKey.emit([this.selectedItem]);
  }
  onChangeKey(event: string[]) {
    let array = [this.selectedItem, ...event];
    this.selectedKey.emit(array);
  }
}
