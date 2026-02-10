/**
 * Auto-convert plain SVG files into <symbol id="img"> wrapper
 * usable with <use href="icon.svg#img">
 */

const fs = require('fs');
const path = require('path');
const { optimize } = require('svgo');

// مسیر ورودی و خروجی
const INPUT_DIR = path.resolve(__dirname, '../src/assets/icons-src');
const OUTPUT_DIR = path.resolve(__dirname, '../src/assets/icons');

// تضمین وجود پوشه خروجی
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// همه SVGها را بخوان
const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.svg'));

files.forEach((file) => {
  const filePath = path.join(INPUT_DIR, file);
  const rawSvg = fs.readFileSync(filePath, 'utf8');

  // بهینه‌سازی SVG
  const optimized = optimize(rawSvg, {
    multipass: true,
    plugins: [
      'removeDimensions',
      'removeComments',
      'removeMetadata',
      'removeDesc',
      'removeTitle',
      'removeUselessDefs',
      'removeEmptyAttrs',
      'removeEmptyContainers',
      'removeStyleElement',
      { name: 'convertColors', params: { currentColor: true } },
    ],
  }).data;

  // استخراج viewBox
  const viewBoxMatch = optimized.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : null;

  if (!viewBox) {
    console.error(`❌ SVG ${file} viewBox ندارد!`);
    return;
  }

  // بخش داخلی <path> ها
  const inner = optimized
    .replace(/<\/?svg[^>]*>/g, '') // حذف تگ svg اصلی
    .trim();

  // خروجی نهایی
  const finalSvg =
    `<svg xmlns="http://www.w3.org/2000/svg">\n` +
    `  <symbol id="img" viewBox="${viewBox}" fill="currentColor">\n` +
    inner
      .split('\n')
      .map((line) => '    ' + line)
      .join('\n') +
    `\n  </symbol>\n</svg>\n`;

  const outPath = path.join(OUTPUT_DIR, file);
  fs.writeFileSync(outPath, finalSvg);

  console.log('✓ Built:', outPath);
});

console.log('🎉 All icons processed successfully!');
