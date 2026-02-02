import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  viewChild,
} from '@angular/core';
declare const bootstrap: any;
@Component({
  selector: 'blc-slider',
  templateUrl: './slider.component.html',
  styles: `
    .carousel-item {
      height: 500px;
    }
  `,
  imports: [CommonModule],
})
export class SliderComponent implements AfterViewInit, OnDestroy {
  constructor(private chdr: ChangeDetectorRef) {}
  @ViewChild('myCarousel') myCarousel!: ElementRef<HTMLElement>;
  carouselId = 'carousel-' + crypto.randomUUID();
  slider: any = {};
  ngAfterViewInit(): void {
    setTimeout(() => {
      const el = this.myCarousel.nativeElement;
      debugger;
      bootstrap.Carousel.getInstance(el)?.dispose();

      this.slider = new bootstrap.Carousel(el, {
        interval: 4000,
        wrap: true,
      });

      this.chdr.detectChanges();
    });
  }

  ngOnDestroy() {
    if (this.slider) {
      this.slider.dispose();
    }
  }

  next() {
    debugger;
    this.slider.next();
  }
}
