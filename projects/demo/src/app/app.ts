import { Component, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
})
export class App {
  filePicker = viewChild<HTMLInputElement>('filePicker');
  protected readonly title = signal('demo');

  imageChooserFn() {
    const filePicker = this.filePicker();
    if (filePicker) {
      filePicker.click();
    }
  }
}
