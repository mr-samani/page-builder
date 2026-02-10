/**
 * ✅ منتظر می‌مونه تا همه فونت‌ها (حتی فونت‌های custom webfont) در صفحه لود بشن.
 * در مرورگرهایی که document.fonts پشتیبانی نمی‌شه، فوراً resolve می‌کنه.
 */
export function waitForFontsToLoad(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    // اگر API پشتیبانی نشه، رد نشو — فقط ادامه بده
    if (!('fonts' in document)) {
      console.warn('document.fonts API not supported — skipping font load wait');
      resolve();
      return;
    }

    let done = false;
    const finish = (success: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      success ? resolve() : reject(new Error('Font loading timed out'));
    };

    // Timeout سخت برای جلوگیری از گیر کردن
    const timer = setTimeout(() => finish(false), timeout);

    try {
      // اگر فونت‌ها از قبل آماده باشن
      if ((document as any).fonts.status === 'loaded') {
        finish(true);
        return;
      }

      // در غیر این صورت منتظر promise رسمی می‌مونیم
      (document as any).fonts.ready.then(() => finish(true)).catch(() => finish(false));
    } catch (err) {
      console.error('Error while waiting for fonts:', err);
      finish(true); // ادامه بده حتی اگر خطایی باشه
    }
  });
}

/**
 * ✅ صبر می‌کنه تا مرورگر تمام layout / paint ها رو انجام بده.
 * یعنی بعد از دو فریم متوالی در requestAnimationFrame.
 */
export function waitForRenderComplete(): Promise<void> {
  return new Promise((resolve) => {
    // مرورگر باید حداقل دو فریم بکشه تا DOM واقعاً render شه
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // در برخی مرورگرها (مخصوصاً Safari)، paint ممکنه با delay بیاد
        // برای اطمینان بیشتر از setTimeout کوتاه استفاده می‌کنیم
        setTimeout(() => {
          console.log('✅ Render complete');
          resolve();
        }, 0);
      });
    });
  });
}
