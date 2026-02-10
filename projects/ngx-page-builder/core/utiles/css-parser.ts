/**
 * parse css stylesheet to record
 * @param cssText like #name{color:red;}
 */
export function parseCssBlockToRecord(cssText: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    try {
      // 1) حذف کامنت‌ها (/* ... */)
      const noComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

      const result: Record<string, string> = {};

      // utility: split declarations by ';' but ignore ; داخل پرانتز و quote و url(...) و escapes
      function splitDecls(body: string): string[] {
        const parts: string[] = [];
        let cur = '';
        let paren = 0;
        let bracket = 0;
        let brace = 0;
        let inSingle = false;
        let inDouble = false;
        let escaped = false;

        for (let i = 0; i < body.length; i++) {
          const ch = body[i];

          if (escaped) {
            cur += ch;
            escaped = false;
            continue;
          }
          if (ch === '\\') {
            cur += ch;
            escaped = true;
            continue;
          }

          if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            cur += ch;
            continue;
          }
          if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
            cur += ch;
            continue;
          }
          if (!inSingle && !inDouble) {
            if (ch === '(') paren++;
            else if (ch === ')') paren = Math.max(0, paren - 1);
            else if (ch === '[') bracket++;
            else if (ch === ']') bracket = Math.max(0, bracket - 1);
            else if (ch === '{') brace++;
            else if (ch === '}') brace = Math.max(0, brace - 1);
          }

          if (ch === ';' && paren === 0 && bracket === 0 && brace === 0 && !inSingle && !inDouble) {
            parts.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        if (cur.trim()) parts.push(cur.trim());
        return parts.filter((p) => p.length > 0);
      }

      // main parser: scan and handle nested blocks via brace counting
      // prefix: to keep context for at-rules (like "@keyframes name")
      function parseBlocks(src: string, prefix = '') {
        let i = 0;
        const len = src.length;

        while (i < len) {
          // skip whitespace/newlines
          while (i < len && /\s/.test(src[i])) i++;
          if (i >= len) break;

          // if starts with @ (at-rule)
          if (src[i] === '@') {
            const headerStart = i;
            // read header until first '{' or ';'
            while (i < len && src[i] !== '{' && src[i] !== ';') i++;
            const headerRaw = src.slice(headerStart, i).trim();

            if (i < len && src[i] === ';') {
              // at-rule without block e.g. @charset "utf-8";
              i++; // consume ;
              continue;
            }
            if (i >= len) break;
            // now src[i] === '{'
            // find matching closing brace for this at-rule block
            let braceCount = 1;
            i++; // move past '{'
            const innerStart = i;
            while (i < len && braceCount > 0) {
              if (src[i] === '{') braceCount++;
              else if (src[i] === '}') braceCount--;
              i++;
            }
            const innerEnd = i - 1; // index of char before closing brace
            if (innerEnd >= innerStart) {
              const inner = src.slice(innerStart, innerEnd);
              // include headerRaw as prefix for inner parsing so selectors inside keep context
              const newPrefix = prefix ? `${prefix} ${headerRaw}` : headerRaw;
              parseBlocks(inner, newPrefix);
            }
            continue;
          }

          // otherwise read selector up to first '{'
          let selStart = i;
          while (i < len && src[i] !== '{') i++;
          if (i >= len) break;
          const selectorRaw = src.slice(selStart, i).trim();
          i++; // move past '{'
          // now read body until matching '}' (brace count)
          let brace = 1;
          const bodyStart = i;
          while (i < len && brace > 0) {
            if (src[i] === '{') brace++;
            else if (src[i] === '}') brace--;
            i++;
          }
          const bodyEnd = i - 1;
          const body = src.slice(bodyStart, bodyEnd).trim();

          // handle multiple selectors: .a, .b {...}
          const selectors = selectorRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (selectors.length === 0) continue;

          // normalize declarations from body
          const decls = splitDecls(body)
            .map((d) => d.replace(/\s+/g, ' ').trim()) // normalize spaces
            .filter(Boolean);

          // create final key prefix: combine prefix and selector
          const makeKey = (s: string) => {
            const normalizedSel = s.replace(/\s+/g, ' ').trim();
            return prefix ? `${prefix} ${normalizedSel}` : normalizedSel;
          };

          if (decls.length === 0) {
            // empty block => set empty string (but keep namespaced keys)
            for (const s of selectors) {
              const key = makeKey(s);
              if (!(key in result)) result[key] = '';
            }
          } else {
            const joined = decls
              .map((d) => {
                // ensure there is exactly one colon between prop and value
                const idx = d.indexOf(':');
                if (idx === -1) return d; // keep as-is (invalid but preserved)
                const prop = d.slice(0, idx).trim();
                const val = d.slice(idx + 1).trim();
                return `${prop}:${val}`;
              })
              .join(';');
            // ensure trailing semicolon
            const valueStr = joined.endsWith(';') ? joined : joined + ';';
            for (const s of selectors) {
              const key = makeKey(s);
              if (result[key]) {
                // remove trailing ; to concat cleanly
                const a = result[key].replace(/;+\s*$/, '');
                const b = valueStr.replace(/;+\s*$/, '');
                result[key] = a && b ? a + ';' + b + ';' : (a || b) + ';';
              } else {
                result[key] = valueStr;
              }
            }
          }
        }
      }

      parseBlocks(noComments);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

// small helper: parseCssToRecord (unchanged logic for inline styles)
export function parseCssToRecord(css: string): Record<string, string> {
  const declarations = css.split(';').filter((decl) => decl.trim() !== '');
  const result: Record<string, string> = {};

  for (const decl of declarations) {
    const [key, ...valueParts] = decl.split(':');
    if (key && valueParts.length > 0) {
      result[key.trim()] = valueParts.join(':').trim();
    }
  }

  return result;
}
