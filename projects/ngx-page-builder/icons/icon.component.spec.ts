import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NgxIconComponent } from './icon.component';
import { IconRegistry } from './icon-registry';
import type { IconDefinition } from './icon-definition';

const box: IconDefinition = {
  name: 'box',
  viewBox: '0 0 24 24',
  nodes: [['rect', { width: '24', height: '24' }]],
};

function create(icon: unknown, inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(NgxIconComponent);
  fixture.componentRef.setInput('icon', icon);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('NgxIconComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [NgxIconComponent] }));

  it('renders a definition passed directly, inheriting currentColor', () => {
    const el = create(box);
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.querySelector('rect')).not.toBeNull();
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('resolves icons by name from the registry (reactively)', () => {
    const fixture = TestBed.createComponent(NgxIconComponent);
    fixture.componentRef.setInput('icon', 'box');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('rect')).toBeNull();
    TestBed.inject(IconRegistry).register(box);
    fixture.detectChanges();
    expect(el.querySelector('rect')).not.toBeNull();
  });

  it('exposes role/aria-label for meaningful icons', () => {
    const el = create(box, { label: 'Box' });
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Box');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('drops disallowed tags and unsafe attributes', () => {
    const evil = {
      name: 'evil',
      viewBox: '0 0 1 1',
      nodes: [
        ['script', {}],
        ['path', { d: 'M0 0', onclick: 'alert(1)', style: 'x', fill: 'url(https://evil)' }],
      ],
    } as unknown as IconDefinition;
    const el = create(evil);
    expect(el.querySelector('script')).toBeNull();
    const path = el.querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M0 0');
    expect(path.hasAttribute('onclick')).toBe(false);
    expect(path.hasAttribute('style')).toBe(false);
    expect(path.hasAttribute('fill')).toBe(false);
  });
});
