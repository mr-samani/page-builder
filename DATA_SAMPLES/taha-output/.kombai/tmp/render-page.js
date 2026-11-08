// Renders a page-builder JSON export to a standalone HTML file,
// mirroring ngx-page-builder's compile rules (styles + cssVariables + block css).
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3] || '.kombai/tmp/preview.html';
const j = JSON.parse(fs.readFileSync(input, 'utf8'));

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- css compiling (same shape as block-css.ts) ----------
const PSEUDO_ORDER = ['visited', 'hover', 'focus', 'focus-visible', 'active', 'checked', 'disabled'];
const BASE = 'xl';
const BPS = { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 };

function parseDecls(text) {
  const out = [];
  if (!text) return out;
  let start = 0, depth = 0, quote = '';
  const flush = (end) => {
    const part = text.slice(start, end);
    const i = part.indexOf(':');
    if (i > 0) {
      const prop = part.slice(0, i).trim();
      const value = part.slice(i + 1).trim();
      if (prop && value && !/[{}<>]/.test(value)) out.push([prop, value]);
    }
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    else if (ch === ';' && depth === 0) { flush(i); start = i + 1; }
  }
  flush(text.length);
  return out;
}
const declStr = (o) => typeof o === 'string' ? o : Object.entries(o || {}).map(([k, v]) => `${k}:${v}`).join(';');
const blockClass = (n) => (n.classList || []).find((c) => c.startsWith('blk-')) || 'blk-' + n.id;
const cssOf = (n) => {
  const css = n.css;
  if (!css) return null;
  if (typeof css === 'string') return css ? { base: css } : null;
  if (typeof css.base === 'object' && css.base !== null && !Array.isArray(css.base)) {
    return { base: declStr(css.base), states: css.states, statesAsObj: true };
  }
  return css;
};

const root = [];
const media = new Map();
function emit(sel, base, states, bucket) {
  if (base) bucket.push(`${sel}{${base}}`);
  if (states) {
    for (const k of Object.keys(states)) {
      const v = typeof states[k] === 'string' ? states[k] : '';
      if (v) bucket.push(`${sel}:${k}{${v}}`);
    }
  }
}
function emitCss(css, sel) {
  if (!css) return;
  const baseTxt = typeof css.base === 'string' ? css.base : '';
  emit(sel, baseTxt, css.states, root);
  for (const k of Object.keys(css.breakpoints || {})) {
    const b = css.breakpoints[k];
    if (!b) continue;
    if (!media.has(k)) media.set(k, []);
    emit(sel, b.base, b.states, media.get(k));
  }
}

function walkCss(n) {
  const css = cssOf(n);
  if (css) emitCss(css, '.' + blockClass(n).replace(/[^A-Za-z0-9_-]/g, ''));
  (n.children || []).forEach(walkCss);
  if (n.template) walkCss(n.template);
}

let blockCss = '';
function compileBlocks(page) {
  [...(page.headerItems || []), ...(page.bodyItems || []), ...(page.footerItems || [])].forEach(walkCss);
  const sorted = [...media.keys()].sort((a, b) => {
    const va = BPS[a], vb = BPS[b];
    const rank = (v) => (v < BPS[BASE] ? -v : v);
    return rank(va) - rank(vb);
  });
  for (const k of sorted) {
    const cond = BPS[k] > BPS[BASE] ? `(min-width:${BPS[k]}px)` : `(max-width:${largerBelow(k) - 0.02}px)`;
    if (media.get(k).length) blockCss += `@media ${cond}{${media.get(k).join('')}}`;
  }
  return root.join('') + blockCss;
}
function largerBelow(key) {
  const target = BPS[key];
  const larger = Object.entries(BPS).filter(([, v]) => v > target).map(([, v]) => v).sort((a, b) => a - b)[0];
  return larger || BPS[BASE];
}

// ---------- html building ----------
function build(n) {
  const attrs = { ...(n.options && n.options.attributes) };
  const tag = n.tag || 'div';
  const cls = (n.classList || []).join(' ');
  const datasetId = `data-id="${esc(n.id)}"`;
  let a = '';
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    a += ` ${k}="${esc(v)}"`;
  }
  const open = `<${tag} ${datasetId}${cls ? ` class="${esc(cls)}"` : ''}${a}>`;
  const VOID = ['img', 'input', 'br', 'hr', 'meta', 'source'];
  if (VOID.includes(tag)) {
    return `<${tag} ${datasetId}${cls ? ` class="${esc(cls)}"` : ''}${a}>`;
  }
  const content = n.content ? n.content : '';
  const kids = (n.children || []).map(build).join('');
  return `${open}${content}${kids}</${tag}>`;
}

const page = j.data[0];
const compiled = compileBlocks(j.data[0]);
const vars = (j.cssVariables || [])
  .filter((v) => v && v.name)
  .map((v) => `--${v.name}:${v.value};`)
  .join('');

const styleBlocks = (j.styles || [])
  .map((s) => `<style id="${esc(s.name)}">${s.data}</style>`)
  .join('\n');

const bodyHtml = [
  ...(j.data[0].headerItems || []).map(build),
  ...j.data[0].bodyItems.map(build),
  ...(j.data[0].footerItems || []).map(build),
].join('\n');

const html = `<!doctype html>
<html lang="fa" dir="${j.config.direction || 'rtl'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(j.config.title || '')}</title>
<style id="NgxPageBuilderBlockStyles">:root{${vars}}${compiled}</style>
${styleBlocks}
<style>body{margin:0;}
body{background:var(--bg,#14100D);}
img{max-width:100%;}</style>
</head>
<body class="ngx-page-builder web-page-view">
${bodyHtml}
</body>
</html>`;

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html, 'utf8');
console.log('wrote', output, html.length, 'bytes');
