import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, input, model } from '@angular/core';

@Component({
  selector: 'input-range',
  standalone: true,
  template: `
    <div class="input-range">
      <p>{{ name }}</p>
      <input type="range" [attr.value]="value()" (input)="onInput($event)" />
      <span class="range-value">range:{{ value() }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .range-value {
      padding: 15px;
      color: orangered;
    }
  `,
})
export class InpurRangeComponent {
  @Input() name = 'ali';
  readonly value = model(50);

  onInput(event: any) {
    const val = +event.target.value;
    this.value.set(val);
    console.log('slider :', val);
  }
}
