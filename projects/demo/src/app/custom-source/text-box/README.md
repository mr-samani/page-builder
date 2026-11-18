# Samani Textbox custom block for ngx-page-builder

Custom textbox implementation for the current `ngx-page-builder` API. The designer and runtime preview are separate components and are registered through their own source registries.

## What's included

- Editable native `PageItem` blocks for the label, control wrapper, icon, input, helper text and error text.
- Input types: text, email, mobile (`tel`), number, URL, password, search, date, time and datetime-local.
- Built-in validation choices: email, international mobile, Iranian mobile, phone, digits, letters, alphanumeric, Iranian postal code, username and strong password.
- Custom regular expression editor with compile validation, a test value, a maximum expression length and conservative rejection of common high-risk patterns.
- Stable error keys with user-editable message text.
- Eleven appearance presets, including Material-inspired outlined and filled styles, gradient accent and neumorphic styles.
- Child `PageItem.css` styles so the page builder's normal block style, state and animation editors remain in control.
- Separate preview implementation using `PagePreviewService`.

## File layout

```text
textbox-custom-block/
  shared/
    textbox.model.ts
    textbox-template.ts
    textbox-validation.ts
  designer/
    textbox.source.ts
    textbox.component.ts
    textbox.component.html
    textbox.component.scss
    textbox-settings.component.ts
    textbox-settings.component.html
    textbox-settings.component.scss
  preview/
    textbox-preview.source.ts
    textbox-preview.component.ts
    textbox-preview.component.html
    textbox-preview.component.scss
  registration.example.ts
```

## Register it

Copy the folders into your application/library and update the import paths if you change their location.

Add the designer source to the existing `providePageBuilder` configuration and add the preview source to `providePagePreview`:

```ts
import { providePageBuilder } from 'ngx-page-builder/designer';
import { providePagePreview } from 'ngx-page-builder/preview';
import { TextboxSource } from './textbox-custom-block/designer/textbox.source';
import { TextboxPreviewSource } from './textbox-custom-block/preview/textbox-preview.source';

export const providers = [
  providePageBuilder({
    // keep your existing options and custom sources
    customSources: [TextboxSource],
  }),
  providePagePreview({
    // keep your existing preview custom sources
    customSources: [TextboxPreviewSource],
  }),
];
```

Do not replace an existing `customSources` array; append `TextboxSource` / `TextboxPreviewSource` to it.

The designer and preview definitions deliberately use the same `componentKey` (`SamaniTextbox`). The preview provider must be registered in the application that hosts `NgxPagePreviewComponent`.

## How it works

`TextboxComponent` creates a `PageItem.template` tree and renders its root using `PageBuilderService.createBlockElement`. It does not use a fixed HTML form-field template. The resulting label, wrapper, icon, input, hint and error nodes are ordinary page-builder blocks. Each node has a `data-textbox-role` attribute so the custom component can update its input attributes and connect validation without taking over the nodes' content or styles.

When an inner block is edited, the component uses `itemInThisTemplate` and `snapshotTemplate` (the same template-snapshot approach used by the repository's HeroTable source) to persist the editable block tree. Validation uses native input events and updates the editable error block; it does not add another Angular-rendered label or message to the DOM.

The preview component uses `PagePreviewService.createBlockElement` and the same saved tree, with no dependency on `PageBuilderService` or the settings inspector.

## Appearance behavior

The initial template receives the chosen appearance through each block's `PageItem.css`. Changing the Appearance setting reapplies the chosen preset to the template's role-based blocks. The implementation records the declarations owned by the previous preset and merges the next preset while retaining user overrides and explicit removals where possible. After selecting a preset, use the normal style inspector to customize individual blocks.

The Material styles are Material-inspired CSS presets applied to native HTML elements. They do not depend on `@angular/material` being installed.

## Validation notes

- The rule returns a stable error key; the displayed message is read from `settings.messages`.
- Email and URL input types always receive their type-level validation when non-empty. Number inputs are checked for numeric values and configured min/max bounds.
- Custom regex syntax is checked with `RegExp` before use. The editor rejects backreferences, lookarounds, nested repeated groups, repeated alternation groups and expressions longer than 160 characters. This is a conservative client-side guard, not a formal regex execution timeout.
- Client-side validation is for user experience only. Validate the submitted value again on the backend.

## Editable block roles

The role attributes are the bridge between the custom component and the visual template. Users can freely edit text and `PageItem.css`; avoid removing or renaming `data-textbox-role` attributes, as the component uses them to locate the input and error nodes. The title (`label`) is intentionally not duplicated in settings: edit it directly on the canvas just like any other page-builder text block.

## Current scope

This component handles the field UI and client-side validation only. It does not implement form submission, backend validation, data-source binding or responsive-specific settings. Responsive styles and animation remain available through each block's normal page-builder style controls.
