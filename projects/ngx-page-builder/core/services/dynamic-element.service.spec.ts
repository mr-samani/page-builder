import {
  AfterViewInit,
  Component,
  DestroyRef,
  Directive,
  DOCUMENT,
  EnvironmentInjector,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Type,
  createEnvironmentInjector,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamicElementService } from './dynamic-element.service';
import { PageItem } from '../models/PageItem';
import { COMPONENT_DATA } from '../models/tokens';
import { ComponentDataContext } from '../models/ComponentDataContext';

// ───────────────────────── helpers ─────────────────────────

const log: string[] = [];
let idCounter = 0;

function makeItem(init: Record<string, any> = {}): PageItem {
  return {
    id: `item-${++idCounter}`,
    tag: 'div',
    classList: [],
    children: [],
    options: {},
    ...init,
  } as unknown as PageItem;
}

function makeCustomItem(component: Type<any>, init: Record<string, any> = {}): PageItem {
  return makeItem({
    customComponent: { providers: [], componentData: undefined, compInjector: undefined },
    getComponentInstance: async () => component,
    ...init,
  });
}

// ───────────────────────── test directives ─────────────────────────

let lastDecorator: DecoratorDirective;
@Directive({ selector: '[decoratorDir]' })
class DecoratorDirective implements OnChanges, OnInit, OnDestroy {
  @Input() label = '';
  @Input('aliasName') aliased = '';
  @Output() pinged = new EventEmitter<string>();
  constructor() {
    lastDecorator = this;
  }
  ngOnChanges() {
    log.push('decorator:changes');
  }
  ngOnInit() {
    log.push(`decorator:init:${this.label}:${this.aliased}`);
  }
  ngOnDestroy() {
    log.push('decorator:destroy');
  }
}

let lastSignal: SignalDirective;
@Directive({ selector: '[signalDir]' })
class SignalDirective implements OnInit, OnDestroy {
  readonly label = input<string>('');
  readonly aliased = input<string>('', { alias: 'sigAlias' });
  readonly count = input<number, number | string>(0, { transform: (v) => Number(v) });
  readonly value = model<string>('');
  readonly done = output<string>();
  constructor() {
    lastSignal = this;
    inject(DestroyRef).onDestroy(() => log.push('signal:destroyRef'));
  }
  ngOnInit() {
    log.push(`signal:init:${this.label()}:${this.aliased()}:${this.count()}:${this.value()}`);
  }
  ngOnDestroy() {
    log.push('signal:destroy');
  }
}

@Directive({ selector: '[orderDir]' })
class OrderDirective implements OnDestroy {
  @Input() tag = '';
  ngOnDestroy() {
    log.push(`order:destroy:${this.tag}`);
  }
}

let lastDocDirective: DocDirective;
@Directive({ selector: '[docDir]' })
class DocDirective {
  readonly doc = inject(DOCUMENT);
  constructor() {
    lastDocDirective = this;
  }
}

// ───────────────────────── test components ─────────────────────────

let lastBlock: BlockComponent;
@Component({
  selector: 'test-block',
  template: `
    <span class="inner">{{ title() }}|{{ legacy }}|{{ data?.data }}</span>
  `,
})
class BlockComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
  readonly pageItem = input<PageItem>();
  readonly editMode = input<boolean>(false);
  readonly title = input<string>('');
  readonly value = model<string>('');
  @Input() legacy = '';
  @Input('legacyAlias') legacyAliased = '';
  @Output() legacyEvent = new EventEmitter<string>();
  readonly signalEvent = output<string>();
  readonly data = inject<ComponentDataContext>(COMPONENT_DATA);
  constructor() {
    lastBlock = this;
  }
  ngOnChanges() {
    log.push('block:changes');
  }
  ngOnInit() {
    log.push(`block:init:${this.title()}:${this.editMode()}:${this.legacy}`);
  }
  ngAfterViewInit() {
    log.push('block:afterViewInit');
  }
  ngOnDestroy() {
    log.push('block:destroy');
  }
}

// ───────────────────────── specs ─────────────────────────

describe('DynamicElementService', () => {
  let service: DynamicElementService;
  let host: HTMLElement;

  beforeEach(() => {
    log.length = 0;
    TestBed.configureTestingModule({});
    service = TestBed.inject(DynamicElementService);
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  describe('plain element', () => {
    it('creates the element, sets data-id, classes and attributes', async () => {
      const item = makeItem({
        tag: 'section',
        classList: ['a', 'b'],
        options: { attributes: { title: 'hi', hidden: true, disabled: false, 'data-x': 5 } },
      });
      const el = await service.createBlock([], false, host, -1, item);

      expect(el.tagName).toBe('SECTION');
      expect(el.parentElement).toBe(host);
      expect(el.dataset['id']).toBe(item.id);
      expect(el.classList.contains('a') && el.classList.contains('b')).toBe(true);
      expect(el.getAttribute('title')).toBe('hi');
      expect(el.getAttribute('hidden')).toBe('');
      expect(el.hasAttribute('disabled')).toBe(false);
      expect(el.getAttribute('data-x')).toBe('5');
      expect(item.el).toBe(el);
    });

    it('inserts at the given index', async () => {
      const first = await service.createBlock([], false, host, -1, makeItem());
      const second = await service.createBlock([], false, host, 0, makeItem());
      expect(host.children[0]).toBe(second);
      expect(host.children[1]).toBe(first);
    });

    it('keeps item.content after directives are attached', async () => {
      const item = makeItem({
        content: '<b>x</b>',
        options: { directives: [{ directive: DecoratorDirective, inputs: { label: 'l' } }] },
      });
      const el = await service.createBlock([], false, host, -1, item);
      expect(el.innerHTML).toBe('<b>x</b>');
    });

    it('destroy returns false when the item has no element', async () => {
      expect(await service.destroy(makeItem())).toBe(false);
    });
  });

  describe('directives on plain element', () => {
    it.each(['aliased', 'aliasName'])(
      '@Input decorator (alias set via "%s") + ngOnChanges before ngOnInit',
      async (aliasKey) => {
        const item = makeItem({
          options: {
            directives: [
              { directive: DecoratorDirective, inputs: { label: 'hello', [aliasKey]: 'world' }, outputs: {} },
            ],
          },
        });
        await service.createBlock([], false, host, -1, item);

        expect(lastDecorator.label).toBe('hello');
        expect(lastDecorator.aliased).toBe('world');
        expect(log.indexOf('decorator:changes')).toBeGreaterThanOrEqual(0);
        expect(log.indexOf('decorator:changes')).toBeLessThan(log.indexOf('decorator:init:hello:world'));
      },
    );

    it.each(['aliased', 'sigAlias'])('input() signal (alias set via "%s") and input transform', async (aliasKey) => {
      const item = makeItem({
        options: {
          directives: [
            { directive: SignalDirective, inputs: { label: 'L', [aliasKey]: 'A', count: '5' }, outputs: {} },
          ],
        },
      });
      await service.createBlock([], false, host, -1, item);

      expect(lastSignal.label()).toBe('L');
      expect(lastSignal.aliased()).toBe('A');
      expect(lastSignal.count()).toBe(5);
      expect(log).toContain('signal:init:L:A:5:');
    });

    it('model() receives its initial value', async () => {
      const item = makeItem({
        options: { directives: [{ directive: SignalDirective, inputs: { value: 'init' }, outputs: {} }] },
      });
      await service.createBlock([], false, host, -1, item);
      expect(lastSignal.value()).toBe('init');
      expect(log).toContain('signal:init:::0:init');
    });

    it('subscribes to EventEmitter, output() and model() outputs (property or public name)', async () => {
      const onPing = vi.fn();
      const onDone = vi.fn();
      const onValue = vi.fn();
      const onValueChange = vi.fn();
      const item = makeItem({
        options: {
          directives: [
            { directive: DecoratorDirective, inputs: {}, outputs: { pinged: onPing } },
            {
              directive: SignalDirective,
              inputs: {},
              outputs: { done: onDone, value: onValue, valueChange: onValueChange },
            },
          ],
        },
      });
      await service.createBlock([], false, host, -1, item);

      lastDecorator.pinged.emit('p');
      lastSignal.done.emit('d');
      lastSignal.value.set('v');

      expect(onPing).toHaveBeenCalledWith('p');
      expect(onDone).toHaveBeenCalledWith('d');
      expect(onValue).toHaveBeenCalledWith('v');
      expect(onValueChange).toHaveBeenCalledWith('v');
    });

    it('warns (and does not throw) for unknown inputs/outputs', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const item = makeItem({
        options: {
          directives: [{ directive: DecoratorDirective, inputs: { nope: 1 }, outputs: { nopeOut: () => {} } }],
        },
      });
      await expect(service.createBlock([], false, host, -1, item)).resolves.toBeTruthy();
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it('destroy() calls ngOnDestroy and DestroyRef callbacks, and removes the element', async () => {
      const item = makeItem({
        options: {
          directives: [
            { directive: DecoratorDirective, inputs: { label: 'x' } },
            { directive: SignalDirective, inputs: { label: 'y' } },
          ],
        },
      });
      const el = await service.createBlock([], false, host, -1, item);
      expect(el.isConnected).toBe(true);

      expect(await service.destroy(item)).toBe(true);

      expect(log).toContain('decorator:destroy');
      expect(log).toContain('signal:destroy');
      expect(log).toContain('signal:destroyRef');
      expect(el.isConnected).toBe(false);
    });

    it('destroy() twice does not call hooks twice', async () => {
      const item = makeItem({ options: { directives: [{ directive: DecoratorDirective, inputs: {} }] } });
      await service.createBlock([], false, host, -1, item);
      await service.destroy(item);
      await service.destroy(item);
      expect(log.filter((l) => l === 'decorator:destroy')).toHaveLength(1);
    });

    it('destroys children before the parent', async () => {
      const parent = makeItem({ options: { directives: [{ directive: OrderDirective, inputs: { tag: 'parent' } }] } });
      const parentEl = await service.createBlock([], false, host, -1, parent);
      const child = makeItem({ options: { directives: [{ directive: OrderDirective, inputs: { tag: 'child' } }] } });
      await service.createBlock([], false, parentEl, -1, child);
      (parent as any).children = [child];

      await service.destroy(parent);
      expect(log.filter((l) => l.startsWith('order:'))).toEqual(['order:destroy:child', 'order:destroy:parent']);
    });
  });

  describe('changeElementTagName', () => {
    it('moves children, recreates directives on the new element and destroys the old ones', async () => {
      const item = makeItem({
        options: { directives: [{ directive: DecoratorDirective, inputs: { label: 'x' } }] },
      });
      const oldEl = await service.createBlock([], false, host, -1, item);
      const childEl = document.createElement('i');
      oldEl.appendChild(childEl);

      log.length = 0;
      const newEl = await service.changeElementTagName(item, 'section');

      expect(newEl!.tagName).toBe('SECTION');
      expect(newEl!.parentElement).toBe(host);
      expect(oldEl.isConnected).toBe(false);
      expect(newEl!.contains(childEl)).toBe(true);
      expect(item.el).toBe(newEl);
      expect(item.tag).toBe('section');
      expect(log[0]).toBe('decorator:destroy');
      expect(log).toContain('decorator:init:x:');
    });

    it('refuses to change the tag of a custom component', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const item = makeCustomItem(BlockComponent);
      await service.createBlock([], false, host, -1, item);
      expect(await service.changeElementTagName(item, 'section')).toBeNull();
    });
  });

  describe('custom component', () => {
    it('renders, sets pageItem/editMode, decorator + signal + model + alias inputs and runs hooks in order', async () => {
      const item = makeCustomItem(BlockComponent, {
        options: { inputs: { title: 'T', legacy: 'L', legacyAlias: 'LA', value: 'm' } },
      });
      const el = await service.createBlock([], true, host, -1, item);

      expect(lastBlock.pageItem()).toBe(item);
      expect(lastBlock.editMode()).toBe(true);
      expect(lastBlock.title()).toBe('T');
      expect(lastBlock.legacy).toBe('L');
      expect(lastBlock.legacyAliased).toBe('LA');
      expect(lastBlock.value()).toBe('m');
      expect(el.querySelector('.inner')!.textContent).toContain('T|L');

      expect(log.indexOf('block:changes')).toBeLessThan(log.indexOf('block:init:T:true:L'));
      expect(log.indexOf('block:init:T:true:L')).toBeLessThan(log.indexOf('block:afterViewInit'));
    });

    it('subscribes to EventEmitter, output() and aliased outputs', async () => {
      const onLegacy = vi.fn();
      const onSignal = vi.fn();
      const onModel = vi.fn();
      const item = makeCustomItem(BlockComponent, {
        options: { outputs: { legacyEvent: onLegacy, signalEvent: onSignal, valueChange: onModel } },
      });
      await service.createBlock([], false, host, -1, item);

      lastBlock.legacyEvent.emit('a');
      lastBlock.signalEvent.emit('b');
      lastBlock.value.set('c');

      expect(onLegacy).toHaveBeenCalledWith('a');
      expect(onSignal).toHaveBeenCalledWith('b');
      expect(onModel).toHaveBeenCalledWith('c');
    });

    it('provides COMPONENT_DATA, stores compInjector and updates componentData via onChange', async () => {
      const item = makeCustomItem(BlockComponent);
      (item.customComponent as any).componentData = 'initial';
      await service.createBlock([], false, host, -1, item);

      expect(lastBlock.data.data).toBe('initial');
      expect(item.customComponent!.compInjector).toBeTruthy();

      lastBlock.data.onChange.next('changed');
      expect(item.customComponent!.componentData).toBe('changed');
    });

    it('applies directives (inputs + lifecycle) on the custom component and destroys everything', async () => {
      const item = makeCustomItem(BlockComponent, {
        options: {
          directives: [{ directive: SignalDirective, inputs: { label: 'dir', count: 2 }, outputs: {} }],
        },
      });
      const el = await service.createBlock([], false, host, -1, item);

      expect(lastSignal.label()).toBe('dir');
      expect(lastSignal.count()).toBe(2);
      expect(log).toContain('signal:init:dir::2:');

      await service.destroy(item);

      expect(log).toContain('block:destroy');
      expect(log).toContain('signal:destroy');
      expect(log).toContain('signal:destroyRef');
      expect(el.isConnected).toBe(false);
      expect(item.customComponent!.compInjector).toBeUndefined();
    });

    it('supports component inputs together with directives that have input bindings (no NG0317)', async () => {
      const item = makeCustomItem(BlockComponent, {
        options: {
          inputs: { title: 'T', legacy: 'L', legacyAlias: 'LA', value: 'm' },
          directives: [{ directive: SignalDirective, inputs: { label: 'dir', value: 'dv' }, outputs: {} }],
        },
      });
      const el = await service.createBlock([], true, host, -1, item);

      expect(lastBlock.pageItem()).toBe(item);
      expect(lastBlock.editMode()).toBe(true);
      expect(lastBlock.title()).toBe('T');
      expect(lastBlock.legacy).toBe('L');
      expect(lastBlock.legacyAliased).toBe('LA');
      expect(lastBlock.value()).toBe('m');
      expect(lastSignal.label()).toBe('dir');
      expect(lastSignal.value()).toBe('dv');
      expect(log.indexOf('block:changes')).toBeLessThan(log.indexOf('block:init:T:true:L'));
      expect(el.querySelector('.inner')!.textContent).toContain('T|L');
    });

    it('does not wipe the component view when item.content is set', async () => {
      const item = makeCustomItem(BlockComponent, { content: '<b>ignored</b>', options: { inputs: { title: 'T' } } });
      const el = await service.createBlock([], false, host, -1, item);
      expect(el.querySelector('.inner')).toBeTruthy();
    });

    it('throws and cleans up when the component cannot be resolved', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const item = makeItem({
        customComponent: { providers: [] },
        getComponentInstance: async () => undefined,
      });
      await expect(service.createBlock([], false, host, -1, item)).rejects.toThrow('Not exist custom component');
      expect(host.children).toHaveLength(0);
    });
  });

  describe('foreign document (editor iframe)', () => {
    let foreignDoc: Document;

    beforeEach(() => {
      foreignDoc = document.implementation.createHTMLDocument('foreign');
    });

    it('creates elements in the foreign document and injects its DOCUMENT into directives (unregistered)', async () => {
      const item = makeItem({ options: { directives: [{ directive: DocDirective, inputs: {} }] } });
      const el = await service.createBlock([], false, foreignDoc.body, -1, item);

      expect(el.ownerDocument).toBe(foreignDoc);
      expect(lastDocDirective.doc).toBe(foreignDoc);
    });

    it('uses the registered environment injector of the foreign document', async () => {
      const env = createEnvironmentInjector(
        [{ provide: DOCUMENT, useValue: foreignDoc }],
        TestBed.inject(EnvironmentInjector),
      );
      service.registerDocument(foreignDoc, env);

      const item = makeItem({ options: { directives: [{ directive: DocDirective, inputs: {} }] } });
      await service.createBlock([], false, foreignDoc.body, -1, item);
      expect(lastDocDirective.doc).toBe(foreignDoc);

      const cmpItem = makeCustomItem(BlockComponent, {
        options: { directives: [{ directive: DocDirective, inputs: {} }] },
      });
      const el = await service.createBlock([], false, foreignDoc.body, -1, cmpItem);
      expect(el.ownerDocument).toBe(foreignDoc);
      expect(lastDocDirective.doc).toBe(foreignDoc);

      await service.destroy(item);
      await service.destroy(cmpItem);
      service.unregisterDocument(foreignDoc);
      env.destroy();
    });
  });
});
