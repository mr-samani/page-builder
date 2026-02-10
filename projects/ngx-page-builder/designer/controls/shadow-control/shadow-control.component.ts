import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  Injector,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  BoxShadow,
  formatBoxShadowToCSS,
  parseBoxShadow,
  validateColor,
} from './box-shadow-parser';
import { getOffsetPosition } from './get-offset-position';
import { NgxInputColorModule } from 'ngx-input-color';
import { BaseControl } from '../base-control';
import { SvgIconDirective } from '../../directives/svg-icon.directive';

@Component({
  selector: 'shadow-control',
  templateUrl: './shadow-control.component.html',
  styleUrls: ['./shadow-control.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, NgxInputColorModule, SvgIconDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ShadowControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShadowControlComponent extends BaseControl implements OnInit, AfterViewInit {
  @Input() currentClassName = '';

  @Input() maxRange = 25;

  padRect?: DOMRect;
  flashlightRect?: DOMRect;
  x = 0;
  y = 0;

  isDragging = false;
  selectedShadow?: BoxShadow;
  selectedIndex = 0;

  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();
  shadows: BoxShadow[] = [];
  popupPosition = { x: 0, y: 0 };
  showPopup = false;

  @ViewChild('pad', { static: false }) pad!: ElementRef<HTMLDivElement>;
  @ViewChild('flashlight', { static: false }) flashlight!: ElementRef<SVGSVGElement>;

  private radius: number = 0;
  center: { x: number; y: number } = { x: 0, y: 0 };
  result = '';

  constructor(
    injector: Injector,
    private cd: ChangeDetectorRef,
  ) {
    super(injector);
  }
  ngOnInit() {}
  ngAfterViewInit() {}
  writeValue(style: Partial<CSSStyleDeclaration>): void {
    if (!style) {
      style = {};
    }
    this.style = style;

    const val = this.style.boxShadow;
    if (!val) {
      this.shadows = [];
      this.result = '';
      return;
    }

    this.shadows = parseBoxShadow(val);
    this.result = formatBoxShadowToCSS(this.shadows);
    if (val !== this.result) {
      this.update();
    }
  }

  onPadClick(ev: MouseEvent | TouchEvent) {
    const position = getOffsetPosition(ev, this.pad.nativeElement);
    this.isDragging = true;
    this.updatePosition(position);
  }

  dragStart(ev: MouseEvent | TouchEvent) {
    ev.stopPropagation();
    ev.preventDefault();
    this.updateContainerDimensions();
    this.isDragging = true;
    const position = getOffsetPosition(ev, this.pad.nativeElement);
    this.updatePosition(position);
  }

  @HostListener('document:mouseup', ['$event'])
  @HostListener('document:touchend', ['$event'])
  onDragEnd(ev: MouseEvent | TouchEvent) {
    this.isDragging = false;
  }

  @HostListener('mousemove', ['$event'])
  @HostListener('touchmove', ['$event'])
  onMouseMove(ev: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;
    const position = getOffsetPosition(ev, this.pad.nativeElement);
    this.updatePosition(position);
  }

  private updatePosition(position: { x: number; y: number }) {
    const padRec = this.padRect!;
    const flashlightRec = this.flashlightRect!;

    const centerX = this.center.x;
    const centerY = this.center.y;

    const dx = position.x - centerX;
    const dy = position.y - centerY;

    // زاویه
    const angleRad = Math.atan2(dy, dx);
    const minX = flashlightRec.width / 2;
    const maxX = padRec.width - flashlightRec.width / 2;
    const minY = flashlightRec.height / 2;
    const maxY = padRec.height - flashlightRec.height / 2;
    const clampedX = Math.max(minX, Math.min(position.x, maxX));
    const clampedY = Math.max(minY, Math.min(position.y, maxY));

    // فقط یکبار از وسط اصلاح کن
    this.x = clampedX - flashlightRec.width / 2;
    this.y = clampedY - flashlightRec.height / 2;

    // ✅ ولی مقدار واقعی shadow رو از موقعیت موس (dx, dy) بگیر
    const halfRangeX = (padRec.width - flashlightRec.width) / 2;
    const halfRangeY = (padRec.height - flashlightRec.height) / 2;

    let valueX = (-dx / halfRangeX) * this.maxRange;
    let valueY = (-dy / halfRangeY) * this.maxRange;

    valueX = Math.round(Math.min(Math.max(valueX, -this.maxRange), this.maxRange));
    valueY = Math.round(Math.min(Math.max(valueY, -this.maxRange), this.maxRange));

    // چرخش چراغ قوه
    const angleDeg = angleRad * (180 / Math.PI);
    if (this.flashlight.nativeElement) {
      this.flashlight.nativeElement.style.transform = `rotate(${angleDeg + 180}deg)`;
    }

    // آپدیت shadow
    if (this.selectedShadow) {
      this.selectedShadow = {
        ...this.selectedShadow,
        xOffset: valueX,
        yOffset: valueY,
      };
      this.updateShadow(this.selectedShadow);
    }

    this.cd.detectChanges();
  }

  private updateContainerDimensions() {
    setTimeout(() => {
      if (!this.pad) return;
      this.padRect = this.pad.nativeElement.getBoundingClientRect();
      this.flashlightRect = this.flashlight.nativeElement.getBoundingClientRect();
      this.center = { x: this.padRect.width / 2, y: this.padRect.height / 2 };
      this.radius =
        Math.min(this.padRect.width, this.padRect.height) / 2 - this.flashlightRect.width / 2;
      this.x = 0; // Reset to center
      this.y = 0;
      this.cd.detectChanges();
    });
  }

  updateShadow(updatedShadow: Partial<BoxShadow>) {
    if (this.selectedIndex >= this.shadows.length) return;

    this.shadows[this.selectedIndex] = {
      ...this.shadows[this.selectedIndex],
      ...updatedShadow,
      color: validateColor(updatedShadow.color || this.shadows[this.selectedIndex].color),
    };
    this.selectedShadow!.cssValue = formatBoxShadowToCSS([this.selectedShadow!]);
    this.setXyFromShadow(this.selectedShadow!);
    this.update();
  }

  addShadow(container: HTMLElement) {
    this.shadows.push({
      xOffset: 0,
      yOffset: 0,
      blurRadius: 10,
      spreadRadius: 0,
      color: 'rgba(0, 0, 0, 0.5)',
      unit: 'px',
      inset: false,
    });
    this.update();
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
  }

  setShadow(el: HTMLElement, item: BoxShadow, index: number) {
    this.showPopup = true;
    this.selectedShadow = item;
    this.selectedIndex = index;
    this.popupPosition = el.getBoundingClientRect();
    const popupWidth = 320;
    const popupHeight = 420;
    let ww = window.innerWidth - 10;
    let wh = window.innerHeight - 10;
    if (this.popupPosition.x + popupWidth > ww) {
      this.popupPosition.x += ww - (this.popupPosition.x + popupWidth);
    }
    if (this.popupPosition.y + popupHeight > wh) {
      this.popupPosition.y += wh - (this.popupPosition.y + popupHeight);
    }
    this.setXyFromShadow(item);
  }

  setXyFromShadow(item: BoxShadow) {
    this.updateContainerDimensions();
    setTimeout(() => {
      const padRec = this.padRect!;
      const flashlightRec = this.flashlightRect!;
      const centerX = this.center.x;
      const centerY = this.center.y;

      const halfRangeX = (padRec.width - flashlightRec.width) / 2;
      const halfRangeY = (padRec.height - flashlightRec.height) / 2;

      // معکوس فرمول برای به‌دست آوردن dx , dy
      const dx = -(item.xOffset / this.maxRange) * halfRangeX;
      const dy = -(item.yOffset / this.maxRange) * halfRangeY;

      // موقعیت واقعی چراغ‌قوه
      const posX = centerX + dx;
      const posY = centerY + dy;

      this.x = posX - flashlightRec.width / 2;
      this.y = posY - flashlightRec.height / 2;

      // زاویه چراغ‌قوه
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = angleRad * (180 / Math.PI);
      if (this.flashlight.nativeElement) {
        this.flashlight.nativeElement.style.transform = `rotate(${angleDeg + 180}deg)`;
      }

      this.cd.detectChanges();
    });
  }
  removeShadow(ev: Event, index: number) {
    ev.stopPropagation();

    this.shadows.splice(index, 1);
    this.update();
  }

  private update() {
    this.result = formatBoxShadowToCSS(this.shadows);
    this.shadows.forEach((m) => (m.cssValue = formatBoxShadowToCSS([m])));

    this.style.boxShadow = this.result;

    this.onChange(this.style);
    this.change.emit(this.style);
    this.cls.updateClass(this.currentClassName, this.style);
  }
}
