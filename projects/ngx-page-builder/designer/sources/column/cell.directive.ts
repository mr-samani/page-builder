import { Directive, OnInit } from '@angular/core';

@Directive({
  selector: '[Cell]',
})
export class CellDirective implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
