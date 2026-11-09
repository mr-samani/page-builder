export { NgxIconComponent, type NgxIconInput } from './icon.component';
export { IconRegistry } from './icon-registry';
export { provideIcons } from './provide-icons';
export type { IconDefinition, IconNode } from './icon-definition';

// Built-in icons: named exports → tree-shaken per icon.
export * from './generated';
export type { NgxIconName } from './generated/icon-names';
export { ALL_ICONS } from './generated/all';
