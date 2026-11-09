import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import type { IconDefinition } from './icon-definition';
import { IconRegistry } from './icon-registry';

/**
 * Registers icons so they can be used by name: `<ngx-icon icon="close" />`.
 * Works in app.config.ts and in lazy route `providers` (icons load with the chunk).
 *
 *   provideIcons(close, gripDots)
 *   provideIcons([close, gripDots], myCustomIcon)   // arrays are flattened
 */
export function provideIcons(
  ...icons: ReadonlyArray<IconDefinition | readonly IconDefinition[]>
): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    inject(IconRegistry).register(...icons.flat());
  });
}
