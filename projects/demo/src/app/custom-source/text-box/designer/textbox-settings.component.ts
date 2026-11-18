import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COMPONENT_DATA, ComponentDataContext } from 'ngx-page-builder/core';
import {
  TextboxAppearance,
  TextboxErrorKey,
  TextboxMessages,
  TextboxSettings,
  TextboxValidationPreset,
  TextboxValueType,
  createTextboxSettings,
} from '../shared/textbox.model';
import { getDefaultValidationPreset } from '../shared/textbox-validation';
import { inspectCustomRegex } from '../shared/textbox-validation';

@Component({
  selector: 'custom-textbox-settings',
  templateUrl: './textbox-settings.component.html',
  styleUrls: ['./textbox-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class TextboxSettingsComponent {
  private readonly context = inject<ComponentDataContext<TextboxSettings>>(COMPONENT_DATA);
  private readonly cdr = inject(ChangeDetectorRef);

  settings: TextboxSettings = createTextboxSettings(this.context.data);
  regexTestValue = 'sample-value';
  regexTestMessage = '';
  regexTestPassed?: boolean;

  readonly valueTypes: Array<{ label: string; value: TextboxValueType }> = [
    { label: 'Text', value: 'text' },
    { label: 'Email', value: 'email' },
    { label: 'Mobile', value: 'mobile' },
    { label: 'Number', value: 'number' },
    { label: 'URL', value: 'url' },
    { label: 'Password', value: 'password' },
    { label: 'Search', value: 'search' },
    { label: 'Date', value: 'date' },
    { label: 'Time', value: 'time' },
    { label: 'Date & time', value: 'datetime-local' },
  ];

  readonly appearances: Array<{ label: string; value: TextboxAppearance; description: string }> = [
    { label: 'Material outline', value: 'material-outline', description: 'Outlined field with a compact label' },
    { label: 'Material filled', value: 'material-filled', description: 'Filled surface and underline' },
    { label: 'Classic outline', value: 'outline', description: 'Clean bordered input' },
    { label: 'Soft surface', value: 'soft', description: 'Low-contrast rounded surface' },
    { label: 'Filled', value: 'filled', description: 'Solid background' },
    { label: 'Underline', value: 'underline', description: 'Minimal bottom border' },
    { label: 'Pill', value: 'pill', description: 'Fully rounded control' },
    { label: 'Glass', value: 'glass', description: 'Translucent blurred surface' },
    { label: 'Minimal', value: 'minimal', description: 'Bare, typography-led field' },
    { label: 'Gradient accent', value: 'gradient', description: 'Colourful gradient border with a soft glow' },
    { label: 'Neumorphic', value: 'neumorphic', description: 'Soft raised surface and inset hover state' },
  ];

  readonly validationPresets: Array<{ label: string; value: TextboxValidationPreset }> = [
    { label: 'No additional pattern', value: 'none' },
    { label: 'Email address', value: 'email' },
    { label: 'Mobile — international', value: 'mobile-international' },
    { label: 'Mobile — Iran (09xxxxxxxxx)', value: 'mobile-iran' },
    { label: 'Phone number', value: 'phone' },
    { label: 'Digits only', value: 'digits' },
    { label: 'Letters only', value: 'letters' },
    { label: 'Letters and numbers', value: 'alphanumeric' },
    { label: 'Iran postal code', value: 'iran-postal-code' },
    { label: 'Username', value: 'username' },
    { label: 'Strong password', value: 'strong-password' },
    { label: 'Custom regular expression', value: 'custom' },
  ];

  readonly messageFields: Array<{ key: TextboxErrorKey; label: string }> = [
    { key: 'required', label: 'Required' },
    { key: 'invalidEmail', label: 'Invalid email' },
    { key: 'invalidMobile', label: 'Invalid mobile' },
    { key: 'invalidPhone', label: 'Invalid phone' },
    { key: 'invalidNumber', label: 'Invalid number / range' },
    { key: 'invalidUrl', label: 'Invalid URL' },
    { key: 'minLength', label: 'Minimum length' },
    { key: 'maxLength', label: 'Maximum length' },
    { key: 'pattern', label: 'Pattern mismatch' },
    { key: 'customRegexInvalid', label: 'Invalid custom rule' },
  ];

  get customRegexInspection() {
    return inspectCustomRegex(this.settings.customRegex);
  }

  onAppearanceChanged(value: TextboxAppearance): void {
    this.settings.appearance = value;
    this.update();
  }

  onTypeChanged(value: TextboxValueType): void {
    this.settings.valueType = value;
    this.settings.validationPreset = getDefaultValidationPreset(value);

    if (value === 'email') this.settings.placeholder = 'name@example.com';
    else if (value === 'mobile') this.settings.placeholder = '+989121234567';
    else if (value === 'number') this.settings.placeholder = '0';
    else if (value === 'url') this.settings.placeholder = 'https://example.com';
    else if (value === 'password') this.settings.placeholder = 'Enter password';
    else if (
      !this.settings.placeholder ||
      ['name@example.com', '+989121234567', '0'].includes(this.settings.placeholder)
    ) {
      this.settings.placeholder = 'Enter your value';
    }

    this.update();
  }

  update(): void {
    this.settings = createTextboxSettings(this.settings);
    this.context.onChange.next(this.settings);
    this.cdr.markForCheck();
  }

  testCustomRegex(): void {
    const inspection = this.customRegexInspection;
    if (!inspection.valid) {
      this.regexTestPassed = false;
      this.regexTestMessage = inspection.message ?? 'Invalid expression.';
      return;
    }

    try {
      const regex = new RegExp(`^(?:${this.settings.customRegex})$`, 'u');
      this.regexTestPassed = regex.test(this.regexTestValue);
      this.regexTestMessage = this.regexTestPassed
        ? 'The sample value matches the expression.'
        : 'The sample value does not match the expression.';
    } catch (error) {
      this.regexTestPassed = false;
      this.regexTestMessage = error instanceof Error ? error.message : 'Invalid expression.';
    }
    this.cdr.markForCheck();
  }

  trackMessage(_index: number, item: { key: keyof TextboxMessages }): string {
    return item.key;
  }
}
