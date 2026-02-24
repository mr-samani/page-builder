import {
  Component,
  ElementRef,
  Host,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  Renderer2,
} from '@angular/core';
import { InputGroupComponent } from './input-group.component';

@Component({
  selector: 'input-option',
  template: '<ng-content></ng-content>',
  styles: [
    `
      :host {
        all: unset;
        height: inherit;
        display: inline-flex;
        box-shadow:
          0px 0.5px 1px rgba(0, 0, 0, 0.8),
          inset 0px 0.5px 0.5px rgba(255, 255, 255, 0.12);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.13) 0%, rgba(255, 255, 255, 0.11) 100%);
        cursor: pointer;
        padding: 5px 15px;
        flex: auto;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        user-select: none;
        transition: background 0.15s ease;
      }
      :host(:hover:not(.active):not([disabled])) {
        background: linear-gradient(180deg, rgba(69, 69, 69, 0.13) 0%, rgba(34, 34, 34, 0.11) 100%);
      }
      :host(.active) {
        background: var(--active-button);
        color: var(--active-button-fg);
      }
      :host([disabled]) {
        opacity: 0.4;
        cursor: not-allowed;
        pointer-events: none;
      }
    `,
  ],
  standalone: false,
})
export class InputOptionComponent implements OnInit, OnDestroy {
  @Input() value: any;

  selected = false;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    // Optional: اگر بیرون از input-group استفاده شد، crash نکنه
    @Optional() @Host() private group: InputGroupComponent,
  ) {}

  ngOnInit(): void {
    this.group?.register(this);
  }

  ngOnDestroy(): void {
    this.group?.unregister(this);
  }

  @HostListener('click')
  onClick(): void {
    this.group?.select(this);
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    // مستقیم روی DOM — بدون نیاز به CD چون این component OnPush نیست
    if (selected) {
      this.renderer.addClass(this.el.nativeElement, 'active');
    } else {
      this.renderer.removeClass(this.el.nativeElement, 'active');
    }
  }

  setDisabled(disabled: boolean): void {
    if (disabled) {
      this.renderer.setAttribute(this.el.nativeElement, 'disabled', 'true');
    } else {
      this.renderer.removeAttribute(this.el.nativeElement, 'disabled');
    }
  }
}
