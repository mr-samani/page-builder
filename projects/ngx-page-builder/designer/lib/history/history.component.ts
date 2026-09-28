import { Component, OnInit } from '@angular/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
})
export class HistoryComponent extends PageBuilderBaseComponent implements OnInit {
  list = this.history.getHistory();

  ngOnInit() {}
}
