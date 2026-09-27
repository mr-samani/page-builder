import { Component, inject, OnInit } from '@angular/core';
import { HistoryService, HistoryEntry } from '../../services/history/history.service';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
})
export class HistoryComponent implements OnInit {
  protected readonly history = inject(HistoryService);

  list: HistoryEntry[] = this.history.getHistory();
  constructor() {}

  ngOnInit() {}
}
