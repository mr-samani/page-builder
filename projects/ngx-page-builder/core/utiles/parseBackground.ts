export function parseBackground(background: string): {
  color?: string;
  gradient?: string;
  image?: string;
} {
  const result: { color?: string; gradient?: string; image?: string } = {};

  if (!background) return result;
  const src = background.trim();

  // 1) پیدا کردن gradient با اسکن برای بستن پرانتزها
  const gradientTypes = ['linear-gradient', 'radial-gradient', 'conic-gradient'];
  for (const g of gradientTypes) {
    const idx = src.indexOf(g + '(');
    if (idx !== -1) {
      let i = idx + g.length + 1; // بعد از '('
      let depth = 1;
      while (i < src.length && depth > 0) {
        const ch = src[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        i++;
      }
      if (depth === 0) {
        result.gradient = src.substring(idx, i).trim();
        break;
      } else {
        const fallback = src.match(new RegExp(`${g}\\([^)]*\\)`));
        if (fallback) result.gradient = fallback[0];
      }
    }
  }

  // 2) پیدا کردن image (url(...))
  const urlMatch = src.match(/url\(\s*(['"]?)[^)]+?\1\s*\)/);
  if (urlMatch) {
    result.image = urlMatch[0];
  }

  // ---- ADDITION: CSS named colors ----
  const namedColors = [
    'black',
    'silver',
    'gray',
    'white',
    'maroon',
    'red',
    'purple',
    'fuchsia',
    'green',
    'lime',
    'olive',
    'yellow',
    'navy',
    'blue',
    'teal',
    'aqua',
    'orange',
    'aliceblue',
    'antiquewhite',
    'aquamarine',
    'azure',
    'beige',
    'bisque',
    'brown',
    'chocolate',
    'coral',
    'cornflowerblue',
    'crimson',
    'cyan',
    'darkblue',
    'darkcyan',
    'darkgray',
    'darkgreen',
    'darkmagenta',
    'darkorange',
    'darkred',
    'deeppink',
    'dodgerblue',
    'gold',
    'goldenrod',
    'hotpink',
    'indigo',
    'khaki',
    'lightblue',
    'lightgray',
    'lightgreen',
    'magenta',
    'mediumblue',
    'mediumseagreen',
    'mediumvioletred',
    'orangered',
    'pink',
    'plum',
    'rebeccapurple',
    'salmon',
    'seagreen',
    'skyblue',
    'slateblue',
    'steelblue',
    'tomato',
    'turquoise',
    'violet',
  ];

  // 3) پیدا کردن رنگ (hex / rgb(a) / hsl(a) / named colors)
  const colorRegex = new RegExp(
    `(?:(rgba?|hsla?)\\([^)]+\\)|#[0-9a-fA-F]{3,8}|\\b(${namedColors.join('|')})\\b)`,
    'gi',
  );

  let colorMatch;
  while ((colorMatch = colorRegex.exec(src)) !== null) {
    const found = colorMatch[0];

    // اگر داخل gradient است، رد کن
    if (
      result.gradient &&
      src.indexOf(result.gradient) <= src.indexOf(found) &&
      src.indexOf(found) < src.indexOf(result.gradient) + result.gradient.length
    ) {
      continue;
    }

    // اگر داخل url است، رد کن
    if (
      result.image &&
      src.indexOf(result.image) <= src.indexOf(found) &&
      src.indexOf(found) < src.indexOf(result.image) + result.image.length
    ) {
      continue;
    }

    result.color = found;
    break;
  }

  return result;
}
