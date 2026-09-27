# تاریخچهٔ جزئی برای فرم‌های بزرگ

این نسخه جایگزین طراحی snapshot کامل شد. **هیچ فراخوانی record، undo یا redo کل سند را کپی، serialize یا diff نمی‌کند.** تغییرات باید از مسیر مشخصِ ادیتور وارد شوند؛ سرویس با مشاهدهٔ کل فرم دنبال تفاوت‌ها نمی‌گردد.

دو بخش وجود دارد:

- `HistoryService`: نگهداری عملیات جزئی و اطلاعات لازم برای معکوس‌کردن آن‌ها، گروه‌بندی و محدودیت حافظه.
- `HistoryTree`: مدل اجرایی و ایندکس‌شدهٔ درخت با `Map<id, signal>`. اعمال اتمیک عملیات و به‌روزرسانی signal همان المان/والدهای درگیر.

در این مخزن کامپوننت فرم‌ساز هنوز پوستهٔ خالی است و `ngx-page-builder` و helperهای فایل اولیه وجود ندارند. مدل و تاریخچهٔ اجرایی آماده و تست‌شده‌اند؛ اتصال کتابخانهٔ واقعی به این مدل نیازمند کد همان ادیتور است.

## بررسی منابع اصلی

| منبع                                                                                                           | آنچه واقعاً مستند شده است                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [Figma: How multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) | مدل اشیا بر پایهٔ ID و ویژگی‌ها؛ نگهداری دادهٔ اشیای حذف‌شده در undo buffer مشتری؛ تغییر تاریخچه در زمان undo/redo برای محیط چندکاربره.         |
| [Microsoft Fluid: Undo Redo Support](https://fluidframework.com/docs/data-structures/tree/undo-redo)           | هر commit قابلیت تولید Revertible دارد؛ revert تغییرات مربوط را برمی‌گرداند. این منبع فنی Microsoft است، نه اثبات پیاده‌سازی داخلی Word Online. |
| [ProseMirror: source](https://github.com/ProseMirror/prosemirror-history/blob/master/src/history.ts)           | نگهداری stepهای معکوس، گروه‌بندی رویدادها، سقف عمق و نگاشت موقعیت برای تغییرات سند.                                                             |
| [Webflow: Backups](https://help.webflow.com/hc/en-us/articles/33961244069395-Save-and-restore-backups)         | بازیابی نسخهٔ سایت را توضیح می‌دهد؛ در این بررسی منبع فنی معتبری برای الگوریتم داخلی undo ادیتور پیدا نشد.                                      |
| [Photopea: History of actions](https://www.photopea.com/learn/navigation)                                      | رفتار تاریخچهٔ عملیات را توضیح می‌دهد، نه ساختمان داده یا الگوریتم ذخیره‌سازی داخلی.                                                            |

نتیجهٔ قابل اتکا: نمی‌توان ادعا کرد همهٔ محصولات بزرگ snapshot کامل می‌گیرند یا همگی یک الگوریتم دارند. برای این فرم بزرگ، ثبت عملیات در سطح ویژگی/ساختار و مدل ایندکس‌شده مناسب است. نسخهٔ فعلی تک‌کاربره است؛ هم‌زمانی چندکاربره به rebase/OT/CRDT و قرارداد مستقل حل تعارض نیاز دارد.

## استفادهٔ مستقیم

```ts
import { HistoryService } from '@core/services/history.service';
import { HistoryTree } from '@core/services/history-tree';

// In Angular: providers: [HistoryService] on EACH editor, then inject it.
const history = new HistoryService();

// Import/index the form ONCE. The complete document is not put in history.
const tree = new HistoryTree([
  {
    id: '150',
    properties: { title: 'عنوان قدیمی', style: { color: 'red' } },
    children: [],
  },
]);

// edit() reads the old leaf value by ID and prepares a small operation.
// record() APPLIES AND RECORDS it. Do not apply the edit separately first.
history.record(tree.edit('150', ['title'], 'عنوان جدید'), tree.apply, {
  description: 'ویرایش عنوان',
  groupKey: '150:title',
});

// Both apply to the same indexed model. No full-document return or reload.
const undoReport = history.undo(tree.apply);
const redoReport = history.redo(tree.apply);

// Only for explicitly saving to your API, not after every history action:
const savedDocument = tree.export();
```

دادهٔ نگهداری‌شده برای تغییر عنوان تقریباً این است:

```ts
{
  type: 'set',
  id: '150',
  path: ['title'],
  before: { exists: true, value: 'عنوان قدیمی' },
  after: { exists: true, value: 'عنوان جدید' },
}
```

هیچ children یا المان دیگری در این entry وجود ندارد. مسیر نسبت به `properties` المان است. برای `style.color` از `['style', 'color']` استفاده کنید، نه کل style.

`record()` این نسخه با نسخهٔ قبلی **قرارداد متفاوتی دارد**: خودش callback اعمال تغییر را اجرا می‌کند و تنها پس از موفقیت آن، تاریخچه را جلو می‌برد. ابتدا روی مدل تغییر اعمال نکنید و سپس record نکنید؛ old value را از دست خواهید داد یا با خطای conflict مواجه می‌شوید.

## undo/redo چه برمی‌گردانند؟

اگر عملیاتی ممکن نباشد، `undefined`. در غیر این صورت گزارشی با ساختار زیر برمی‌گردد:

```ts
{
  direction: 'undo', // or 'redo' / 'record'
  operations: [
    {
      type: 'set',
      id: '150',
      path: ['title'],
      before: { exists: true, value: 'عنوان جدید' },
      after: { exists: true, value: 'عنوان قدیمی' },
    },
  ],
}
```

این عملیات **قبلاً توسط callback اعمال شده‌اند**؛ گزارش را دوباره اعمال یا record نکنید. برای edit/move، شناسه در `operation.id` و برای insert/remove در `operation.node.id` است. والدهای درگیر نیز داخل position/from/to مشخص‌اند. خطای اعمال به caller پرتاب می‌شود و نشانگر تاریخچه تغییر نمی‌کند.

## افزودن، حذف، جابه‌جایی و عملیات گروهی

```ts
history.record(tree.insert('parent-1', 2, newSubtree), tree.apply);
history.record(tree.remove('field-150'), tree.apply);
history.record(tree.move('field-150', 'parent-2', 0), tree.apply);
history.record(tree.unset('field-150', ['placeholder']), tree.apply);

history.record(
  [tree.edit('field-150', ['style', 'color'], 'blue'), tree.edit('field-151', ['style', 'color'], 'blue')],
  tree.apply,
  { description: 'تغییر رنگ دو فیلد' },
);
```

- insert/remove فقط دادهٔ همان زیرشاخه را ذخیره می‌کنند؛ بازگرداندن حذف، بدون نگهداری دادهٔ حذف‌شده ممکن نیست.
- move فقط ID و موقعیت قبل/بعد را نگه می‌دارد. `index` مقصد، **اندیس نهایی پس از خارج‌کردن آیتم** است؛ انتقال داخل همان والد نیز همین قرارداد را دارد.
- حذف چند خواهر/برادر در یک batch باید با اندیس صحیح نسبت به نتیجهٔ عملیات قبلی باشد؛ معمولاً از اندیس بزرگ‌تر به کوچک‌تر حذف کنید.
- قبلِ هر عملیات batch باید با نتیجهٔ عملیات قبلی سازگار باشد. برای دو تغییر وابسته روی یک ویژگی، مقدار before عملیات دوم باید after عملیات اول باشد. helperها مدل فعلی را می‌خوانند، نه یک batch هنوز اجرا‌نشده.
- تمام batch ابتدا در overlay شامل فقط المان‌های درگیر آماده می‌شود. اگر یک عملیات خطا بدهد، هیچ signal یا داده‌ای commit نمی‌شود.
- undo اعضای batch را به ترتیب معکوس اجرا می‌کند. batch به‌صورت یک entry حذف/نگهداری می‌شود و هنگام رسیدن به سقف تاریخچه نصف نمی‌شود.
- والد گم‌شده، شناسهٔ تکراری، ساخت چرخه، اندیس غلط و before ناسازگار خطا هستند؛ هیچ fallback برای درج حدسی در root وجود ندارد.

## رندر محدود در Angular

خود تاریخچه مسئول رندر نیست. برای اینکه هزینهٔ داده به رندر محدود هم منجر شود:

1. هر المان یک کامپوننت `OnPush` باشد.
2. هر کامپوننت فقط signal همان ID را با `tree.select(id)` بخواند.
3. لیست‌ها با ID پایدار track شوند: `@for (id of tree.rootIds(); track id)`.
4. برای فرزندان از `node().children` که آرایهٔ شناسه است استفاده کنید، نه export کل سند.
5. بعد از undo/redo ریشه را دوباره نسازید، export نگیرید و همهٔ کامپوننت‌ها را reload نکنید.

مثال خواندن در کامپوننت المان (Angular compiler معمول پروژه):

```ts
readonly id = input.required<string>();
readonly node = computed(() => this.tree.select(this.id())());
```

در template فقط `node()?.properties['title']` و ویژگی‌های لازم را بخوانید. هنگام ویرایش title، فقط signal همان المان تغییر می‌کند؛ signal ریشه و دادهٔ والدها/خواهرها ثابت می‌مانند. اگر عنوان روی المان‌های وابسته اثر واقعی دارد، آن‌ها نیز طبیعتاً باید به‌روز شوند.

هنگام حذف، signal قبلی المان `undefined` می‌شود و ایندکس آن آزاد می‌شود. undo حذف، المان و signal جدید می‌سازد؛ کامپوننت‌هایی که با لیست ID رندر می‌شوند آن را دوباره دریافت می‌کنند. پنل جانبی که signal یک المان حذف‌شده را نگه داشته باید انتخاب خود را پاک کند یا پس از بازگشت المان دوباره select کند.

تست `history-render.spec.ts` با TestBed و DOM محیط jsdom، ۱۰۰۰ کامپوننت واقعی Angular می‌سازد. edit/undo/redo روی ۱۵۰ بدون ساخت یا نابودی مجدد کامپوننت‌ها، با حفظ تمام DOM nodeها و ارزیابی دوبارهٔ فقط binding همان المان تأیید شده است. این تست benchmark paint/layout مرورگر واقعی یا تضمین عملکرد renderer کتابخانهٔ غایب نیست.

## هزینه و حافظه

| عملیات                           | دادهٔ تاریخچه             | هزینهٔ اعمال روی مدل                                                                 |
| -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| تغییر title                      | ID، path، مقدار قبل و بعد | lookup با Map؛ کپی سطحی ویژگی‌های المان و objectهای مسیر، مستقل از تعداد کل المان‌ها |
| تغییر یک ویژگی object/array بزرگ | همان مقدار قبل و بعد      | متناسب با اندازهٔ همان مقدار؛ کوچک‌ترین ویژگی را هدف بگیرید                          |
| move                             | ID و دو موقعیت            | والدهای مسیر برای جلوگیری از چرخه، و آرایهٔ خواهر/برادرهای مبدأ/مقصد                 |
| insert/remove                    | فقط زیرشاخهٔ مربوط        | متناسب با زیرشاخه و آرایهٔ خواهر/برادرهای والد                                       |
| بارگذاری/export                  | کل سند                    | متناسب با کل سند؛ فقط هنگام بارگذاری/ذخیره                                           |

مسیر ویژگی فعلاً از objectها عبور می‌کند؛ آرایه به‌عنوان یک مقدار جایگزین می‌شود. داده‌های فهرستیِ بزرگ را در صورت نیاز با ID به nodeهای مستقل مدل کنید. move در این نسخه از آرایهٔ ID استفاده می‌کند، بنابراین جابه‌جایی میان هزاران خواهر/برادر O(siblings) است؛ ویرایش عنوان چنین هزینه‌ای ندارد.

ثابت‌ها در ابتدای سرویس:

```ts
export const MAX_HISTORY_ENTRIES = 100;
export const MAX_HISTORY_BYTES = 16 * 1024 * 1024;
export const HISTORY_GROUP_DELAY_MS = 500;
```

سقف ۱۰۰ entry برای مجموع undo و redo است. مجموع رشته‌های delta و توضیحات نیز محدود است؛ قدیمی‌ترین entryها حذف می‌شوند. بودجهٔ بایت تخمین محافظه‌کارانهٔ رشته با دو بایت برای هر واحد UTF-16 است، نه سقف دقیق heap مرورگر. مدل زنده و حافظهٔ موقت اجرای عملیات جدا هستند. یک عملیات بزرگ‌تر از سقف **پیش از تغییر مدل** رد می‌شود؛ محدودیت را آگاهانه افزایش دهید یا assets بزرگ را خارج از مدل نگه دارید.

تاریخچه هیچ closure از المان‌ها/DOM نگه نمی‌دارد. رسیدن به سقف باعث حذف ارجاع delta قدیمی می‌شود. مدیریت خود لیست تاریخچه O(H) است که H حداکثر ۱۰۰ است؛ هزینه به هزاران المان سند وابسته نمی‌شود.

## قراردادهای اتصال

- هر ادیتور یک HistoryService جدا داشته باشد؛ هنگام تعویض سند `history.clear()` و مدل جدید ایجاد کنید.
- همهٔ تغییرات قابل undo از `record(operation, tree.apply)` عبور کنند. تغییر مستقیم signalها یا اعمال تغییر خارجی با باقی‌گذاشتن تاریخچه ممکن است conflict بدهد؛ برای جایگزینی دادهٔ سرور تاریخچه را clear کنید.
- `setEnabled(false)` تاریخچه را پاک می‌کند. record در حالت غیرفعال تغییر را اعمال می‌کند اما نگه نمی‌دارد.
- گروه‌بندی فقط برای یک set پیوسته روی همان ID/path با groupKey یکسان و فاصلهٔ حداکثر ۵۰۰ms انجام می‌شود. با blur/پایان gesture از `endGroup()` استفاده کنید. insert/remove/move و batch به‌صورت خودکار ادغام نمی‌شوند.
- دادهٔ delta و properties باید plain JSON باشد. parent pointer چرخه‌ای، تابع، Date، کلاس، undefined و فایل runtime را داخل تاریخچه قرار ندهید. IDهای parent در ساختار جدا نگه داشته می‌شوند. نبودن ویژگی با null تفاوت دارد و با exists نمایش داده می‌شود.
- اگر مدل موجود PageItem را نگه می‌دارید، می‌توانید به‌جای HistoryTree، `HistoryApply` را به store ایندکس‌شدهٔ همان ادیتور وصل کنید. callback باید **هم‌زمان، اتمیک و با خروجی undefined** باشد: کل batch را اعمال کند یا بدون هیچ تغییر خطا بدهد. callback async یا callback دارای تغییرات ناقص، این قرارداد را نقض می‌کند. تضمین اتمیک تست‌شده متعلق به HistoryTree ارائه‌شده است.
- حفظ cursor تاریخچه به‌تنهایی رندر را بهینه نمی‌کند؛ renderer موجود نیز باید بر پایهٔ ID پایدار و اعلان المان‌های درگیر کار کند. برای undo/redo از مسیر تغییر کاربر دوباره record نکنید.
- این نسخه ذخیرهٔ پایدار تاریخچه پس از refresh یا همکاری هم‌زمان چندکاربره ارائه نمی‌کند.

## تست‌ها

```powershell
npx vitest run src/core/services/history.service.spec.ts src/core/services/history-render.spec.ts
npx tsc --project tsconfig.app.json --noEmit
```

پوشش تست شامل edit/set/unset، افزودن/حذف زیرشاخه، انتقال داخل/بین والدها، batch وابسته، شکست اتمیک، conflict، گروه‌بندی، شاخه‌سازی، سقف حجم/تعداد، ایزوله‌بودن ادیتورها و ۳۰۰۰ عملیات تصادفی با مدل مرجع مستقل است.

تست ۱۰هزار node بررسی می‌کند که تغییر ۱۵۰ فقط یک computed را نامعتبر کند و تعداد بایت تاریخچه دقیقاً با سند تک‌المانی برابر و کمتر از ۵۱۲ بایت باشد. تست Angular/jsdom نیز رفتار رندر ۱۰۰۰ کامپوننت را بررسی می‌کند.
