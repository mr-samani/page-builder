import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'input-range',
  standalone: true,
  template: `
    <div class="input-range">
      <input type="range" [value]="value" (input)="onInput($event)" />
      <span>range:{{ value }}</span>
    </div>
  `,
})
export class InpurRangeComponent {
  @Input() value = 50;
  @Output() valueChange = new EventEmitter<number>();

  onInput(event: any) {
    const val = +event.target.value;
    this.value = val;
    this.valueChange.emit(val);
    console.log('slider :', val);
  }
}
