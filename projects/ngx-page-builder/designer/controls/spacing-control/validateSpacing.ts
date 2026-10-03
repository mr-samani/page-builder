import { IPosValue } from './IPosValue';

export function validateSpacing(spacing: IPosValue, allowNegative: boolean): IPosValue {
  const validated: IPosValue = {};
  const keys: (keyof IPosValue)[] = ['top', 'right', 'bottom', 'left'];

  for (const key of keys) {
    const value = spacing[key];
    if (value == 'auto') {
      validated[key] = 'auto';
    } else if (value === undefined || isNaN(+value)) {
      validated[key] = 0;
    } else if (!allowNegative && +value < 0) {
      validated[key] = 0; // No negative values for padding
    } else {
      validated[key] = Math.round(+value * 100) / 100; // Round to 2 decimal places
    }
  }
  return validated;
}
// Parse spacing values from CSS string (e.g., "10px 20px 30px 40px")
export function parseSpacingValues(cssValue: string | undefined, defaultValue: IPosValue, unit: string): IPosValue {
  if (!cssValue) return { ...defaultValue };

  const values = cssValue.trim().split(/\s+/);
  const unitRegex = /(px|rem|em|%|vw|vh)$/;

  // Extract numeric values and unit
  const parsed: IPosValue = { ...defaultValue };
  if (values.length === 1) {
    // Single value (e.g., "10px")
    const val = parseSingleValue(values[0], unitRegex);
    parsed.top = parsed.right = parsed.bottom = parsed.left = val;
    unit = values[0].match(unitRegex)?.[0] || unit;
  } else if (values.length === 2) {
    // Two values (e.g., "10px 20px")
    parsed.top = parsed.bottom = parseSingleValue(values[0], unitRegex);
    parsed.right = parsed.left = parseSingleValue(values[1], unitRegex);
    unit = values[0].match(unitRegex)?.[0] || unit;
  } else if (values.length === 3) {
    // Three values (e.g., "10px 20px 30px")
    parsed.top = parseSingleValue(values[0], unitRegex);
    parsed.right = parsed.left = parseSingleValue(values[1], unitRegex);
    parsed.bottom = parseSingleValue(values[2], unitRegex);
    unit = values[0].match(unitRegex)?.[0] || unit;
  } else if (values.length === 4) {
    // Four values (e.g., "10px 20px 30px 40px")
    parsed.top = parseSingleValue(values[0], unitRegex);
    parsed.right = parseSingleValue(values[1], unitRegex);
    parsed.bottom = parseSingleValue(values[2], unitRegex);
    parsed.left = parseSingleValue(values[3], unitRegex);
    unit = values[0].match(unitRegex)?.[0] || unit;
  }

  unit = unit; // Update unit if detected
  return parsed;
}

// Parse a single CSS value (e.g., "10px" -> 10)
export function parseSingleValue(value: string, unitRegex: RegExp): number | 'auto' {
  if (value == 'auto') return 'auto';
  const num = parseFloat(value.replace(unitRegex, ''));
  return isNaN(num) ? 0 : num;
}
