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
  SSR_UNSUPPORTED = 'SSR_UNSUPPORTED',
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

export abstract class FileSelector {
  public static async selectFile(options: FileSelectOptions = {}): Promise<File> {
    const files = await this.selectFiles({ ...options, multiple: false });
    if (!files.length) {
      throw new FileSelectionException(FileSelectionError.NO_FILE_SELECTED, 'No file was selected.');
    }
    return files[0];
  }

  public static async selectFiles(options: FileSelectOptions = {}): Promise<File[]> {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') {
      throw new FileSelectionException(
        FileSelectionError.SSR_UNSUPPORTED,
        'File selection is only available in the browser.',
      );
    }

    const { accept = [], multiple = false, timeoutMs = 1200, event, onDialogOpen, onDialogClose } = options;

    return new Promise<File[]>((resolve, reject) => {
      let settled = false;
      let dialogOpened = false;
      let input: HTMLInputElement | null = null;
      let openTimer: number | undefined;
      let cancelTimer: number | undefined;

      const cleanup = () => {
        if (openTimer !== undefined) {
          window.clearTimeout(openTimer);
          openTimer = undefined;
        }

        if (cancelTimer !== undefined) {
          window.clearTimeout(cancelTimer);
          cancelTimer = undefined;
        }

        window.removeEventListener('blur', onWindowBlur);
        window.removeEventListener('focus', onWindowFocus);
        document.removeEventListener('visibilitychange', onVisibilityChange);

        if (input) {
          input.removeEventListener('change', onChange);
          input.removeEventListener('error', onError);
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
          input = null;
        }

        if (dialogOpened) {
          onDialogClose?.();
          dialogOpened = false;
        }
      };

      const finishResolve = (files: File[]) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(files);
      };

      const finishReject = (error: FileSelectionException) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const markDialogOpened = () => {
        if (dialogOpened || settled) return;
        dialogOpened = true;
        onDialogOpen?.();
      };

      const onWindowBlur = () => {
        markDialogOpened();
      };

      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          markDialogOpened();
        }
      };

      const onWindowFocus = () => {
        if (settled || !dialogOpened) return;

        // Give the browser a moment to emit change after focus returns.
        cancelTimer = window.setTimeout(() => {
          if (settled) return;

          if (input?.files && input.files.length > 0) {
            return;
          }

          finishReject(new FileSelectionException(FileSelectionError.USER_CANCELLED, 'User cancelled file selection.'));
        }, 150);
      };

      const onChange = () => {
        if (settled) return;

        const files = input?.files ? Array.from(input.files) : [];
        if (files.length > 0) {
          finishResolve(files);
          return;
        }

        finishReject(new FileSelectionException(FileSelectionError.NO_FILE_SELECTED, 'No file was selected.'));
      };

      const onError = (errorEvent: Event) => {
        if (settled) return;
        finishReject(
          new FileSelectionException(FileSelectionError.UNKNOWN_ERROR, 'File input error occurred.', errorEvent),
        );
      };

      try {
        const ua = navigator.userActivation;
        if (ua && typeof ua.isActive === 'boolean' && !ua.isActive && !ua.hasBeenActive) {
          finishReject(
            new FileSelectionException(
              FileSelectionError.NO_USER_ACTIVATION,
              'No user activation detected. File picker requires a real user gesture.',
            ),
          );
          return;
        }

        if (event && !event.isTrusted) {
          finishReject(
            new FileSelectionException(
              FileSelectionError.NOT_TRUSTED_EVENT,
              'Event is not trusted. File picker requires a real user gesture.',
            ),
          );
          return;
        }

        input = document.createElement('input');
        input.type = 'file';
        input.accept = accept.join(',');
        input.multiple = multiple;
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.top = '-9999px';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';

        input.addEventListener('change', onChange);
        input.addEventListener('error', onError);

        document.body.appendChild(input);

        window.addEventListener('blur', onWindowBlur, { passive: true });
        window.addEventListener('focus', onWindowFocus, { passive: true });
        document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });

        openTimer = window.setTimeout(() => {
          if (settled) return;

          // If the dialog never caused blur/visibility change, it was likely blocked.
          if (!dialogOpened) {
            finishReject(
              new FileSelectionException(
                FileSelectionError.BROWSER_BLOCKED,
                'File dialog was likely blocked or could not be opened.',
              ),
            );
          }
        }, timeoutMs);

        try {
          input.click();
        } catch (clickError) {
          finishReject(
            new FileSelectionException(FileSelectionError.CLICK_FAILED, 'Failed to trigger file dialog.', clickError),
          );
        }
      } catch (unexpectedError) {
        finishReject(
          new FileSelectionException(
            FileSelectionError.UNKNOWN_ERROR,
            'Unexpected error during file selection.',
            unexpectedError,
          ),
        );
      }
    });
  }

  public static createFileSelectButton(
    options: FileSelectOptions & { buttonText?: string },
    onSuccess: (files: File[]) => void,
    onError?: (error: FileSelectionException) => void,
  ): HTMLButtonElement {
    const { buttonText = 'Select File', ...selectOptions } = options;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = buttonText;

    button.addEventListener('click', async (event) => {
      try {
        const files = await FileSelector.selectFiles({ ...selectOptions, event });
        onSuccess(files);
      } catch (error) {
        if (error instanceof FileSelectionException) {
          onError?.(error);
        } else {
          onError?.(
            new FileSelectionException(FileSelectionError.UNKNOWN_ERROR, 'Unknown error while selecting files.', error),
          );
        }
      }
    });

    return button;
  }
}
