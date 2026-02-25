import { AfterViewInit, Directive, DOCUMENT, HostListener, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { NgxDraggableDirective } from 'ngx-drag-drop-kit';
import { PageItem } from 'ngx-page-builder/core';

@Directive({
  selector: '[InlineEditText]',
})
export class InlineEditTextDirective implements AfterViewInit, OnDestroy {
  @Input() pageItem!: PageItem;

  doc = inject(DOCUMENT);
  dragDir?: NgxDraggableDirective;

  private previousContent?: string = '';
  private keydownHandler!: (ev: KeyboardEvent) => void;
  private dblClickHandler!: () => void;
  private documentClickHandler!: () => void;

  ngAfterViewInit(): void {
    if (!this.pageItem.el) return;

    this.keydownHandler = this.checkCancelEdit.bind(this);
    this.dblClickHandler = this.onDblclick.bind(this);
    this.documentClickHandler = this.onDocumentClick.bind(this);

    this.pageItem.el.addEventListener('dblclick', this.dblClickHandler);

    this.dragDir = (this.pageItem.el as any)?.__ngDirectives__?.find((x: any) => x instanceof NgxDraggableDirective);
  }

  ngOnDestroy(): void {
    if (!this.pageItem.el) return;

    this.pageItem.el.removeEventListener('dblclick', this.dblClickHandler);
    this.pageItem.el.removeEventListener('keydown', this.keydownHandler);
    this.doc.removeEventListener('click', this.documentClickHandler);
  }

  onDblclick() {
    if (!this.pageItem.el) return;

    this.pageItem.el.contentEditable = 'true';
    this.dragDir && (this.dragDir.disabled = true);
    this.pageItem.el.focus();

    this.previousContent = this.pageItem.content;
    this.pageItem.el.addEventListener('keydown', this.keydownHandler);
    this.doc.addEventListener('click', this.documentClickHandler);
  }

  checkCancelEdit(ev: KeyboardEvent) {
    if (ev.key === 'Escape' && this.pageItem.el) {
      this.pageItem.el.innerHTML = this.previousContent ?? '';
      this.onDocumentClick();
    }
  }

  onDocumentClick() {
    if (!this.pageItem.el) return;

    this.pageItem.content = this.pageItem.el.innerHTML;
    this.pageItem.el.removeAttribute('contentEditable');
    this.dragDir && (this.dragDir.disabled = false);
    this.pageItem.el.removeEventListener('keydown', this.keydownHandler);
    this.doc.removeEventListener('click', this.documentClickHandler);
  }
}
