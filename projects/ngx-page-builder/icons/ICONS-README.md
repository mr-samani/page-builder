# سیستم آیکون ngx-page-builder

## ۱) نصب وابستگی‌های build

```bash
npm i -D svgo svgson
```

## ۲) اسکریپت‌ها (package.json ریشه)

```json
{
  "scripts": {
    "icons": "node scripts/generate-icons.mjs --src <مسیر پوشه svg های فعلی شما>",
    "icons:check": "node scripts/generate-icons.mjs --src <همان مسیر> --check",
    "prebuild": "npm run icons"
  }
}
```

- مسیر پیش‌فرض src: `projects/ngx-page-builder/icons/svg` (فایل‌های svg را اینجا بگذار یا با `--src` به پوشه فعلی‌ات اشاره کن).
- خروجی: `projects/ngx-page-builder/icons/src/generated` (commit شود).
- `icons:check` را در CI بگذار تا خروجی generate شده با svg ها هم‌گام بماند.

## ۳) tsconfig.json (paths)

```json
"paths": {
  "ngx-page-builder/icons": ["projects/ngx-page-builder/icons/src/public-api.ts"]
}
```

## ۴) package.json لایبرری (`projects/ngx-page-builder/package.json`)

```json
{ "sideEffects": false }
```

بدون این، bundler ها نمی‌توانند آیکون‌های استفاده‌نشده را حذف کنند.

## ۵) قواعد نام‌گذاری

| فایل             | name                       | export      |
| ---------------- | -------------------------- | ----------- |
| `grip-dots.svg`  | `grip-dots`                | `gripDots`  |
| `arrows/up.svg`  | `arrows-up`                | `arrowsUp`  |
| `3d-box.svg`     | `3d-box`                   | `icon3dBox` |
| `logo.color.svg` | `logo` (رنگ‌ها حفظ می‌شود) | `logo`      |

## ۶) استفاده

```ts
// app.config.ts  (یا providers مسیر lazy)
import { provideIcons, close, gripDots } from 'ngx-page-builder/icons';
providers: [provideIcons(close, gripDots)];
```

```html
<ngx-icon icon="grip-dots" />
<ngx-icon icon="close" size="20px" label="بستن" />
<ngx-icon icon="chevron-right" flipRtl />
<!-- بهترین tree-shaking، بدون registry: -->
<ngx-icon [icon]="gripDots" />
```

```ts
imports: [NgxIconComponent];
gripDots = gripDots;
```

## ۷) مهاجرت از `<svg Icon="...">`

```bash
perl -pi -e 's#<svg\s+Icon="[^"]*/([\w.-]+)\.svg"([^>]*)></svg>#<ngx-icon icon="$1"$2 />#g' $(git ls-files '*.html')
```

or
replace with regex
find

```
<svg\s+Icon="[^"]*/([\w.-]+)\.svg"([^>]*)></svg>
```

replace with

```
<ngx-icon icon="$1"$2 />
```

بعد از اجرا، دیف را مرور کن (نام‌هایی که با عدد شروع می‌شوند یا `.color` دارند را دستی چک کن).
