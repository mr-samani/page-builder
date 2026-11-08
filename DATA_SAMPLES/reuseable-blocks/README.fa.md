# ngx-page-builder reusable blocks

این بسته شامل ۲۴ بلاک JSON قابل استفاده مجدد است که شکل Export پلاگین Page Builder را رعایت می‌کنند.

هر فایل یک IPlugin با فیلدهای `name`, `image`, `plugin` است. مقدار `plugin` رشته JSON شامل `sanitized` (ساختار PageItem) و `style` (رشته CSS) است.

## نکات
- ساختار فایل‌ها و یکتایی IDها اعتبارسنجی شده است.
- استایل‌ها با کلاس‌های یکتای `blk-*` ذخیره شده‌اند.
- تصاویر Unsplash هستند؛ برای انتشار نهایی بهتر است به CDN خود منتقل شوند.
- فرم‌ها و کنترل‌ها markup نمایشی/native هستند؛ منطق submit، validation و event handler سفارشی باید در میزبان پیاده شود.
- این بسته از نظر JSON و شکل Export اعتبارسنجی شده؛ Import زنده در مرورگر Builder هنوز تست نشده است.
- `visual-catalog.png` یک کاتالوگ گرافیکی است، نه اسکرین‌شات واقعی از اجرای Builder.
