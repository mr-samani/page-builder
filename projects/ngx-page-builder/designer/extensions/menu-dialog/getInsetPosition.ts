export function getInsetPosition(target: HTMLElement, dialog: HTMLDialogElement, options: { margin?: number } = {}) {
  const {
    margin = 8, // فاصله‌ی امن از دکمه و لبه‌ی صفحه
  } = options;

  const targetRect = target.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // برای اینکه اندازه‌ی dialog رو بفهمیم، ممکنه نیاز باشه موقتاً نمایش بدیم
  const prevDisplay = dialog.style.display;
  const prevVisibility = dialog.style.visibility;
  const prevOpen = dialog.open;

  // اگر هنوز باز نشده یا اندازه‌اش نامعتبره، موقتاً قابل اندازه‌گیری کن
  if (!prevOpen) {
    dialog.showModal();
  }
  dialog.style.visibility = 'hidden';
  dialog.style.display = 'block';

  const dialogRect = dialog.getBoundingClientRect();
  const dialogWidth = dialogRect.width;
  const dialogHeight = dialogRect.height;

  // برگردوندن حالت قبلی
  dialog.style.display = prevDisplay;
  dialog.style.visibility = prevVisibility;
  if (!prevOpen) {
    dialog.close();
  }

  // جهت صفحه (LTR / RTL)
  const isRTL = getComputedStyle(document.documentElement).direction === 'rtl';

  // تصمیم‌گیری محور عمودی (بالا/پایین)
  let top;
  const spaceBelow = viewportHeight - targetRect.bottom;
  const spaceAbove = targetRect.top;

  if (spaceBelow >= dialogHeight + margin || spaceBelow >= spaceAbove) {
    // جا بیشتر پایین است → دیالوگ زیر دکمه
    top = targetRect.bottom + margin;
    // اگر از پایین بیرون زد، constrain
    if (top + dialogHeight + margin > viewportHeight) {
      top = Math.max(margin, viewportHeight - dialogHeight - margin);
    }
  } else {
    // جا بیشتر بالا است → دیالوگ بالای دکمه
    top = targetRect.top - dialogHeight - margin;
    // اگر از بالا بیرون زد، constrain
    if (top < margin) {
      top = margin;
    }
  }

  // تصمیم‌گیری محور افقی (چپ/راست) — بر اساس جهت نوشتار
  let left;
  const spaceRight = viewportWidth - targetRect.left;
  const spaceLeft = targetRect.right;

  if (!isRTL) {
    // LTR
    // ترجیح: دیالوگ طوری قرار بگیرد که از چپ دکمه شروع شود
    left = targetRect.left;

    // اگر از راست بیرون زد، سعی کن از راست دکمه چینش کنی
    if (left + dialogWidth + margin > viewportWidth) {
      left = targetRect.right - dialogWidth;
    }

    // اگر باز هم بیرون زد، constrain داخل viewport
    if (left < margin) left = margin;
    if (left + dialogWidth + margin > viewportWidth) {
      left = viewportWidth - dialogWidth - margin;
    }
  } else {
    // RTL
    // ترجیح: دیالوگ به سمت راست دکمه (ظاهراً چسبیده به راست دکمه) باشد
    left = targetRect.right - dialogWidth;

    // اگر از چپ بیرون زد، سعی کن از چپ دکمه بچسبانی
    if (left < margin) {
      left = targetRect.left;
    }

    // constrain داخل viewport
    if (left < margin) left = margin;
    if (left + dialogWidth + margin > viewportWidth) {
      left = viewportWidth - dialogWidth - margin;
    }
  }

  // تبدیل به inset: top | right | bottom | left
  const insetTop = Math.round(top);
  const insetLeft = Math.round(left);

  // چون داریم با inset کار می‌کنیم، right و bottom رو auto می‌گذاریم
  const inset = `${insetTop}px auto auto ${insetLeft}px`;
  return inset;
}
