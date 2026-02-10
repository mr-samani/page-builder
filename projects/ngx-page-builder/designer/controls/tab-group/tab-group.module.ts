import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabGroupComponent } from './tab-group/tab-group.component';
import { TabItemComponent } from './tab-item/tab-item.component';

@NgModule({
  declarations: [TabGroupComponent, TabItemComponent],
  imports: [CommonModule],
  exports: [TabGroupComponent, TabItemComponent],
})
export class TabGroupModule {}
