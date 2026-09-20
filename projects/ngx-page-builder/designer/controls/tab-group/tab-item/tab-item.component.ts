import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  standalone: false,
  selector: 'tab-item',
  templateUrl: './tab-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./tab-item.component.scss'],
})
export class TabItemComponent implements OnInit {
  @Input() title: string = '';
  @Input() active = false;
  constructor() {}

  ngOnInit(): void {}
}
