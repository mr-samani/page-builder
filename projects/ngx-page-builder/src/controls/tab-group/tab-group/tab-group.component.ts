import {
  AfterContentInit,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  Output,
  QueryList,
} from '@angular/core';
import { TabItemComponent } from '../tab-item/tab-item.component';

@Component({
  standalone: false,
  selector: 'tab-group',
  templateUrl: './tab-group.component.html',
  styleUrls: ['./tab-group.component.scss'],
})
export class TabGroupComponent implements AfterContentInit {
  @Input() showPlusButton = false;
  @Input() dontShowSingleTab = true;
  @Output() onAddTab = new EventEmitter();
  @Output() selectedIndex = new EventEmitter<number>();
  @ContentChildren(TabItemComponent) tabs?: QueryList<TabItemComponent>;
  rndId = Math.round(Math.random() * 5000);

  /** toggle tab item menu in tablet or mobile */
  openTabItemMenu = false;
  constructor(private chdr: ChangeDetectorRef) {}

  ngAfterContentInit() {
    setTimeout(() => {
      if (!this.tabs) return;
      // get all active tabs
      let activeTabs = this.tabs.filter((tab) => tab.active);
      // if there is no active tab set, activate the first
      if (activeTabs.length === 0) {
        this.selectTab(this.tabs.first, 0);
      }
    }, 0);
  }

  selectTab(tab: TabItemComponent, index: number) {
    if (!tab || !this.tabs) {
      return;
    }
    // deactivate all tabs
    this.tabs.toArray().forEach((tab) => (tab.active = false));
    // activate the tab the user has clicked on.
    tab.active = true;
    this.selectedIndex.emit(index);
    this.chdr.detectChanges();
  }

  onClickPlus() {
    this.onAddTab.emit();
  }
}
