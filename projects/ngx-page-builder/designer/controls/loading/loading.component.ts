import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
})
export class LoadingComponent implements OnInit {
  @Input() loading = false;
  @Input() borderColor = '#056edb';
  @Input() borderBgColor = '#82b7ef';
  @Input() diameter = 16;
  @Input() borderSize = 2;

  constructor() {}

  ngOnInit(): void {}
}
