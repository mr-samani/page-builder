import type { IPageItem } from 'ngx-page-builder/core';
import { getInputMode, getNativeInputType, TextboxAppearance, TextboxSettings } from './textbox.model';

export type TextboxTemplateRole = 'root' | 'label' | 'control' | 'icon' | 'input' | 'hint' | 'error';

interface AppearanceStyle {
  root: string;
  label: string;
  control: string;
  icon: string;
  input: string;
  hint: string;
  error: string;
  controlHover?: string;
  inputFocus?: string;
}

const BASE_INPUT =
  'display:block; flex:1 1 auto; width:100%; min-width:0; height:48px; padding:0; margin:0; border:0; outline:0; background:transparent; color:inherit; font:inherit; box-shadow:none;';

const APPEARANCE_STYLES: Record<TextboxAppearance, AppearanceStyle> = {
  outline: {
    root: 'display:flex; flex-direction:column; gap:8px; width:100%; min-width:0; color:#172033;',
    label: 'display:block; margin:0; color:#334155; font-size:13px; font-weight:650; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:10px; min-height:50px; padding:0 14px; border:1px solid #cbd5e1; border-radius:11px; background:#fff; color:#172033; transition:border-color .18s ease, box-shadow .18s ease, background .18s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; align-items:center; justify-content:center; color:#64748b; font-size:17px; line-height:1;',
    input: BASE_INPUT,
    hint: 'display:block; margin:0; color:#64748b; font-size:11px; line-height:1.55;',
    error: 'display:block; margin:0; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'border-color:#64748b;',
    inputFocus: 'outline:2px solid #3b82f6; outline-offset:-1px; border-radius:3px;',
  },
  filled: {
    root: 'display:flex; flex-direction:column; gap:8px; width:100%; min-width:0; color:#172033;',
    label: 'display:block; margin:0; color:#475569; font-size:12px; font-weight:700; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:10px; min-height:52px; padding:0 14px; border:1px solid transparent; border-radius:10px; background:#f1f5f9; color:#0f172a; transition:background .18s ease, border-color .18s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#64748b; font-size:17px; line-height:1;',
    input: BASE_INPUT,
    hint: 'display:block; margin:0; color:#64748b; font-size:11px; line-height:1.55;',
    error: 'display:block; margin:0; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'background:#e9eff7;',
    inputFocus: 'outline:2px solid #2563eb; outline-offset:-1px; border-radius:3px;',
  },
  underline: {
    root: 'display:flex; flex-direction:column; gap:7px; width:100%; min-width:0; color:#172033;',
    label: 'display:block; margin:0; color:#475569; font-size:13px; font-weight:600; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:10px; min-height:48px; padding:0 4px; border:0; border-bottom:1px solid #94a3b8; border-radius:0; background:transparent; color:#0f172a; transition:border-color .18s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#64748b; font-size:17px; line-height:1;',
    input: `${BASE_INPUT} height:46px;`,
    hint: 'display:block; margin:0; color:#64748b; font-size:11px; line-height:1.5;',
    error: 'display:block; margin:0; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'border-bottom-color:#475569;',
    inputFocus: 'outline:0; border-radius:0; box-shadow:0 2px 0 #2563eb;',
  },
  soft: {
    root: 'display:flex; flex-direction:column; gap:8px; width:100%; min-width:0; color:#172033;',
    label: 'display:block; margin:0; color:#334155; font-size:13px; font-weight:650; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:11px; min-height:52px; padding:0 15px; border:1px solid #e2e8f0; border-radius:14px; background:#f8fafc; color:#172033; transition:background .18s ease, border-color .18s ease, transform .18s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#64748b; font-size:17px; line-height:1;',
    input: BASE_INPUT,
    hint: 'display:block; margin:0; color:#64748b; font-size:11px; line-height:1.5;',
    error: 'display:block; margin:0; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'background:#f1f5f9; border-color:#cbd5e1;',
    inputFocus: 'outline:2px solid #0ea5e9; outline-offset:-1px; border-radius:4px;',
  },
  pill: {
    root: 'display:flex; flex-direction:column; gap:8px; width:100%; min-width:0; color:#172033;',
    label: 'display:block; margin:0; color:#334155; font-size:13px; font-weight:650; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:11px; min-height:52px; padding:0 19px; border:1px solid #cbd5e1; border-radius:999px; background:#fff; color:#172033; transition:border-color .18s ease, box-shadow .18s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#64748b; font-size:17px; line-height:1;',
    input: BASE_INPUT,
    hint: 'display:block; margin:0 4px; color:#64748b; font-size:11px; line-height:1.5;',
    error: 'display:block; margin:0 4px; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'border-color:#64748b;',
    inputFocus: 'outline:2px solid #3b82f6; outline-offset:-1px; border-radius:999px;',
  },
  glass: {
    root: 'display:flex; flex-direction:column; gap:8px; width:100%; min-width:0; color:#172033;',
    label: 'display:block; margin:0; color:#334155; font-size:13px; font-weight:650; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:11px; min-height:52px; padding:0 15px; border:1px solid rgba(148,163,184,.42); border-radius:14px; background:rgba(255,255,255,.52); color:#172033; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); box-shadow:0 8px 28px rgba(15,23,42,.09); transition:border-color .18s ease, background .18s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#64748b; font-size:17px; line-height:1;',
    input: BASE_INPUT,
    hint: 'display:block; margin:0; color:#64748b; font-size:11px; line-height:1.5;',
    error: 'display:block; margin:0; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'border-color:rgba(100,116,139,.65); background:rgba(255,255,255,.72);',
    inputFocus: 'outline:2px solid rgba(99,102,241,.65); outline-offset:-1px; border-radius:4px;',
  },
  'material-outline': {
    root: 'display:flex; flex-direction:column; gap:7px; width:100%; min-width:0; color:#202124;',
    label: 'display:block; margin:0; color:#5f6368; font-size:12px; font-weight:500; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:10px; min-height:56px; padding:0 16px; border:1px solid #9aa0a6; border-radius:4px; background:#fff; color:#202124; transition:border-color .16s ease, box-shadow .16s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#5f6368; font-size:18px; line-height:1;',
    input: `${BASE_INPUT} height:54px; font-size:14px;`,
    hint: 'display:block; margin:0 2px; color:#5f6368; font-size:11px; line-height:1.45;',
    error: 'display:block; margin:0 2px; color:#b3261e; font-size:11px; line-height:1.45;',
    controlHover: 'border-color:#5f6368;',
    inputFocus: 'outline:2px solid #6750a4; outline-offset:-1px; border-radius:2px;',
  },
  'material-filled': {
    root: 'display:flex; flex-direction:column; gap:7px; width:100%; min-width:0; color:#202124;',
    label: 'display:block; margin:0; color:#5f6368; font-size:12px; font-weight:500; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:10px; min-height:56px; padding:0 16px; border:0; border-bottom:1px solid #5f6368; border-radius:4px 4px 0 0; background:#f1f3f4; color:#202124; transition:border-color .16s ease, background .16s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#5f6368; font-size:18px; line-height:1;',
    input: `${BASE_INPUT} height:54px; font-size:14px;`,
    hint: 'display:block; margin:0 2px; color:#5f6368; font-size:11px; line-height:1.45;',
    error: 'display:block; margin:0 2px; color:#b3261e; font-size:11px; line-height:1.45;',
    controlHover: 'background:#e8eaed; border-bottom-color:#202124;',
    inputFocus: 'outline:2px solid #6750a4; outline-offset:-1px; border-radius:2px;',
  },
  minimal: {
    root: 'display:flex; flex-direction:column; gap:6px; width:100%; min-width:0; color:inherit;',
    label: 'display:block; margin:0; color:inherit; font-size:13px; font-weight:600; line-height:1.45;',
    control:
      'display:flex; align-items:center; gap:8px; min-height:44px; padding:0; border:0; border-radius:0; background:transparent; color:inherit;',
    icon: 'display:inline-flex; flex:0 0 auto; color:currentColor; opacity:.65; font-size:16px; line-height:1;',
    input: `${BASE_INPUT} height:44px; border-bottom:1px solid currentColor; opacity:.9;`,
    hint: 'display:block; margin:0; color:inherit; opacity:.65; font-size:11px; line-height:1.5;',
    error: 'display:block; margin:0; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'opacity:.9;',
    inputFocus: 'outline:0; box-shadow:0 2px 0 #2563eb;',
  },
  gradient: {
    root: 'display:flex; flex-direction:column; gap:8px; width:100%; min-width:0; color:#172033;',
    label: 'display:block; margin:0; color:#334155; font-size:13px; font-weight:650; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:11px; min-height:52px; padding:0 15px; border:1px solid transparent; border-radius:13px; background:linear-gradient(#fff,#fff) padding-box,linear-gradient(120deg,#8b5cf6,#06b6d4) border-box; color:#172033; box-shadow:0 6px 20px rgba(99,102,241,.08); transition:box-shadow .18s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#6366f1; font-size:17px; line-height:1;',
    input: BASE_INPUT,
    hint: 'display:block; margin:0; color:#64748b; font-size:11px; line-height:1.5;',
    error: 'display:block; margin:0; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'box-shadow:0 10px 28px rgba(99,102,241,.16);',
    inputFocus: 'outline:2px solid #8b5cf6; outline-offset:-1px; border-radius:4px;',
  },
  neumorphic: {
    root: 'display:flex; flex-direction:column; gap:8px; width:100%; min-width:0; color:#334155;',
    label: 'display:block; margin:0; color:#475569; font-size:13px; font-weight:650; line-height:1.5;',
    control:
      'display:flex; align-items:center; gap:11px; min-height:52px; padding:0 15px; border:1px solid #e6ebf1; border-radius:15px; background:#eef2f7; color:#334155; box-shadow:7px 7px 14px #d5dbe4,-7px -7px 14px #fff; transition:box-shadow .18s ease;',
    icon: 'display:inline-flex; flex:0 0 auto; color:#64748b; font-size:17px; line-height:1;',
    input: BASE_INPUT,
    hint: 'display:block; margin:0; color:#64748b; font-size:11px; line-height:1.5;',
    error: 'display:block; margin:0; color:#dc2626; font-size:11px; line-height:1.5;',
    controlHover: 'box-shadow:inset 4px 4px 8px #d5dbe4,inset -4px -4px 8px #fff;',
    inputFocus: 'outline:2px solid #64748b; outline-offset:-1px; border-radius:4px;',
  },
};

function findRole(root: IPageItem, role: TextboxTemplateRole): IPageItem | undefined {
  if (root.options?.attributes?.['data-textbox-role'] === role) return root;
  for (const child of root.children ?? []) {
    const found = findRole(child, role);
    if (found) return found;
  }
  return undefined;
}

interface PresetCssSnapshot {
  base: string;
  states: Record<string, string>;
}

const PRESET_SNAPSHOT_KEY = '__samaniTextboxPresetCssV1';

function splitCssDeclarations(cssText: string): string[] {
  const result: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;

  for (const char of cssText ?? '') {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '\"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') parentheses++;
    else if (char === ')' && parentheses > 0) parentheses--;
    else if (char === '[') brackets++;
    else if (char === ']' && brackets > 0) brackets--;

    if (char === ';' && parentheses === 0 && brackets === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseDeclarations(cssText?: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const declaration of splitCssDeclarations(cssText ?? '')) {
    const colon = declaration.indexOf(':');
    if (colon < 1) continue;
    const rawProperty = declaration.slice(0, colon).trim();
    const property = rawProperty.startsWith('--') ? rawProperty : rawProperty.toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (property && value) declarations.set(property, value);
  }
  return declarations;
}

function serializeDeclarations(declarations: Map<string, string>): string {
  return [...declarations.entries()].map(([property, value]) => `${property}: ${value};`).join(' ');
}

function mergePresetBase(
  currentCss: string | undefined,
  previousPresetCss: string | undefined,
  nextPresetCss: string,
): string {
  const current = parseDeclarations(currentCss);
  const previous = previousPresetCss === undefined ? undefined : parseDeclarations(previousPresetCss);
  const next = parseDeclarations(nextPresetCss);
  const merged = new Map(next);

  if (!previous) {
    // On first application, retain any CSS that was already authored on the block.
    for (const [property, value] of current) merged.set(property, value);
  } else {
    // Keep user overrides and explicit removals, but replace declarations still owned by the old preset.
    for (const [property, value] of current) {
      if (!previous.has(property) || previous.get(property) !== value) merged.set(property, value);
    }
    for (const property of previous.keys()) {
      if (!current.has(property)) merged.delete(property);
    }
  }

  return serializeDeclarations(merged);
}

function getPresetSnapshot(item: IPageItem): PresetCssSnapshot | undefined {
  const customData = item.options?.customData;
  if (!customData || typeof customData !== 'object') return undefined;
  return (customData as Record<string, unknown>)[PRESET_SNAPSHOT_KEY] as PresetCssSnapshot | undefined;
}

function setPresetSnapshot(item: IPageItem, snapshot: PresetCssSnapshot): void {
  item.options ??= {};
  if (
    !item.options.customData ||
    typeof item.options.customData !== 'object' ||
    Array.isArray(item.options.customData)
  ) {
    item.options.customData = {};
  }
  (item.options.customData as Record<string, unknown>)[PRESET_SNAPSHOT_KEY] = snapshot;
}

function mergePresetState(
  current: string | undefined,
  previous: string | undefined,
  next: string | undefined,
): string | undefined {
  if (previous !== undefined && current === undefined) return undefined;
  if (current !== undefined && (previous === undefined || current !== previous)) return current;
  return next;
}

function assignCss(item: IPageItem | undefined, base: string, hover?: string, focus?: string): void {
  if (!item) return;

  const previousPreset = getPresetSnapshot(item);
  const currentStates = item.css?.states ?? {};
  const previousStates = previousPreset?.states ?? {};
  const nextStates: Record<string, string> = {};
  if (hover) nextStates['hover'] = hover;
  //focus must be set to parent : 'textbox-field-control'
  if (focus) {
    const fieldControl = item.parent;
    if (fieldControl) {
      fieldControl.css = {
        ...fieldControl.css,
        states: {
          ...fieldControl.css?.states,
          'focus-within': focus,
        },
      };
    }
  }

  const mergedStates: Record<string, string> = {};
  const stateKeys = new Set([
    ...Object.keys(currentStates),
    ...Object.keys(previousStates),
    ...Object.keys(nextStates),
  ]);
  for (const key of stateKeys) {
    const value = mergePresetState(
      currentStates[key as keyof typeof currentStates],
      previousStates[key],
      nextStates[key],
    );
    if (value !== undefined) mergedStates[key] = value;
  }

  const nextBase = mergePresetBase(item.css?.base, previousPreset?.base, base);
  item.css = {
    ...(item.css ?? {}),
    base: nextBase,
    states: mergedStates as NonNullable<NonNullable<IPageItem['css']>['states']>,
  };
  setPresetSnapshot(item, { base, states: nextStates });
}

export function applyTextboxAppearance(root: IPageItem, appearance: TextboxAppearance): void {
  const style = APPEARANCE_STYLES[appearance] ?? APPEARANCE_STYLES['material-outline'];
  assignCss(findRole(root, 'root'), style.root);
  assignCss(findRole(root, 'label'), style.label);
  assignCss(findRole(root, 'control'), style.control, style.controlHover);
  assignCss(findRole(root, 'icon'), style.icon);
  assignCss(findRole(root, 'input'), style.input, undefined, style.inputFocus);
  assignCss(findRole(root, 'hint'), style.hint);
  assignCss(findRole(root, 'error'), style.error);
}

export function createTextboxTemplate(): IPageItem {
  return {
    tag: 'div',
    canHaveChild: true,
    disableMovement: true,
    disableDelete: true,
    lockMoveInnerChild: true,
    isTemplateContainer: true,
    classList: ['textbox-field-root'],
    options: { attributes: { 'data-textbox-role': 'root' } },
    children: [
      {
        tag: 'label',
        content: 'Your name',
        classList: ['textbox-field-label'],
        options: { attributes: { 'data-textbox-role': 'label', for: 'textbox-input' } },
      },
      {
        tag: 'div',
        canHaveChild: true,
        classList: ['textbox-field-control'],
        options: { attributes: { 'data-textbox-role': 'control' } },
        children: [
          {
            tag: 'span',
            content: '✦',
            classList: ['textbox-field-icon'],
            options: { attributes: { 'data-textbox-role': 'icon', 'aria-hidden': 'true' } },
          },
          {
            tag: 'input',
            classList: ['textbox-field-input'],
            // text box must be have input element. can`t delete input
            disableDelete: true,
            options: {
              attributes: {
                'data-textbox-role': 'input',
                id: 'textbox-input',
                type: 'text',
                name: 'textbox',
                placeholder: 'Enter your value',
                autocomplete: 'off',
              },
            },
          },
        ],
      },
      {
        tag: 'p',
        content: 'Optional helper text goes here.',
        classList: ['textbox-field-hint'],
        options: { attributes: { 'data-textbox-role': 'hint' } },
      },
      {
        tag: 'p',
        content: 'The value format is invalid.',
        classList: ['textbox-field-error'],
        options: {
          attributes: {
            'data-textbox-role': 'error',
            'aria-live': 'polite',
            hidden: true,
          },
        },
      },
    ],
  };
}

export function findTextboxRole(root: IPageItem, role: TextboxTemplateRole): IPageItem | undefined {
  return findRole(root, role);
}

export function applyTextboxSettingsToTemplate(root: IPageItem, settings: TextboxSettings, id: string): void {
  const input = findRole(root, 'input');
  const label = findRole(root, 'label');
  const hint = findRole(root, 'hint');
  const error = findRole(root, 'error');
  if (!input) return;

  input.options ??= {};
  input.options.attributes ??= {};
  const attrs = input.options.attributes;
  const safeId = (id || 'field').replace(/[^a-zA-Z0-9_-]/g, '-');
  const inputId = `textbox-${safeId}`;

  const setOptional = (name: string, value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') delete attrs[name];
    else attrs[name] = String(value);
  };

  attrs['data-textbox-role'] = 'input';
  attrs['id'] = inputId;
  attrs['type'] = getNativeInputType(settings.valueType);
  attrs['inputmode'] = getInputMode(settings.valueType);
  attrs['placeholder'] = settings.placeholder ?? '';
  attrs['autocomplete'] = settings.autocomplete || 'off';
  attrs['value'] = settings.value ?? '';
  attrs['required'] = !!settings.required;
  attrs['disabled'] = !!settings.disabled;
  attrs['readonly'] = !!settings.readOnly;
  const describedBy: string[] = [];
  if (hint) {
    hint.options ??= {};
    hint.options.attributes ??= {};
    hint.options.attributes['id'] = `${inputId}-hint`;
    describedBy.push(`${inputId}-hint`);
  }
  if (error) {
    error.options ??= {};
    error.options.attributes ??= {};
    error.options.attributes['id'] = `${inputId}-error`;
    describedBy.push(`${inputId}-error`);
  }
  if (describedBy.length) attrs['aria-describedby'] = describedBy.join(' ');
  else delete attrs['aria-describedby'];
  setOptional('name', settings.name || `field-${safeId}`);
  setOptional('minlength', settings.minLength);
  setOptional('maxlength', settings.maxLength);
  setOptional('min', settings.min);
  setOptional('max', settings.max);
  setOptional('step', settings.step);

  if (label) {
    label.options ??= {};
    label.options.attributes ??= {};
    label.options.attributes['for'] = inputId;
  }
  if (error) {
    error.options ??= {};
    error.options.attributes ??= {};
    error.options.attributes['aria-live'] = 'polite';
    // A visible sample in the designer makes the error block selectable and styleable.
    error.options.attributes['hidden'] = false;
  }
}
