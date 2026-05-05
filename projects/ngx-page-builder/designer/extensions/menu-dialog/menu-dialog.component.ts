import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { getInsetPosition } from './getInsetPosition';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'menu-dialog',
  templateUrl: './menu-dialog.component.html',
  styleUrls: ['./menu-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class MenuDialog {
  target = input<HTMLElement>();
  private dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  isOpen = false;

  private chdr = inject(ChangeDetectorRef);
  constructor() {}

  showModal() {
    const dialog = this.dialog()?.nativeElement;
    const target = this.target();
    if (!dialog) return;

    dialog.showModal();
    this.isOpen = true;
    this.chdr.detectChanges();

    if (target) {
      dialog.style.position = 'absolute';
      dialog.style.inset = getInsetPosition(target, dialog);
    }

    document.addEventListener('click', this.handleDocEvent.bind(this));
  }

  closeModal() {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;

    dialog.close();
    this.isOpen = false;
    this.chdr.detectChanges();
    document.removeEventListener('click', this.handleDocEvent.bind(this));
  }

  private handleDocEvent(event: PointerEvent) {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;
    const target = event.target;

    // The click target _must_ be the dialog element itself, and not elements underneath or inside.
    if (target !== dialog || !dialog?.open) return;
    // If the dialog contains a form, do not close the dialog when clicking outside of the dialog
    if (dialog.querySelector('form')) return;
    const rect = dialog.getBoundingClientRect();
    const clickWasInsideDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!clickWasInsideDialog) {
      dialog.close();
    }
  }
}
