import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, HostListener, inject, Inject, OnInit } from '@angular/core';
import { NgxDialogRef } from '../ngx-dialog-ref';

@Directive({
  standalone: false,
  selector: '[ngx-dialog-body],[ngxDialogBody]',
  host: {
    class: 'dialog-body',
    '[style.height.px]': 'height',
  },
  exportAs: 'ngxDialogBody',
})
export class NgxDialogBodyDirective implements OnInit {
  height?: number;

  private _dialogRef = inject(NgxDialogRef);
  constructor(
    public _el: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  ngOnInit(): void {
    this._dialogRef.body = this._el;
    setTimeout(() => {
      this.onWindowResize();
      if (this._dialogRef.dialog && this._dialogRef.dialog.nativeElement) {
        new ResizeObserver(() => {
          this.onWindowResize();
        }).observe(this._dialogRef.dialog.nativeElement);
      }
    }, 100);
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(ev?: Event) {
    let headerH = 0;
    let footerH = 0;
    let dialogH = window.innerHeight;
    if (this._dialogRef.header) {
      headerH = this._dialogRef.header.nativeElement.offsetHeight;
    }
    if (this._dialogRef.footer) {
      footerH = this._dialogRef.footer.nativeElement.offsetHeight;
    }
    if (this._dialogRef.dialog && this._dialogRef.dialog.nativeElement.offsetHeight < dialogH) {
      dialogH = this._dialogRef.dialog.nativeElement.offsetHeight;
    }
    this.height = dialogH - headerH - footerH;
  }
}
