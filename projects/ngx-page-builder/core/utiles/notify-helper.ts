/**
 * Simple console-based notify helper
 * This prevents circular dependency with builder's notify system
 */
export class NotifyHelper {
  static info(message: string) {
    console.info('[INFO]', message);
  }

  static success(message: string) {
    console.log('[SUCCESS]', message);
  }

  static warning(message: string) {
    console.warn('[WARNING]', message);
  }

  static error(message: string) {
    console.error('[ERROR]', message);
  }
}
