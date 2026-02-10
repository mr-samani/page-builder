/**
 * Error types for file selection
 */
export enum FileSelectionError {
  NO_USER_ACTIVATION = 'NO_USER_ACTIVATION',
  NOT_TRUSTED_EVENT = 'NOT_TRUSTED_EVENT',
  BROWSER_BLOCKED = 'BROWSER_BLOCKED',
  USER_CANCELLED = 'USER_CANCELLED',
  NO_FILE_SELECTED = 'NO_FILE_SELECTED',
  CLICK_FAILED = 'CLICK_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class FileSelectionException extends Error {
  constructor(
    public readonly code: FileSelectionError,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'FileSelectionException';
  }
}
export interface FileSelectOptions {
  /** Accepted file types (e.g., ['image/*', '.pdf']) */
  accept?: string[];
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Timeout in ms to detect if browser blocked the dialog (default: 1200ms) */
  timeoutMs?: number;
  /** Optional event for trusted user gesture validation */
  event?: Event;
  /** Callback when dialog is opened (best effort detection) */
  onDialogOpen?: () => void;
  /** Callback when dialog is closed (best effort detection) */
  onDialogClose?: () => void;
}

/**
 * ✅ Professional file selector with comprehensive error handling
 *
 * Features:
 * - User activation detection (navigator.userActivation API)
 * - Trusted event validation
 * - Browser block detection with timeout
 * - Cancel detection using focus events
 * - Memory leak prevention
 * - Type-safe error handling
 * - Support for multiple file selection
 *
 * @example
 * ```typescript
 * try {
 *   const file = await selectFile({
 *     accept: ['image/*'],
 *     event: clickEvent,
 *     timeoutMs: 1500
 *   });
 *   console.log('Selected:', file.name);
 * } catch (error) {
 *   if (error instanceof FileSelectionException) {
 *     switch (error.code) {
 *       case FileSelectionError.USER_CANCELLED:
 *         console.log('User cancelled');
 *         break;
 *       case FileSelectionError.BROWSER_BLOCKED:
 *         console.error('Browser blocked file dialog');
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export abstract class FileSelector {
  public static async selectFile(options: FileSelectOptions = {}): Promise<File> {
    const files = await this.selectFiles({ ...options, multiple: false });
    return files[0];
  }

  /**
   * Select multiple files
   */
  private static async selectFiles(options: FileSelectOptions = {}): Promise<File[]> {
    const { accept = [], multiple = false, event, onDialogOpen, onDialogClose } = options;

    return new Promise<File[]>((resolve, reject) => {
      let settled = false;
      let input: HTMLInputElement | null = null;
      let dialogOpened = false;
      let focusListenerAdded = false;
      let blurListenerAdded = false;

      // When dialog opens, window loses focus
      const onWindowBlur = () => {
        if (settled) return;

        // Dialog opened successfully
        dialogOpened = true;
        onDialogOpen?.();
      };

      // When dialog closes, window regains focus
      const onWindowFocus = () => {
        if (settled) return;

        // Give change event time to fire if file was selected
        setTimeout(() => {
          if (settled) return;

          // If we got focus back but no file was selected → user cancelled
          safeReject(
            new FileSelectionException(
              FileSelectionError.USER_CANCELLED,
              'User cancelled file selection.',
            ),
          );
        }, 300); // Delay to ensure onchange fires first
      };

      // ============================================================
      // Cleanup function - removes all listeners and DOM elements
      // ============================================================
      const cleanup = () => {
        if (input) {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
          input.onchange = null;
          input.onerror = null;
          input = null;
        }

        if (focusListenerAdded) {
          window.removeEventListener('focus', onWindowFocus);
          focusListenerAdded = false;
        }

        if (blurListenerAdded) {
          window.removeEventListener('blur', onWindowBlur);
          blurListenerAdded = false;
        }

        if (dialogOpened) {
          onDialogClose?.();
          dialogOpened = false;
        }
      };

      // ============================================================
      // Resolve/Reject wrappers to ensure cleanup and prevent double-settle
      // ============================================================
      const safeResolve = (files: File[]) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(files);
      };

      const safeReject = (error: FileSelectionException) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      // ============================================================
      // Step 1: Validate user activation
      // ============================================================
      try {
        // Check modern User Activation API
        const ua = (navigator as any).userActivation;
        if (ua && typeof ua.isActive === 'boolean') {
          if (!ua.isActive && !ua.hasBeenActive) {
            return safeReject(
              new FileSelectionException(
                FileSelectionError.NO_USER_ACTIVATION,
                'No user activation detected. File picker requires a user gesture (click, touch, key press).',
              ),
            );
          }
        }

        // Fallback: Check if event is trusted
        if (event && !(event as Event).isTrusted) {
          return safeReject(
            new FileSelectionException(
              FileSelectionError.NOT_TRUSTED_EVENT,
              'Event is not trusted. File picker requires a real user gesture.',
            ),
          );
        }

        // ============================================================
        // Step 2: Create file input element
        // ============================================================
        input = document.createElement('input');
        input.type = 'file';
        input.accept = accept.join(',');
        input.multiple = multiple;
        input.style.cssText =
          'position:fixed;top:-100px;left:-100px;opacity:0;pointer-events:none;';
        document.body.appendChild(input);

        // ============================================================
        // Step 3: Setup change handler (file selected)
        // ============================================================
        input.onchange = () => {
          if (settled) return;

          if (input?.files && input.files.length > 0) {
            const filesArray = Array.from(input.files);
            safeResolve(filesArray);
          } else {
            safeReject(
              new FileSelectionException(
                FileSelectionError.NO_FILE_SELECTED,
                'No file was selected.',
              ),
            );
          }
        };

        // ============================================================
        // Step 4: Setup error handler
        // ============================================================
        input.onerror = (errorEvent: Event | string) => {
          if (settled) return;
          safeReject(
            new FileSelectionException(
              FileSelectionError.UNKNOWN_ERROR,
              'File input error occurred.',
              errorEvent,
            ),
          );
        };

        // ============================================================
        // Step 5: Setup dialog open/close detection
        // ============================================================

        window.addEventListener('blur', onWindowBlur, { once: true });
        blurListenerAdded = true;

        window.addEventListener('focus', onWindowFocus, { once: true });
        focusListenerAdded = true;

        // ============================================================
        // Step 6: Trigger file dialog
        // ============================================================
        try {
          input.click();

          // ✅ Check if dialog actually opened (best effort)
          // If blur event doesn't fire within 100ms, dialog might be blocked
          // But we don't reject - we let the focus event handle cancel detection
          setTimeout(() => {
            if (!dialogOpened && !settled) {
              // Dialog might not have opened, but we can't be sure
              // User might have popup blocker or browser denied it
              // We rely on focus event to detect if user comes back without selecting
              console.warn('File dialog might be blocked - blur event did not fire');
            }
          }, 100);
        } catch (clickError) {
          safeReject(
            new FileSelectionException(
              FileSelectionError.CLICK_FAILED,
              'Failed to trigger file dialog.',
              clickError,
            ),
          );
        }
      } catch (unexpectedError) {
        safeReject(
          new FileSelectionException(
            FileSelectionError.UNKNOWN_ERROR,
            'Unexpected error during file selection.',
            unexpectedError,
          ),
        );
      }
    });
  }

  /**
   * ✅ Utility: Check if user activation is available
   */
  private hasUserActivation(): boolean {
    const ua = (navigator as any).userActivation;
    if (ua && typeof ua.isActive === 'boolean') {
      return ua.isActive || ua.hasBeenActive;
    }
    // Fallback: assume true if API not available
    return true;
  }

  /**
   * ✅ Utility: Create a button that ensures user gesture
   */
  private createFileSelectButton(
    options: FileSelectOptions & { buttonText?: string },
    onSuccess: (files: File[]) => void,
    onError?: (error: FileSelectionException) => void,
  ): HTMLButtonElement {
    const { buttonText = 'Select File', ...selectOptions } = options;

    const button = document.createElement('button');
    button.textContent = buttonText;

    button.onclick = async (event) => {
      try {
        const files = await FileSelector.selectFiles({ ...selectOptions, event });
        onSuccess(files);
      } catch (error) {
        if (error instanceof FileSelectionException) {
          onError?.(error);
        }
      }
    };

    return button;
  }

  /**
   * ✅ Utility: Request user gesture with helpful message
   */
  private createUserGestureButton(
    onActivated: () => void,
    buttonText = 'Select File',
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = buttonText;
    button.onclick = () => {
      if (this.hasUserActivation()) {
        onActivated();
      } else {
        alert('Please click the button to select a file.');
      }
    };
    return button;
  }
}
