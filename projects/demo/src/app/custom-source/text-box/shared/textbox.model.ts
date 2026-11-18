export type TextboxValueType =
  | 'text'
  | 'email'
  | 'mobile'
  | 'number'
  | 'url'
  | 'password'
  | 'search'
  | 'date'
  | 'time'
  | 'datetime-local';

export type TextboxAppearance =
  | 'outline'
  | 'filled'
  | 'underline'
  | 'soft'
  | 'pill'
  | 'glass'
  | 'material-outline'
  | 'material-filled'
  | 'minimal'
  | 'gradient'
  | 'neumorphic';

export type TextboxValidationPreset =
  | 'none'
  | 'email'
  | 'mobile-international'
  | 'mobile-iran'
  | 'phone'
  | 'digits'
  | 'letters'
  | 'alphanumeric'
  | 'iran-postal-code'
  | 'username'
  | 'strong-password'
  | 'custom';

export type TextboxErrorKey =
  | 'required'
  | 'invalidEmail'
  | 'invalidMobile'
  | 'invalidPhone'
  | 'invalidNumber'
  | 'invalidUrl'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'customRegexInvalid';

export type TextboxMessages = Record<TextboxErrorKey, string>;

export interface TextboxSettings {
  valueType: TextboxValueType;
  appearance: TextboxAppearance;
  name: string;
  placeholder: string;
  autocomplete: string;
  value: string;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  validationPreset: TextboxValidationPreset;
  customRegex: string;
  messages: TextboxMessages;
}

export const TEXTBOX_DEFAULT_MESSAGES: Readonly<TextboxMessages> = Object.freeze({
  required: 'This field is required.',
  invalidEmail: 'Please enter a valid email address.',
  invalidMobile: 'Please enter a valid mobile number.',
  invalidPhone: 'Please enter a valid phone number.',
  invalidNumber: 'Please enter a valid number.',
  invalidUrl: 'Please enter a valid URL.',
  minLength: 'The value is shorter than the minimum allowed length.',
  maxLength: 'The value is longer than the maximum allowed length.',
  pattern: 'The value format is invalid.',
  customRegexInvalid: 'The custom validation rule is invalid. Please check the field settings.',
});

export const TEXTBOX_DEFAULT_SETTINGS: Readonly<TextboxSettings> = Object.freeze({
  valueType: 'text',
  appearance: 'material-outline',
  name: '',
  placeholder: 'Enter your value',
  autocomplete: 'off',
  value: '',
  required: false,
  disabled: false,
  readOnly: false,
  minLength: undefined,
  maxLength: undefined,
  min: undefined,
  max: undefined,
  step: undefined,
  validationPreset: 'none',
  customRegex: '^[a-zA-Z0-9._-]+$',
  messages: TEXTBOX_DEFAULT_MESSAGES as TextboxMessages,
});

const VALUE_TYPES: readonly TextboxValueType[] = [
  'text',
  'email',
  'mobile',
  'number',
  'url',
  'password',
  'search',
  'date',
  'time',
  'datetime-local',
];

const APPEARANCES: readonly TextboxAppearance[] = [
  'outline',
  'filled',
  'underline',
  'soft',
  'pill',
  'glass',
  'material-outline',
  'material-filled',
  'minimal',
  'gradient',
  'neumorphic',
];

const VALIDATION_PRESETS: readonly TextboxValidationPreset[] = [
  'none',
  'email',
  'mobile-international',
  'mobile-iran',
  'phone',
  'digits',
  'letters',
  'alphanumeric',
  'iran-postal-code',
  'username',
  'strong-password',
  'custom',
];

export function createTextboxSettings(value?: Partial<TextboxSettings> | null): TextboxSettings {
  const candidate = value ?? {};
  const valueType = VALUE_TYPES.includes(candidate.valueType as TextboxValueType)
    ? (candidate.valueType as TextboxValueType)
    : TEXTBOX_DEFAULT_SETTINGS.valueType;
  const appearance = APPEARANCES.includes(candidate.appearance as TextboxAppearance)
    ? (candidate.appearance as TextboxAppearance)
    : TEXTBOX_DEFAULT_SETTINGS.appearance;
  const validationPreset = VALIDATION_PRESETS.includes(candidate.validationPreset as TextboxValidationPreset)
    ? (candidate.validationPreset as TextboxValidationPreset)
    : TEXTBOX_DEFAULT_SETTINGS.validationPreset;

  return {
    ...TEXTBOX_DEFAULT_SETTINGS,
    ...candidate,
    valueType,
    appearance,
    validationPreset,
    messages: {
      ...TEXTBOX_DEFAULT_MESSAGES,
      ...(candidate.messages ?? {}),
    },
  };
}

export function getNativeInputType(valueType: TextboxValueType): string {
  switch (valueType) {
    case 'mobile':
      return 'tel';
    case 'datetime-local':
      return 'datetime-local';
    default:
      return valueType;
  }
}

export function getInputMode(valueType: TextboxValueType): string {
  switch (valueType) {
    case 'email':
      return 'email';
    case 'mobile':
      return 'tel';
    case 'number':
      return 'decimal';
    case 'search':
      return 'search';
    default:
      return 'text';
  }
}
