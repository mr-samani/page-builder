import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
  Renderer2,
} from '@angular/core';
import type { NgxIconName } from './generated/icon-names';
import type { IconDefinition, IconNode } from './icon-definition';
import { IconRegistry } from './icon-registry';

/** Autocomplete for built-in names, but custom (string) names stay allowed. */
export type NgxIconInput = IconDefinition | NgxIconName | (string & {});

// Keep in sync with scripts/generate-icons.mjs
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'g',
  'defs',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
]);
const URL_REF = /^url\(#[\w.:-]+\)$/;
const warned = new Set<string>();

function isSafeAttr(name: string, value: string): boolean {
  const n = name.toLowerCase();
  if (n.startsWith('on') || n === 'style' || n === 'href') return false;
  if (n.startsWith('xlink') || n.startsWith('xmlns')) return false;
  if (/javascript:/i.test(value)) return false;
  if (value.includes('url(') && !URL_REF.test(value.trim())) return false;
  return true;
}

/**
 * Renders an icon as an inline <svg> that inherits `currentColor`.
 *
 *   <ngx-icon icon="grip-dots" />                    registry (by name)
 *   <ngx-icon [icon]="gripDots" size="20px" />       direct definition (best tree-shaking)
 *   <ngx-icon icon="close" label="Close" />          meaningful icon → role="img" + aria-label
 *   <ngx-icon icon="chevron-right" flipRtl />        mirrored automatically in RTL
 *
 * The <svg> is built with Renderer2.createElement (namespaced) – no innerHTML,
 * no DomSanitizer, works with SSR/hydration, and every tag/attribute is allow-listed.
 */
@Component({
  selector: 'ngx-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
      vertical-align: -0.125em;
      color: inherit;
      min-width: 0;
      min-height: 0;
    }
    :host(.ngx-icon--flip:dir(rtl)) {
      transform: scaleX(-1);
    }
  `,
  host: {
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[class.ngx-icon--flip]': 'flipRtl()',
  },
})
export class NgxIconComponent {
  /** Icon name (registry) or an IconDefinition (direct). */
  readonly icon = input.required<NgxIconInput>();
  /** Any CSS length. Default scales with font-size. */
  readonly width = input<string>('auto');
  readonly height = input<string>('100%');
  /** Accessible name. Omit for decorative icons (they get aria-hidden). */
  readonly label = input<string | null>(null);
  /** Mirror horizontally in RTL (arrows, chevrons, undo/redo ...). */
  readonly flipRtl = input(false, { transform: booleanAttribute });

  private readonly registry = inject(IconRegistry);
  private readonly renderer = inject(Renderer2);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly svg: SVGElement = this.renderer.createElement('svg', 'svg');
  private applied: string[] = [];

  private readonly definition = computed<IconDefinition | undefined>(() => {
    const value = this.icon();
    if (typeof value !== 'string') return value;
    const def = this.registry.get(value);
    if (!def && isDevMode() && !warned.has(value)) {
      warned.add(value);
      console.warn(
        `[ngx-icon] Icon "${value}" is not registered. Use provideIcons(...) or pass the definition via [icon].`,
      );
    }
    return def;
  });

  constructor() {
    const { renderer, svg } = this;
    renderer.setAttribute(svg, 'focusable', 'false');
    renderer.setAttribute(svg, 'width', '100%');
    renderer.setAttribute(svg, 'height', '100%');
    renderer.setStyle(svg, 'display', 'block');
    renderer.appendChild(this.host, svg);

    effect(() => this.paint(this.definition()));
  }

  private paint(def: IconDefinition | undefined): void {
    const { renderer, svg } = this;

    while (svg.firstChild) renderer.removeChild(svg, svg.firstChild);
    for (const a of this.applied) renderer.removeAttribute(svg, a);
    this.applied = [];
    if (!def) return;

    const rootAttrs: Record<string, string> = { viewBox: def.viewBox, ...def.attrs };
    if (!('fill' in rootAttrs)) rootAttrs['fill'] = 'currentColor';
    for (const [k, v] of Object.entries(rootAttrs)) {
      if (k !== 'viewBox' && !isSafeAttr(k, v)) continue;
      renderer.setAttribute(svg, k, v);
      this.applied.push(k);
    }

    this.build(svg, def.nodes);
  }

  private build(parent: Node, nodes: readonly IconNode[]): void {
    for (const [tag, attrs, children] of nodes) {
      if (!ALLOWED_TAGS.has(tag)) continue;
      const el = this.renderer.createElement(tag, 'svg');
      for (const [k, v] of Object.entries(attrs)) {
        if (isSafeAttr(k, v)) this.renderer.setAttribute(el, k, v);
      }
      if (children?.length) this.build(el, children);
      this.renderer.appendChild(parent, el);
    }
  }
}
