import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PageItem, SourceSettingField } from 'ngx-page-builder/core';
import { PageBuilderBaseComponent } from '../../lib/page-builder-base-component';
import { NgxInputColor } from 'ngx-kit/color-picker';

interface SettingGroup {
  name: string;
  fields: SourceSettingField[];
}

@Component({
  selector: 'generic-block-settings',
  standalone: true,
  imports: [FormsModule, NgxInputColor],
  templateUrl: './generic-block-settings.component.html',
  styleUrls: ['./generic-block-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenericBlockSettingsComponent extends PageBuilderBaseComponent {
  @Input({ required: true }) item!: PageItem;
  @Input() fields: SourceSettingField[] = [];
  readonly validationErrors = new Map<string, string>();

  groupedFields(): SettingGroup[] {
    const groups = new Map<string, SourceSettingField[]>();
    for (const field of this.fields) {
      if (!this.isVisible(field)) continue;
      const name = field.group || 'General';
      const group = groups.get(name) ?? [];
      group.push(field);
      groups.set(name, group);
    }
    return [...groups.entries()].map(([name, fields]) => ({ name, fields }));
  }

  readValue(field: SourceSettingField): string | number | boolean {
    const attribute = field.attribute || field.name;
    const value = this.item?.options?.attributes?.[attribute];
    if (field.type === 'checkbox') {
      return value === true || value === '' || value === 'true' || value === attribute;
    }
    if (value === undefined || value === null) return field.defaultValue ?? '';
    if (field.type === 'number' || field.type === 'range') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : '';
    }
    if (field.type === 'select') {
      return field.options?.find((option) => String(option.value) === String(value))?.value ?? value;
    }
    return value;
  }

  inputMin(field: SourceSettingField): number | null {
    if (field.minAttribute) {
      const value = Number(this.item?.options?.attributes?.[field.minAttribute]);
      return Number.isFinite(value) ? value : (field.min ?? null);
    }
    return field.min ?? null;
  }

  inputMax(field: SourceSettingField): number | null {
    if (field.maxAttribute) {
      const value = Number(this.item?.options?.attributes?.[field.maxAttribute]);
      return Number.isFinite(value) ? value : (field.max ?? null);
    }
    return field.max ?? null;
  }

  isVisible(field: SourceSettingField): boolean {
    const condition = field.visibleWhen;
    if (!condition) return true;
    const current = this.item?.options?.attributes?.[condition.attribute];
    if (condition.isEmpty) return current === undefined || current === null || current === '';
    if (Array.isArray(condition.equals)) return condition.equals.some((value) => String(value) === String(current));
    return condition.equals === undefined || String(condition.equals) === String(current);
  }

  updateField(field: SourceSettingField, rawValue: unknown): void {
    if (!this.item) return;
    const attribute = field.attribute || field.name;
    const attributes = ((this.item.options ??= {}).attributes ??= {});
    let value: string | boolean | undefined;

    if (field.type === 'checkbox') {
      value = rawValue === true;
    } else if (rawValue === null || rawValue === undefined || rawValue === '') {
      value = undefined;
    } else {
      value = String(rawValue);
    }

    if (field.type === 'number' && value !== undefined) {
      const numeric = Number(value);
      const lower = field.minAttribute ? Number(attributes[field.minAttribute]) : field.min;
      const upper = field.maxAttribute ? Number(attributes[field.maxAttribute]) : field.max;
      if (
        (Number.isFinite(lower) && numeric < (lower ?? 0)) ||
        (Number.isFinite(upper) && numeric > (upper ?? Number.MAX_SAFE_INTEGER))
      ) {
        this.validationErrors.set(
          field.name,
          `Value must be between ${Number.isFinite(lower) ? lower : '−∞'} and ${Number.isFinite(upper) ? upper : '+∞'}.`,
        );
        this.chdRef.markForCheck();
        return;
      }
    }
    this.validationErrors.delete(field.name);

    const previousAttributeValue = attributes[attribute];
    if (value === undefined || value === false) delete attributes[attribute];
    else attributes[attribute] = value;

    // Keep range-based controls internally valid when their bounds change.
    if ((attribute === 'min' || attribute === 'max') && value !== undefined) {
      const bound = Number(value);
      const otherName = attribute === 'min' ? 'max' : 'min';
      const otherBound = Number(attributes[otherName]);
      if (Number.isFinite(otherBound)) {
        const invalidOrder = attribute === 'min' ? bound > otherBound : bound < otherBound;
        if (invalidOrder) {
          if (previousAttributeValue === undefined) delete attributes[attribute];
          else attributes[attribute] = previousAttributeValue;
          this.validationErrors.set(field.name, 'Minimum cannot exceed maximum.');
          this.chdRef.markForCheck();
          return;
        }
      }
      const currentValue = Number(attributes['value']);
      if (Number.isFinite(currentValue)) {
        const adjusted = attribute === 'min' ? Math.max(currentValue, bound) : Math.min(currentValue, bound);
        if (adjusted !== currentValue) attributes['value'] = String(adjusted);
      }
    }

    const element = this.item.el;
    if (element) {
      const syncAttribute = (name: string, current: unknown) => {
        if (current === undefined || current === false || current === null) element.removeAttribute(name);
        else if (current === true) element.setAttribute(name, '');
        else element.setAttribute(name, String(current));
      };
      syncAttribute(attribute, attributes[attribute]);
      if (attribute === 'min' || attribute === 'max') syncAttribute('value', attributes['value']);

      // Keep live form-control properties in sync; setting the attribute alone only
      // updates defaultValue/defaultChecked on several native controls.
      const control = element as HTMLInputElement;
      if (attribute === 'value' && 'value' in control) control.value = value === undefined ? '' : String(value);
      if ((attribute === 'min' || attribute === 'max') && 'value' in control && attributes['value'] !== undefined)
        control.value = String(attributes['value']);
      if (attribute === 'checked' && 'checked' in control) control.checked = value === true;
      if (attribute === 'disabled' && 'disabled' in control) control.disabled = value === true;
      if (attribute === 'selected' && 'selected' in control) (control as any).selected = value === true;
    }

    this.pb.changedProperties(this.item);
    this.chdRef.markForCheck();
  }

  trackGroup(_: number, group: SettingGroup): string {
    return group.name;
  }

  trackField(_: number, field: SourceSettingField): string {
    return field.name;
  }
}
