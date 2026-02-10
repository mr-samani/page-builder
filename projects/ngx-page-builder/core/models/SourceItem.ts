import { Type } from '@angular/core';
import { CustomComponent } from './CustomComponent';
export class Directive {
  directive!: Type<any>;
  inputs?: Record<string, any> | undefined;
  outputs?: Record<string, Function> | undefined;
}

export interface ISourceOptions<CUSTOM_DATA = any> {
  events?: Record<string, (event: any) => boolean | void>;
  directives?: Directive[];

  /**
   * Html attributs
   * @example
   * {
   *   "class": "my-class",
   *   "id": "my-id"
   * }
   */
  attributes?: Record<string, any> | undefined;
  /**
   * Component inputs
   * - @Input()
   * @example
   * {
   *   "input1": "value1",
   *   "input2": "value2"
   * }
   */
  inputs?: Record<string, any> | undefined;
  /**
   * Component outputs
   * - @Output()
   * @example
   * {
   *   "output1": ($event)=>{ console.log($event); },
   * }
   */
  outputs?: Record<string, Function> | undefined;

  customData?: CUSTOM_DATA;
}

export class SourceItem {
  /**
   * Html tags
   * @example 'div'
   * */
  tag!: string; // 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'img' | 'input' = 'div';
  /**
   * can have child elements
   * like div, section,...
   * @example true
   */
  canHaveChild?: boolean;
  /**
   *  Display title
   * @example 'My Chart'
   * */
  title?: string;
  /**
   * Block icon
   * @example <svg>...</svg>
   */
  icon: string = '';

  /**
   * Text content of html tags
   */
  content?: string;

  options?: ISourceOptions;

  /**
   * Disable movement of the source item
   * @example pagebreak cannot move to child items
   */
  disableMovement?: boolean = false;

  customComponent?: CustomComponent;

  css?: string;
  classList?: string[];
  constructor(data?: SourceItem) {
    if (data) {
      for (var property in data) {
        if (this.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
