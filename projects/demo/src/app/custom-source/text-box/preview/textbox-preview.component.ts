import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { PageItem, PagePreviewService } from 'ngx-page-builder/core';
import { createTextboxSettings, TextboxSettings } from '../shared/textbox.model';
import { attachTextboxValidation } from '../shared/textbox-validation';
import {
  applyTextboxAppearance,
  applyTextboxSettingsToTemplate,
  createTextboxTemplate,
  findTextboxRole,
} from '../shared/textbox-template';

@Component({
  selector: 'custom-textbox-preview',
  templateUrl: './textbox-preview.component.html',
  styleUrls: ['./textbox-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class PreviewTextboxComponent implements AfterViewInit, OnDestroy {
  @Input() pageItem!: PageItem;

  @ViewChild('content', { static: true }) private content!: ElementRef<HTMLDivElement>;

  private readonly preview = inject(PagePreviewService);
  private removeValidationListeners?: () => void;
  private destroyed = false;

  ngAfterViewInit(): void {
    void this.render();
  }

  private async render(): Promise<void> {
    if (this.destroyed) return;
    const settings = createTextboxSettings(this.pageItem.customComponent?.componentData as TextboxSettings | undefined);
    const storedTree = this.pageItem.children?.[0] ?? this.pageItem.template;
    let template: PageItem;
    if (storedTree) {
      template = new PageItem(storedTree, this.pageItem);
    } else {
      const defaultTemplate = createTextboxTemplate();
      applyTextboxAppearance(defaultTemplate, settings.appearance);
      template = new PageItem(defaultTemplate, this.pageItem);
    }

    applyTextboxAppearance(template, settings.appearance);
    applyTextboxSettingsToTemplate(template, settings, this.pageItem.id);
    this.pageItem.children = [template];

    await this.preview.createBlockElement(template, this.content.nativeElement);
    if (this.destroyed) return;

    const input = findTextboxRole(template, 'input')?.el as HTMLInputElement | undefined;
    const error = findTextboxRole(template, 'error')?.el ?? null;
    this.removeValidationListeners = attachTextboxValidation(input ?? null, error, settings, false);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.removeValidationListeners?.();
    // PagePreviewService's DynamicElementService owns and destroys the rendered PageItem tree.
  }
}
