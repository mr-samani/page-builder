import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, forwardRef, Output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { BaseControl } from '../base-control';
import { HtmlSanitizer } from 'ngx-page-builder/core';

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

type LayoutMode = 'block' | 'flex' | 'grid' | 'inline' | 'advanced';

interface LayoutOption {
  value: string;
  label: string;
  icon: string;
  description?: string;
}

@Component({
  selector: 'display-control',
  standalone: true,
  imports: [FormsModule, HtmlSanitizer],
  templateUrl: './display-control.component.html',
  styleUrl: './display-control.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DisplayControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisplayControlComponent extends BaseControl implements ControlValueAccessor {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  advanced = false;

  readonly layoutModes: LayoutOption[] = [
    {
      value: 'block',
      label: 'Block',
      icon: '▣',
      description: 'One item per line',
    },
    {
      value: 'flex',
      label: 'Flex',
      icon: '⇆',
      description: 'Arrange items in one direction',
    },
    {
      value: 'grid',
      label: 'Grid',
      icon: '▦',
      description: 'Arrange items in rows and columns',
    },
    {
      value: 'inline',
      label: 'Inline',
      icon: '↔',
      description: 'Flow with surrounding content',
    },
  ];

  readonly directions: LayoutOption[] = [
    {
      value: 'row',
      label: 'Horizontal',
      icon: '→',
      description: 'Left to right',
    },
    {
      value: 'row-reverse',
      label: 'Horizontal Reverse',
      icon: '←',
    },
    {
      value: 'column',
      label: 'Vertical',
      icon: '↓',
      description: 'Top to bottom',
    },
    {
      value: 'column-reverse',
      label: 'Vertical Reverse',
      icon: '↑',
    },
  ];

  readonly alignmentOptions: LayoutOption[] = [
    {
      value: 'flex-start',
      label: 'Start',
      icon: '⫷',
    },
    {
      value: 'center',
      label: 'Center',
      icon: '≡',
    },
    {
      value: 'flex-end',
      label: 'End',
      icon: '⫸',
    },
    {
      value: 'space-between',
      label: 'Between',
      icon: '⇤ ⇥',
    },
    {
      value: 'space-around',
      label: 'Around',
      icon: '⇠ ⇢',
    },
    {
      value: 'space-evenly',
      label: 'Evenly',
      icon: '↔',
    },
  ];

  readonly crossAlignmentOptions: LayoutOption[] = [
    {
      value: 'flex-start',
      label: 'Start',
      icon: '↑',
    },
    {
      value: 'center',
      label: 'Center',
      icon: '↕',
    },
    {
      value: 'flex-end',
      label: 'End',
      icon: '↓',
    },
    {
      value: 'stretch',
      label: 'Stretch',
      icon: '↕',
    },
    {
      value: 'baseline',
      label: 'Baseline',
      icon: '≡',
    },
  ];

  readonly wrapOptions: LayoutOption[] = [
    {
      value: 'nowrap',
      label: 'No wrap',
      icon: '→',
    },
    {
      value: 'wrap',
      label: 'Wrap',
      icon: '<svg data-wf-icon="FlexFlowWrapIcon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g><path d="M14.207 11.5L10.8535 14.8535L10.1465 14.1465L12.293 12H3V11H12.293L10.1465 8.85352L10.8535 8.14648L14.207 11.5ZM11 4H3V3H11V4Z" fill="currentColor"></path><path opacity="0.4" d="M11 4.20703L4.20703 11H3V10.793L9.79297 4H11V4.20703Z" fill="currentColor"></path></g></svg>',
    },
    {
      value: 'wrap-reverse',
      label: 'Reverse',
      icon: '↗',
    },
  ];

  readonly gridColumnPresets: LayoutOption[] = [
    {
      value: 'repeat(1, 1fr)',
      label: '1',
      icon: '▯',
    },
    {
      value: 'repeat(2, 1fr)',
      label: '2',
      icon: '▯▯',
    },
    {
      value: 'repeat(3, 1fr)',
      label: '3',
      icon: '▯▯▯',
    },
    {
      value: 'repeat(4, 1fr)',
      label: '4',
      icon: '▯▯▯▯',
    },
    {
      value: 'repeat(6, 1fr)',
      label: '6',
      icon: '▯▯▯▯▯▯',
    },
  ];

  constructor(private readonly cdr: ChangeDetectorRef) {
    super();
  }

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.cdr.markForCheck();
  }

  get display(): DisplayType {
    return (this.style.display as DisplayType) || 'block';
  }

  get isFlexLayout(): boolean {
    return this.display === 'flex' || this.display === 'inline-flex';
  }

  get isGridLayout(): boolean {
    return this.display === 'grid' || this.display === 'inline-grid';
  }

  get isInlineLayout(): boolean {
    return (
      this.display === 'inline' ||
      this.display === 'inline-block' ||
      this.display === 'inline-flex' ||
      this.display === 'inline-grid'
    );
  }

  selectLayout(display: string): void {
    this.style.display = display;

    if (display === 'flex' || display === 'inline-flex') {
      this.ensureFlexDefaults();
    }

    if (display === 'grid' || display === 'inline-grid') {
      this.ensureGridDefaults();
    }

    this.update();
  }

  private ensureFlexDefaults(): void {
    this.style.flexDirection ??= 'row';
    this.style.flexWrap ??= 'nowrap';
    this.style.justifyContent ??= 'flex-start';
    this.style.alignItems ??= 'stretch';
  }

  private ensureGridDefaults(): void {
    this.style.gridTemplateColumns ??= 'repeat(2, 1fr)';
    this.style.gridTemplateRows ??= 'auto';
    this.style.gap ??= '0px';
  }

  setDirection(value: string): void {
    this.style.flexDirection = value;
    this.update();
  }

  setJustify(value: string): void {
    this.style.justifyContent = value;
    this.update();
  }

  setAlign(value: string): void {
    this.style.alignItems = value;
    this.update();
  }

  setWrap(value: string): void {
    this.style.flexWrap = value;
    this.update();
  }

  setGridColumns(value: string): void {
    this.style.gridTemplateColumns = value;
    this.update();
  }

  setGridPreset(value: string): void {
    this.style.gridTemplateColumns = value;
    this.update();
  }

  setNumber(property: keyof CSSStyleDeclaration, value: string): void {
    (this.style as any)[property] = value as never;
    this.update();
  }

  update(): void {
    this.onChange(this.style);
    this.change.emit(this.style);
  }

  clear(property: keyof CSSStyleDeclaration): void {
    delete this.style[property];
    this.update();
  }

  toggleAdvanced(): void {
    this.advanced = !this.advanced;
    this.cdr.markForCheck();
  }
}
