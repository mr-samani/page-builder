import { PosValue, Spacing } from './SpacingModel';

export function validateSpacing(spacing: Spacing, allowNegative: boolean): Spacing {
  const validated: Spacing = {
    top: { value: undefined, unit: 'px' },
    right: { value: undefined, unit: 'px' },
    bottom: { value: undefined, unit: 'px' },
    left: { value: undefined, unit: 'px' },
  };
  const keys: (keyof Spacing)[] = ['top', 'right', 'bottom', 'left'];

  for (const key of keys) {
    const value = spacing[key]?.value;
    validated[key] = new PosValue();

    if (value == 'auto') {
      validated[key].value = 'auto';
    } else if (value === undefined || isNaN(+value)) {
      validated[key].value = undefined;
    } else if (!allowNegative && +value < 0) {
      validated[key].value = 0; // No negative values for padding
    } else {
      validated[key].value = Math.round(+value * 100) / 100; // Round to 2 decimal places
    }
    validated[key]!.unit = spacing[key]?.unit ?? 'px';
  }
  return validated;
}
// Parse spacing values from CSS string (e.g., "10px 20px 30px 40px")
export function parseSpacingValues(cssValue: string | undefined): Spacing {
  if (!cssValue) return new Spacing();

  const values = cssValue.trim().split(/\s+/);
  const unitRegex = /(px|rem|em|%)$/;

  // Extract numeric values and unit
  const parsed = new Spacing();
  if (values.length === 1) {
    // Single value (e.g., "10px")
    const v0 = parseSingleValue(values[0], unitRegex);
    parsed.top = { ...v0 };
    parsed.right = { ...v0 };
    parsed.bottom = { ...v0 };
    parsed.left = { ...v0 };
  } else if (values.length === 2) {
    // Two values (e.g., "10px 20px")
    const v0 = parseSingleValue(values[0], unitRegex);
    const v1 = parseSingleValue(values[1], unitRegex);
    parsed.top = { ...v0 };
    parsed.bottom = { ...v0 };
    parsed.right = { ...v1 };
    parsed.left = { ...v1 };
  } else if (values.length === 3) {
    // Three values (e.g., "10px 20px 30px")
    const v0 = parseSingleValue(values[0], unitRegex);
    const v1 = parseSingleValue(values[1], unitRegex);
    const v2 = parseSingleValue(values[2], unitRegex);
    parsed.top = { ...v0 };
    parsed.right = { ...v1 };
    parsed.left = { ...v1 };
    parsed.bottom = { ...v2 };
  } else if (values.length === 4) {
    // Four values (e.g., "10px 20px 30px 40px")
    parsed.top = parseSingleValue(values[0], unitRegex);
    parsed.right = parseSingleValue(values[1], unitRegex);
    parsed.bottom = parseSingleValue(values[2], unitRegex);
    parsed.left = parseSingleValue(values[3], unitRegex);
  }

  return parsed;
}

// Parse a single CSS value (e.g., "10px" -> 10)
export function parseSingleValue(value: string, unitRegex: RegExp): PosValue {
  if (value == 'auto') return { value: 'auto', unit: 'auto' };
  const num = parseFloat(value.replace(unitRegex, ''));
  let unit = value.match(unitRegex)?.[0] as any;
  return {
    value: isNaN(num) ? 0 : num,
    unit,
  };
}
