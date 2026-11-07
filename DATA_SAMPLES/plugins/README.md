# پک ۲۸ بلاک آماده برای ngx-page-builder

فرمت دقیقاً `IPlugin[]` است: `{ name, image, plugin }` و `plugin` رشته‌ی JSON شامل `{ sanitized, style }` (همان خروجی Export as plugin).

## فایل‌ها
- `plugins.fa.json` / `plugins.en.json` : هر کدام آرایه‌ی ۲۸ پلاگین (فارسی راست‌چین / انگلیسی)
- `single/` : هر پلاگین جدا
- `previews/` : تصاویر پیش‌نمایش (رندر واقعی در Chromium)
- `theme-variables.json` : متغیرهای رنگ (brand, ink, muted, ...) برای پنل CSS Variables
- `generator/` : اسکریپت پایتون سازنده (برای ساخت بلاک‌های جدید)

## وارد کردن
در دموی خودت، `PluginService` از `localStorage['plugins']` می‌خواند:
```js
localStorage.setItem('plugins', await (await fetch('plugins.fa.json')).text())
```
یا آرایه را به `_plugins` سرویس/بک‌اند خودت بده.

## نکات فنی
- همه‌ی رنگ‌ها `var(--brand,#5b5bf0)` با fallback هستند؛ بدون تعریف متغیر هم درست دیده می‌شوند و با تعریف `brand` و ... تم عوض می‌شود.
- استایل بلاک‌ها در `css.base/states/breakpoints` (breakpoint: xxl, lg, md, sm) و کلاس `blk-<id>` است. افکت‌هایی که با css بلاک ممکن نیست (hover فرزندان، ::before، [open]، :checked ~) در `style` و لایه‌ی files هستند.
- آیکون‌ها و متن در بلاک‌های جدا هستند چون ادیتور inline متن، svg را پاک می‌کند.
- استوری‌اسلایدر و گالری بدون JavaScript (scroll-snap و radio) کار می‌کنند.
- در `addBlockToCurrentPage` دو بار اضافه‌کردن یک پلاگین، کلاس `blk-<id>` را مشترک نگه می‌دارد. پیشنهاد: در `clearIds` مثل `PageItem.clone()` کلاس blk- را به id جدید وصل کن تا ویرایش یک کپی روی دیگری اثر نگذارد.
