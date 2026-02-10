import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Injector,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { BaseControl } from '../base-control';

interface ISelectOption {
  value: string;
  label: string;
  icon: string;
}
export type DisplayType =
  | 'block'
  | 'inline'
  | 'inline-block'
  | 'flex'
  | 'inline-flex'
  | 'grid'
  | 'inline-grid'
  | 'table'
  | 'table-row'
  | 'table-cell'
  | 'none'
  | 'contents'
  | 'flow-root';

@Component({
  selector: 'display-control',
  templateUrl: './display-control.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DisplayControlComponent),
      multi: true,
    },
  ],
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisplayControlComponent extends BaseControl implements OnInit, ControlValueAccessor {
  @Input() currentClassName = '';

  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  // Display Mode Options
  displayOptions: ISelectOption[] = [
    { value: 'block', label: 'Block', icon: '▭' },
    { value: 'inline', label: 'Inline', icon: '═' },
    { value: 'inline-block', label: 'Inline Block', icon: '▢' },
    { value: 'flex', label: 'Flex', icon: '⫴' },
    { value: 'inline-flex', label: 'Inline Flex', icon: '⫴' },
    { value: 'grid', label: 'Grid', icon: '▦' },
    { value: 'inline-grid', label: 'Inline Grid', icon: '▦' },
    { value: 'table', label: 'Table', icon: '⊞' },
    { value: 'table-row', label: 'Table Row', icon: '━' },
    { value: 'table-cell', label: 'Table Cell', icon: '□' },
    { value: 'none', label: 'None', icon: '⊗' },
    { value: 'contents', label: 'Contents', icon: '⋯' },
    { value: 'flow-root', label: 'Flow Root', icon: '↯' },
  ];

  justifyOptions: ISelectOption[] = [
    { value: 'flex-start', label: 'Start', icon: '⫷|||' },
    { value: 'center', label: 'Center', icon: '|⫷|⫸|' },
    { value: 'flex-end', label: 'End', icon: '|||⫸' },
    { value: 'space-between', label: 'Between', icon: '|⫷⫷|' },
    { value: 'space-around', label: 'Around', icon: '⫷|⫷|⫷' },
    { value: 'space-evenly', label: 'Evenly', icon: '⫷|⫷|⫷' },
  ];

  alignOptions: ISelectOption[] = [
    { value: 'flex-start', label: 'Start', icon: '' },
    { value: 'center', label: 'Center', icon: '' },
    { value: 'flex-end', label: 'End', icon: '' },
    { value: 'stretch', label: 'Stretch', icon: '' },
    { value: 'baseline', label: 'Baseline', icon: '' },
  ];
  alignContentOptions: ISelectOption[] = [
    { value: 'flex-start', label: 'Flex Start', icon: '' },
    { value: 'flex-end', label: 'Flex End', icon: '' },
    { value: 'center', label: 'Center', icon: '' },
    { value: 'space-between', label: 'Space Between', icon: '' },
    { value: 'space-around', label: 'Space Around', icon: '' },
    { value: 'stretch', label: 'Stretch', icon: '' },
  ];

  alignSelfOptions: ISelectOption[] = [
    { value: 'auto', label: 'Auto', icon: '' },
    { value: 'flex-start', label: 'Flex Start', icon: '' },
    { value: 'flex-end', label: 'Flex End', icon: '' },
    { value: 'center', label: 'Center', icon: '' },
    { value: 'baseline', label: 'Baseline', icon: '' },
    { value: 'stretch', label: 'Stretch', icon: '' },
  ];

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
    this.cdr.detectChanges();
  }

  setDisplay(displayType: DisplayType) {
    this.update();
  }

  update() {
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cls.updateClass(this.currentClassName, this.style);
  }

  isFlex(): boolean {
    return this.style.display === 'flex' || this.style.display === 'inline-flex';
  }

  isGrid(): boolean {
    return this.style.display === 'grid' || this.style.display === 'inline-grid';
  }

  isTable(): boolean {
    return this.style.display?.includes('table') == true;
  }

  // Quick Flex Presets
  setFlexPreset(preset: string) {
    switch (preset) {
      case 'row-start':
        this.style.flexDirection = 'row';
        this.style.justifyContent = 'flex-start';
        this.style.alignItems = 'flex-start';
        break;
      case 'row-center':
        this.style.flexDirection = 'row';
        this.style.justifyContent = 'center';
        this.style.alignItems = 'center';
        break;
      case 'row-between':
        this.style.flexDirection = 'row';
        this.style.justifyContent = 'space-between';
        this.style.alignItems = 'center';
        break;
      case 'column-start':
        this.style.flexDirection = 'column';
        this.style.justifyContent = 'flex-start';
        this.style.alignItems = 'flex-start';
        break;
      case 'column-center':
        this.style.flexDirection = 'column';
        this.style.justifyContent = 'center';
        this.style.alignItems = 'center';
        break;
    }
    this.update();
  }

  // Quick Grid Presets
  setGridPreset(preset: string) {
    switch (preset) {
      case '2-col':
        this.style.gridTemplateColumns = 'repeat(2, 1fr)';
        break;
      case '3-col':
        this.style.gridTemplateColumns = 'repeat(3, 1fr)';
        break;
      case '4-col':
        this.style.gridTemplateColumns = 'repeat(4, 1fr)';
        break;
      case 'auto-fill':
        this.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        break;
      case 'auto-fit':
        this.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        break;
    }
    this.update();
  }

  clear(property: any) {
    this.style[property] = undefined;
  }
}
