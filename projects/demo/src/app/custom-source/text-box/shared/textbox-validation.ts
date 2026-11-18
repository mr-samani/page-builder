import {
  TextboxErrorKey,
  TextboxSettings,
  TextboxValidationPreset,
  TextboxValueType,
} from './textbox.model';

export interface RegexInspection {
  valid: boolean;
  message?: string;
}

const PRESET_PATTERNS: Partial<Record<TextboxValidationPreset, string>> = {
  email: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$',
  'mobile-international': '^\\+?[1-9]\\d{7,14}$',
  'mobile-iran': '^09\\d{9}$',
  phone: '^\\+?[0-9\\s().-]{7,20}$',
  digits: '^\\d+$',
  letters: "^[\\p{L}\\s'-]+$",
  alphanumeric: '^[\\p{L}\\p{N}_-]+$',
  'iran-postal-code': '^\\d{10}$',
  username: '^[a-zA-Z0-9._-]{3,32}$',
};

const MAX_CUSTOM_REGEX_LENGTH = 160;
const MAX_CUSTOM_REGEX_QUANTIFIERS = 12;
const MAX_CUSTOM_REGEX_VALUE_LENGTH = 2048;

/**
 * Validates a custom pattern before it is stored or executed.
 * The length limit and conservative rejection rules reduce common ReDoS risks;
 * they are not a substitute for server-side validation or a guaranteed regex timeout.
 */
export function inspectCustomRegex(pattern: string): RegexInspection {
  const source = (pattern ?? '').trim();
  if (!source) return { valid: false, message: 'Enter a regular expression.' };
  if (source.length > MAX_CUSTOM_REGEX_LENGTH) {
    return { valid: false, message: `Keep the expression under ${MAX_CUSTOM_REGEX_LENGTH + 1} characters.` };
  }

  const quantifierCount = source.match(/(?:[+*]|\{\d+(?:,\d*)?\})/g)?.length ?? 0;
  if (quantifierCount > MAX_CUSTOM_REGEX_QUANTIFIERS) {
    return { valid: false, message: `Use no more than ${MAX_CUSTOM_REGEX_QUANTIFIERS} repetition operators.` };
  }

  if (/\\[1-9]/.test(source)) {
    return { valid: false, message: 'Backreferences are not supported in custom rules.' };
  }
  if (/\(\?(?:[=!]|<[=!])/.test(source)) {
    return { valid: false, message: 'Lookahead and lookbehind groups are not supported.' };
  }
  if (/\((?:\\.|[^()])*(?:\*|\+|\{\d+(?:,\d*)?\})(?:\\.|[^()])*\)(?:\*|\+|\{)/.test(source)) {
    return { valid: false, message: 'Nested repeated groups are not supported.' };
  }
  if (/\([^()]*\|[^()]*\)(?:\*|\+|\{)/.test(source)) {
    return { valid: false, message: 'Repeated alternation groups are not supported.' };
  }

  try {
    // Anchoring ensures the complete value must match. No g/y flags are used, so test() is stateless.
    new RegExp(`^(?:${source})$`, 'u');
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : 'The expression could not be compiled.',
    };
  }
}

function regexForPreset(preset: TextboxValidationPreset): RegExp | undefined {
  const source = PRESET_PATTERNS[preset];
  if (!source) return undefined;
  try {
    return new RegExp(source, 'u');
  } catch {
    return undefined;
  }
}

function isValidUrl(value: string): boolean {
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(candidate);
    return !!parsed.hostname && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

function isStrongPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^a-zA-Z0-9]/.test(value)
  );
}

/** Returns the fixed message key; UI text is resolved from TextboxSettings.messages. */
export function validateTextboxValue(value: string, settings: TextboxSettings): TextboxErrorKey | undefined {
  const text = value ?? '';
  const trimmed = text.trim();

  if (settings.required && !trimmed) return 'required';
  if (!trimmed) return undefined;

  if (settings.minLength != null && text.length < settings.minLength) return 'minLength';
  if (settings.maxLength != null && text.length > settings.maxLength) return 'maxLength';

  if (settings.valueType === 'email' && !regexForPreset('email')?.test(trimmed)) return 'invalidEmail';
  if (settings.valueType === 'url' && !isValidUrl(trimmed)) return 'invalidUrl';
  if (settings.valueType === 'number') {
    const number = Number(trimmed);
    if (!Number.isFinite(number)) return 'invalidNumber';
    if (settings.min != null && number < settings.min) return 'invalidNumber';
    if (settings.max != null && number > settings.max) return 'invalidNumber';
  }

  switch (settings.validationPreset) {
    case 'none':
      return undefined;
    case 'strong-password':
      return isStrongPassword(text) ? undefined : 'pattern';
    case 'custom': {
      if (text.length > MAX_CUSTOM_REGEX_VALUE_LENGTH) return 'pattern';
      const inspection = inspectCustomRegex(settings.customRegex);
      if (!inspection.valid) return 'customRegexInvalid';
      try {
        return new RegExp(`^(?:${settings.customRegex})$`, 'u').test(text) ? undefined : 'pattern';
      } catch {
        return 'customRegexInvalid';
      }
    }
    case 'email':
    case 'mobile-international':
    case 'mobile-iran':
    case 'phone':
    case 'digits':
    case 'letters':
    case 'alphanumeric':
    case 'iran-postal-code':
    case 'username': {
      const regex = regexForPreset(settings.validationPreset);
      if (!regex) return 'pattern';
      if (regex.test(text)) return undefined;
      if (settings.validationPreset.startsWith('mobile-')) return 'invalidMobile';
      if (settings.validationPreset === 'phone') return 'invalidPhone';
      if (settings.validationPreset === 'email') return 'invalidEmail';
      return 'pattern';
    }
  }
}

export function getDefaultValidationPreset(valueType: TextboxValueType): TextboxValidationPreset {
  switch (valueType) {
    case 'email':
      return 'email';
    case 'mobile':
      return 'mobile-international';
    default:
      return 'none';
  }
}

export function getTextboxErrorMessage(key: TextboxErrorKey, settings: TextboxSettings): string {
  return settings.messages[key] || settings.messages.pattern;
}

/** Connects native input events without adding Angular template elements around the user's editable blocks. */
export function attachTextboxValidation(
  input: HTMLInputElement | null,
  error: HTMLElement | null,
  settings: TextboxSettings,
  editMode = false,
): () => void {
  if (!input) return () => undefined;

  let touched = false;
  const render = () => {
    const errorKey = validateTextboxValue(input.value, settings);
    if (errorKey) {
      input.setAttribute('aria-invalid', 'true');
      if (error) {
        error.hidden = false;
        error.textContent = getTextboxErrorMessage(errorKey, settings);
      }
      return;
    }

    input.setAttribute('aria-invalid', 'false');
    if (error && !editMode) {
      error.hidden = true;
      error.textContent = '';
    }
  };

  const onInput = () => {
    if (touched) render();
  };
  const onBlur = () => {
    touched = true;
    render();
  };

  input.addEventListener('input', onInput);
  input.addEventListener('blur', onBlur);

  if (editMode && error) {
    error.hidden = false;
    error.textContent = settings.messages.pattern;
  } else if (error) {
    error.hidden = true;
  }

  return () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('blur', onBlur);
  };
}
