import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  ElementRef,
  Inject,
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
  @ViewChild('myCarousel') myCarousel!: ElementRef<HTMLElement>;
  carouselId = 'carousel-' + crypto.randomUUID();
  slider: any = {};
  constructor(private chdr: ChangeDetectorRef, @Inject(DOCUMENT) private doc: Document) {}
  ngOnDestroy(): void {
    throw new Error('Method not implemented.');
  }
  ngAfterViewInit(): void {
    //this.doc.addEventListener('DOMContentLoaded', () => this.loadSlider());
  }

  // loadSlider() {
  //   setTimeout(() => {
  //     const el = this.myCarousel.nativeElement;
  //     bootstrap.Carousel.getInstance(el)?.dispose();

  //     this.slider = new bootstrap.Carousel(el, {
  //       interval: 4000,
  //       wrap: true,
  //     });

  //     this.chdr.detectChanges();
  //   });
  // }

  // ngOnDestroy() {
  //   if (this.slider) {
  //     this.slider.dispose();
  //   }
  // }

  // next() {
  //   this.slider.next();
  // }
}
