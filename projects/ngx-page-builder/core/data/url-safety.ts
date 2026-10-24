/** True for URLs that can run script or navigate to a document: javascript:, vbscript:, data:text/html … */
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon)[;,]/;

export function isUnsafeUrl(value: string, tag = '', attr = ''): boolean {
  // browsers ignore tabs / newlines / control characters inside the scheme ("java\tscript:")
  let v = '';
  for (let i = 0; i < value.length && v.length < 64; i++) {
    const c = value.charCodeAt(i);
    if (c > 32 && c !== 0xa0) v += value[i].toLowerCase();
  }
  if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return true;
  if (!v.startsWith('data:')) return false;
  if (SAFE_DATA_IMAGE.test(v)) return false;
  // svg data URIs are inert inside <img>/<source>, dangerous as a link or document
  return !((tag === 'img' || tag === 'source') && attr === 'src' && v.startsWith('data:image/svg+xml'));
}
