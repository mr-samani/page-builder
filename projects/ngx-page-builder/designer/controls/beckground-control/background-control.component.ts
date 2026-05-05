import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  inject,
  Inject,
  Injector,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IPageBuilderFilePicker } from '../../services/file-picker/IFilePicker';
import { NGX_PAGE_BUILDER_FILE_PICKER } from '../../services/file-picker/token.filepicker';
import { BaseControl } from '../base-control';
import { Notify } from '../../extensions/notify';
import { parseBackground } from 'ngx-page-builder/core';
import { InputCssComponent } from '../input-css/input-css.component';

@Component({
  selector: 'background-control',
  templateUrl: './background-control.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BackgroundControlComponent),
      multi: true,
    },
  ],
  standalone: true,
  imports: [FormsModule, InputCssComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackgroundControlComponent extends BaseControl implements OnInit, ControlValueAccessor {
  @Input() currentClassName = '';
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  backgroundGradient = '';
  /** css bacground-image  */
  backgroundImage = '';
  private filePicker = inject<IPageBuilderFilePicker | null>(NGX_PAGE_BUILDER_FILE_PICKER);
  constructor(
    injector: Injector,
    private cdr: ChangeDetectorRef,
  ) {
    super(injector);
  }

  ngOnInit() {}

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    if (!style) {
      style = {};
    }
    this.style = style;
    const backgroundFull = style.background || style.backgroundImage || '';
    const parsed = parseBackground(backgroundFull);

    this.backgroundGradient = parsed.gradient ?? '';
    this.backgroundImage = parsed.image ?? '';
    this.style.backgroundColor = style.backgroundColor || parsed.color;
    if (this.style.backgroundColor == style.background) {
      style.background = '';
    }

    this.cdr.detectChanges();
  }

  update() {
    if (this.backgroundGradient) {
      this.style.backgroundImage = this.backgroundGradient;
    } else {
      this.style.backgroundImage = this.backgroundImage;
    }
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cls.updateClass(this.currentClassName, this.style);
  }

  openImagePicker() {
    if (!this.filePicker) {
      console.warn('Provider for file picker is not available');
      Notify.warning('Provider for file picker is not available');
      return;
    }
    this.filePicker.openFilePicker('image').then((result) => {
      // TODO base address must be set with pipe
      this.backgroundImage = `url(${this.filePicker?.baseUrlAddress + result})`;
      this.update();
    });
  }

  clear(property: string) {
    (this.style as any)[property] = undefined;
    if ((this as any)[property]) {
      (this as any)[property] = undefined;
    }
    this.update();
  }
}
