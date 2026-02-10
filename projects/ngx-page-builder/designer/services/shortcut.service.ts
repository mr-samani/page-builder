import { Injectable, inject, DOCUMENT } from '@angular/core';
import { fromEvent, merge, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * ✅ Focus context detection - where is user's attention?
 */
export enum FocusContext {
  CANVAS = 'canvas', // روی canvas اصلی
  TEXT_EDITING = 'text_editing', // داخل input/textarea/contenteditable
  MODAL = 'modal', // داخل modal/dialog
  SIDEBAR = 'sidebar', // داخل sidebar/panel
  NONE = 'none',
}

/**
 * ✅ Command definition
 */
export interface ShortcutCommand {
  key: string; // 'Delete', 'c', 'v', etc.
  ctrl?: boolean; // Ctrl key (Cmd on Mac)
  shift?: boolean; // Shift key
  alt?: boolean; // Alt key
  contexts: FocusContext[]; // در کدام context‌ها فعال باشد
  action: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean; // آیا preventDefault شود
}

@Injectable({
  providedIn: 'root',
})
export class PageBuilderShortcutService {
  private readonly doc = inject(DOCUMENT);
  private subscriptions: Subscription[] = [];
  private commands = new Map<string, ShortcutCommand>();
  private isEnabled = true;

  constructor() {
    this.initShortcutListener();
  }

  /**
   * ✅ Register a keyboard shortcut
   */
  register(id: string, command: ShortcutCommand): void {
    this.commands.set(id, command);
  }

  /**
   * ✅ Unregister a shortcut
   */
  unregister(id: string): void {
    this.commands.delete(id);
  }

  /**
   * ✅ Enable/disable all shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * ✅ Get current focus context
   */
  getCurrentContext(): FocusContext {
    const activeEl = this.doc.activeElement as HTMLElement;

    if (!activeEl || activeEl === this.doc.body) {
      return FocusContext.CANVAS;
    }

    // Check if user is typing in text field
    if (this.isTextInputElement(activeEl)) {
      return FocusContext.TEXT_EDITING;
    }

    // Check if inside modal
    if (activeEl.closest('[role="dialog"]') || activeEl.closest('.modal')) {
      return FocusContext.MODAL;
    }

    // Check if inside sidebar
    if (activeEl.closest('.sidebar') || activeEl.closest('.properties-panel')) {
      return FocusContext.SIDEBAR;
    }

    return FocusContext.CANVAS;
  }

  /**
   * ✅ Check if element is a text input (input, textarea, contenteditable)
   */
  private isTextInputElement(el: HTMLElement): boolean {
    if (!el) return false;

    const tagName = el.tagName.toLowerCase();

    // Check standard inputs
    if (tagName === 'input') {
      const inputType = (el as HTMLInputElement).type.toLowerCase();
      // Text input types that allow typing
      const textInputTypes = ['text', 'password', 'email', 'search', 'tel', 'url', 'number'];
      return textInputTypes.includes(inputType);
    }

    // Check textarea
    if (tagName === 'textarea') {
      return true;
    }

    // Check contenteditable
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      return true;
    }

    // Check if parent is contenteditable
    const parent = el.parentElement;
    if (parent && (parent.isContentEditable || parent.getAttribute('contenteditable') === 'true')) {
      return true;
    }

    return false;
  }

  /**
   * ✅ Initialize keyboard listener
   */
  private initShortcutListener(): void {
    const keydown$ = fromEvent<KeyboardEvent>(this.doc, 'keydown');

    this.subscriptions.push(
      keydown$.subscribe((event) => {
        if (!this.isEnabled) return;

        this.handleKeyboardEvent(event);
      }),
    );
  }

  /**
   * ✅ Handle keyboard event
   */
  private handleKeyboardEvent(event: KeyboardEvent): void {
    const currentContext = this.getCurrentContext();

    // Find matching commands
    for (const [id, command] of this.commands.entries()) {
      // Check if command is active in current context
      if (!command.contexts.includes(currentContext)) {
        continue;
      }

      // Check key match
      if (!this.isKeyMatch(event, command)) {
        continue;
      }

      // Execute command
      if (command.preventDefault !== false) {
        event.preventDefault();
        event.stopPropagation();
      }

      command.action(event);
      break; // Stop after first match
    }
  }

  /**
   * ✅ Check if keyboard event matches command
   */
  private isKeyMatch(event: KeyboardEvent, command: ShortcutCommand): boolean {
    // Key match
    const keyMatch = event.key.toLowerCase() === command.key.toLowerCase();
    if (!keyMatch) return false;

    // Modifier keys (Ctrl/Cmd, Shift, Alt)
    const ctrlKey = event.ctrlKey || event.metaKey; // Cmd on Mac
    const ctrlMatch = command.ctrl === undefined || command.ctrl === ctrlKey;
    const shiftMatch = command.shift === undefined || command.shift === event.shiftKey;
    const altMatch = command.alt === undefined || command.alt === event.altKey;

    return ctrlMatch && shiftMatch && altMatch;
  }

  /**
   * ✅ Get all registered shortcuts for documentation
   */
  getShortcuts(): Array<{ id: string; command: ShortcutCommand }> {
    return Array.from(this.commands.entries()).map(([id, command]) => ({
      id,
      command,
    }));
  }

  /**
   * ✅ Cleanup
   */
  destroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.commands.clear();
  }
}

/**
 * ✅ Helper: Format shortcut for display
 */
export function formatShortcut(command: ShortcutCommand): string {
  const parts: string[] = [];
  const isMac = navigator.platform.toLowerCase().includes('mac');

  if (command.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (command.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (command.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format key name
  let keyName = command.key;
  if (keyName === ' ') keyName = 'Space';
  if (keyName === 'Delete') keyName = isMac ? '⌫' : 'Del';
  if (keyName === 'Backspace') keyName = isMac ? '⌫' : 'Backspace';
  if (keyName === 'Enter') keyName = '↵';
  if (keyName === 'Escape') keyName = 'Esc';

  parts.push(keyName.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
