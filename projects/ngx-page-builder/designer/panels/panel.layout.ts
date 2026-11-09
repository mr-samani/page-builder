import { Component, inject, input } from '@angular/core';
import { PanelService } from './panel.service';
import { NgxIconComponent } from 'ngx-page-builder/icons';

@Component({
  selector: 'pb-panel',
  imports: [NgxIconComponent],
  template: `
    <div class="pb-panel">
      <div class="pb-panel-header">
        <div class="panel-heading">
          <strong>{{ label() }}</strong>
          <small>{{ description() }}</small>
        </div>

        <button type="button" (click)="panelService.close()" class="pb-btn" aria-label="Close layouts">
          <ngx-icon icon="xmark" />
        </button>
      </div>
      <div class="pb-pabel-body">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 0;
      height: 100%;
    }
    .pb-panel {
      /*   position: fixed;
         top: var(--topbar-height);
         left: var(--toolbar-width);
         */
      background-color: var(--panel-bg);
      width: 100%;
      height: 100%;
      border-radius: 5px;
      border: 1px solid #2b2f34;
      /*   height: calc(100% - var(--topbar-height));*/
      z-index: 20;
      box-shadow: 0 12px 36px #0005;
      display: grid;
      grid-template-rows: 50px minmax(0, 1fr);
      min-height: 0;

      .pb-panel-header {
        border-bottom: 1px #2b2f34 solid;
        padding: 6px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .pb-pabel-body {
        min-height: 0;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: color-mix(in srgb, currentColor 24%, transparent) transparent;
      }

      .panel-heading {
        display: grid;
        gap: 2px;
      }
      .panel-heading strong {
        font-size: 12px;
      }
      .panel-heading small {
        color: color-mix(in srgb, currentColor 55%, transparent);
        font-size: 9px;
      }

      .pb-btn {
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        padding: 4px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        svg {
          width: 16px;
          height: 16px;
        }
        &:hover {
          background: color-mix(in srgb, currentColor 10%, transparent);
        }
      }
    }
  `,
})
export class PbPanel {
  readonly label = input.required<string>();
  readonly description = input<string>();
  readonly panelService = inject(PanelService);
}
