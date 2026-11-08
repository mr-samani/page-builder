/**
 * Builds taha-barbershop.page.json — redesign of the Taha barbershop page
 * for the ngx-page-builder JSON model (nodes + block css + stylesheets + css vars).
 */
const fs = require('fs');
const C = require('./content-map.json');

const txt = (id) => (C[id] && C[id].content) || '';
const at = (id) => (C[id] && C[id].attrs) || {};

const TEAM_IMAGES = {
  1: {
    src: 'https://images.pexels.com/photos/5337960/pexels-photo-5337960.jpeg?auto=compress&cs=tinysrgb&w=640&h=640&fit=crop',
    alt: 'پرتره مهدی طاها — سرپرست آرایشگران — عکس: alexandre saraiva carniato on Pexels',
  },
  2: {
    src: 'https://images.pexels.com/photos/33380942/pexels-photo-33380942.jpeg?auto=compress&cs=tinysrgb&w=640&h=640&fit=crop',
    alt: 'پرتره سعید رضایی — متخصص فید و کوتاهی ماشین — عکس: Mindaugas Lazdauskas on Pexels',
  },
  3: {
    src: 'https://images.pexels.com/photos/20302333/pexels-photo-20302333.jpeg?auto=compress&cs=tinysrgb&w=640&h=640&fit=crop',
    alt: 'پرتره امیر کاظمی — آرایشگر ریش و تیغ — عکس: Ben Khatry on Pexels',
  },
};

let idCounter = new Map();
function el(id, tag, o = {}) {
  const { text, content, cls = [], css = '', states, bp, attrs = {}, children = [] } = o;
  if (idCounter.has(id)) throw new Error('duplicate id: ' + id);
  idCounter.set(id, true);
  const node = {
    id,
    tag,
    canHaveChild: children.length > 0,
    children,
  };
  if (content !== undefined) node.content = content;
  else if (text !== undefined) node.content = text;
  node.options = { attributes: attrs };
  node.classList = ['blk-' + id, ...cls];
  const c = { base: css };
  if (states) c.states = states;
  if (bp) c.breakpoints = bp;
  node.css = c;
  return node;
}

// ─────────────────────────────────────────────────────────────
// nav
// ─────────────────────────────────────────────────────────────
const navLinks = [
  ['خدمات', '#services'],
  ['تعرفه', '#pricing'],
  ['نمونه‌کار', '#work'],
  ['آرایشگران', '#team'],
  ['سؤالات متداول', '#faq'],
];

const nav = el('page', 'div', {
  cls: ['page-root'],
  attrs: { id: 'top', dir: 'rtl', lang: 'fa' },
  css:
    'min-height:100%;background-color:var(--bg,#14100D);color:var(--ink,#F7F1E8);font-family:"Vazirmatn",system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:clip;-webkit-font-smoothing:antialiased;text-align:start;',
  children: [
    el('nav', 'header', {
      css:
        'position:sticky;top:0;z-index:60;background:rgba(20,16,13,0.86);backdrop-filter:blur(14px) saturate(140%);border-bottom:1px solid rgba(226,175,50,0.14);',
      bp: { md: { base: 'background:rgba(20,16,13,0.97);' } },
      children: [
        el('nav-inner', 'div', {
          css:
            'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:76px;position:relative;',
          bp: {
            xxl: { base: 'max-width:1320px;' },
            md: { base: 'min-height:66px;padding:0 24px;' },
            sm: { base: 'padding:0 20px;' },
          },
          children: [
            el('brand', 'a', {
              attrs: { href: '#top', 'aria-label': 'آرایشگاه طاها' },
              css: 'display:inline-flex;align-items:center;gap:12px;text-decoration:none;flex:0 0 auto;',
              children: [
                el('brand-mark', 'span', {
                  cls: ['ic'],
                  content: txt('brand-mark'),
                  css:
                    'display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background-image:linear-gradient(140deg,#E2AF32,#B8862A);color:#191310;flex:0 0 auto;box-shadow:0 10px 22px -14px rgba(226,175,50,0.8);',
                }),
                el('brand-text', 'span', {
                  css: 'display:flex;flex-direction:column;gap:3px;',
                  children: [
                    el('brand-name', 'span', {
                      text: txt('brand-name'),
                      css: 'font-size:17px;font-weight:800;color:var(--ink,#F7F1E8);line-height:1.2;',
                    }),
                    el('brand-sub', 'span', {
                      text: txt('brand-sub'),
                      css:
                        'font-size:9px;font-weight:600;color:var(--muted,#BFAEA3);letter-spacing:0.2em;line-height:1.2;direction:ltr;',
                    }),
                  ],
                }),
              ],
            }),
            el('nav-links', 'nav', {
              attrs: { 'aria-label': 'بخش‌های صفحه' },
              css: 'display:flex;align-items:center;gap:24px;',
              bp: { md: { base: 'display:none;' } },
              children: navLinks.map(([t, href], i) =>
                el('nav-link-' + i, 'a', {
                  text: t,
                  attrs: { href },
                  css:
                    'font-size:14.5px;font-weight:500;color:var(--muted,#BFAEA3);text-decoration:none;padding:8px 0;transition:color 160ms ease;',
                  states: {
                    hover: 'color:var(--ink,#F7F1E8);',
                    'focus-visible':
                      'color:var(--ink,#F7F1E8);outline:2px solid var(--brass,#E2AF32);outline-offset:4px;border-radius:4px;',
                  },
                }),
              ),
            }),
            el('nav-actions', 'div', {
              css: 'display:flex;align-items:center;gap:14px;',
              children: [
                el('nav-phone', 'a', {
                  cls: ['nav-phone'],
                  attrs: { href: 'tel:+982188774521' },
                  css:
                    'display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:500;color:var(--muted,#BFAEA3);text-decoration:none;transition:color 160ms ease;',
                  states: { hover: 'color:var(--brass,#E2AF32);' },
                  bp: { lg: { base: 'display:none;' } },
                  children: [
                    el('nav-phone-ic', 'span', {
                      cls: ['ic'],
                      content: txt('nav-phone-ic'),
                      css: 'display:inline-flex;width:16px;height:16px;color:var(--brass,#E2AF32);',
                    }),
                    el('nav-phone-num', 'span', { text: txt('nav-phone-num'), css: 'white-space:nowrap;' }),
                  ],
                }),
                el('nav-cta', 'a', {
                  text: 'رزرو نوبت',
                  attrs: { href: '#booking' },
                  css:
                    'display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 20px;border-radius:999px;background-image:linear-gradient(140deg,#E2AF32,#B8862A);color:#191310;font-size:14.5px;font-weight:800;text-decoration:none;box-shadow:0 14px 26px -18px rgba(226,175,50,0.9);transition:transform 160ms ease,box-shadow 160ms ease;',
                  states: {
                    hover: 'transform:translateY(-1px);box-shadow:0 18px 30px -18px rgba(226,175,50,1);',
                    active: 'transform:translateY(0);',
                    'focus-visible': 'outline:2px solid var(--ink,#F7F1E8);outline-offset:3px;',
                  },
                  bp: { md: { base: 'display:none;' } },
                }),
                el('nav-burger', 'details', {
                  cls: ['burger'],
                  css: 'display:none;position:relative;',
                  bp: { md: { base: 'display:block;' } },
                  children: [
                    el('burger-summary', 'summary', {
                      cls: ['burger-summary'],
                      attrs: { 'aria-label': 'منو' },
                      css:
                        'display:grid;place-items:center;width:40px;height:40px;border-radius:10px;border:1px solid rgba(226,175,50,0.22);color:var(--ink,#F7F1E8);cursor:pointer;list-style:none;',
                      children: [
                        el('burger-ic', 'span', {
                          cls: ['ic'],
                          content: txt('burger-ic'),
                          css: 'display:inline-flex;width:20px;height:20px;',
                        }),
                      ],
                    }),
                    el('burger-panel', 'div', {
                      css:
                        'position:absolute;inset-inline-end:0;top:50px;z-index:70;width:246px;padding:12px;border-radius:14px;border:1px solid rgba(226,175,50,0.24);background:#191310;box-shadow:0 30px 60px -30px rgba(0,0,0,0.95);display:flex;flex-direction:column;gap:2px;',
                      children: [
                        ...navLinks.map(([t, href], i) =>
                          el('mnav-link-' + i, 'a', {
                            text: t,
                            attrs: { href },
                            css:
                              'padding:11px 10px;border-radius:8px;font-size:14px;font-weight:500;color:var(--muted,#BFAEA3);text-decoration:none;',
                            states: { hover: 'background:rgba(226,175,50,0.08);color:var(--ink,#F7F1E8);' },
                          }),
                        ),
                        el('mnav-cta', 'a', {
                          text: 'رزرو نوبت',
                          attrs: { href: '#booking' },
                          css:
                            'margin-top:8px;display:grid;place-items:center;min-height:42px;border-radius:10px;background-image:linear-gradient(140deg,#E2AF32,#B8862A);color:#191310;font-size:14px;font-weight:800;text-decoration:none;',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        el('scroll-line', 'div', {
          attrs: { 'aria-hidden': 'true' },
          css:
            'position:absolute;bottom:-1px;inset-inline:0;height:2px;pointer-events:none;background-image:linear-gradient(270deg,#B8862A,#E2AF32);transform:scaleX(0);transform-origin:right center;',
        }),
      ],
    }),

    // ───────── hero ─────────
    el('main', 'main', {
      css: 'display:block;',
      children: [
        el('hero', 'section', {
          css:
            'position:relative;padding:56px 0 72px;background-color:var(--bg,#14100D);background-image:radial-gradient(circle at 84% 6%,rgba(226,175,50,0.12),transparent 44%),radial-gradient(circle at 6% 82%,rgba(122,80,64,0.22),transparent 52%);scroll-margin-top:92px;',
          bp: {
            md: { base: 'padding:44px 0 56px;' },
            sm: { base: 'padding:34px 0 44px;' },
          },
          children: [
            el('hero-inner', 'div', {
              css:
                'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:48px;align-items:center;',
              bp: {
                xxl: { base: 'max-width:1320px;' },
                lg: { base: 'grid-template-columns:minmax(0,1fr) 400px;gap:40px;' },
                md: { base: 'grid-template-columns:minmax(0,1fr);gap:34px;padding:0 24px;' },
                sm: { base: 'gap:26px;padding:0 20px;' },
              },
              children: [
                el('hero-copy', 'div', {
                  css: 'min-width:0;display:flex;flex-direction:column;align-items:flex-start;',
                  children: [
                    el('hero-title', 'h1', {
                      css:
                        'margin:0;font-size:62px;font-weight:900;line-height:1.06;letter-spacing:-0.01em;color:var(--ink,#F7F1E8);',
                      bp: {
                        lg: { base: 'font-size:54px;' },
                        md: { base: 'font-size:46px;' },
                        sm: { base: 'font-size:35px;' },
                      },
                      children: [
                        el('hero-title-a', 'span', {
                          text: txt('hero-title-a'),
                          css: 'display:block;',
                        }),
                        el('hero-title-b', 'span', {
                          text: txt('hero-title-b'),
                          css:
                            'display:block;color:var(--brass,#E2AF32);font-size:92px;line-height:1.02;margin-top:2px;',
                          bp: {
                            lg: { base: 'font-size:82px;' },
                            md: { base: 'font-size:66px;' },
                            sm: { base: 'font-size:50px;' },
                          },
                        }),
                      ],
                    }),
                    el('hero-desc', 'p', {
                      text: txt('hero-desc'),
                      css:
                        'margin:22px 0 0;max-width:44ch;font-size:16.5px;line-height:1.95;color:var(--muted,#BFAEA3);',
                      bp: { md: { base: 'font-size:16px;margin-top:18px;' } },
                    }),
                    el('hero-cta-row', 'div', {
                      css: 'display:flex;flex-wrap:wrap;gap:12px;margin-top:30px;',
                      bp: { sm: { base: 'width:100%;flex-direction:column;gap:10px;' } },
                      children: [
                        el('hero-cta', 'a', {
                          text: txt('hero-cta'),
                          attrs: { href: '#booking' },
                          css:
                            'display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 28px;border-radius:999px;background-image:linear-gradient(140deg,#E2AF32,#B8862A);color:#191310;font-size:15.5px;font-weight:800;text-decoration:none;box-shadow:0 20px 36px -22px rgba(226,175,50,0.95);transition:transform 160ms ease,box-shadow 160ms ease;',
                          states: {
                            hover: 'transform:translateY(-1px);box-shadow:0 24px 40px -20px rgba(226,175,50,1);',
                            active: 'transform:translateY(0);',
                            'focus-visible': 'outline:2px solid var(--ink,#F7F1E8);outline-offset:3px;',
                          },
                          bp: { sm: { base: 'width:100%;' } },
                        }),
                        el('hero-cta-2', 'a', {
                          text: txt('hero-cta-2'),
                          attrs: { href: '#pricing' },
                          css:
                            'display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 26px;border-radius:999px;border:1px solid rgba(226,175,50,0.38);color:var(--ink,#F7F1E8);font-size:15.5px;font-weight:600;text-decoration:none;transition:border-color 160ms ease,background-color 160ms ease;',
                          states: {
                            hover: 'border-color:var(--brass,#E2AF32);background-color:rgba(226,175,50,0.07);',
                            'focus-visible': 'outline:2px solid var(--brass,#E2AF32);outline-offset:3px;',
                          },
                          bp: { sm: { base: 'width:100%;' } },
                        }),
                      ],
                    }),
                    el('hero-facts', 'div', {
                      css:
                        'display:flex;flex-wrap:wrap;gap:38px;margin-top:36px;padding-top:22px;border-top:1px solid rgba(226,175,50,0.16);width:100%;',
                      bp: {
                        md: { base: 'gap:26px;margin-top:28px;' },
                        sm: { base: 'gap:16px;justify-content:space-between;' },
                      },
                      children: [0, 1, 2].map((i) =>
                        el('hero-fact-' + i, 'div', {
                          css: 'display:flex;flex-direction:column;gap:3px;min-width:0;',
                          children: [
                            el('hero-fact-v-' + i, 'span', {
                              text: txt('hero-fact-v-' + i),
                              css: 'font-size:21px;font-weight:800;color:var(--ink,#F7F1E8);line-height:1.3;',
                              bp: { sm: { base: 'font-size:18px;' } },
                            }),
                            el('hero-fact-l-' + i, 'span', {
                              text: txt('hero-fact-l-' + i),
                              css: 'font-size:12.5px;font-weight:400;color:var(--muted,#BFAEA3);line-height:1.6;',
                            }),
                          ],
                        }),
                      ),
                    }),
                  ],
                }),
                el('hero-media', 'div', {
                  css: 'position:relative;margin:0;min-width:0;',
                  bp: { md: { base: 'margin-top:2px;' } },
                  children: [
                    el('hero-shotwrap', 'div', {
                      css:
                        'position:relative;z-index:1;width:100%;aspect-ratio:46 / 54;border-radius:22px;overflow:hidden;background:#221A15;',
                      bp: {
                        md: { base: 'aspect-ratio:auto;height:320px;' },
                        sm: { base: 'height:280px;' },
                      },
                      children: [
                        el('hero-shot', 'img', {
                          attrs: {
                            src: at('hero-shot').src,
                            alt: at('hero-shot').alt,
                            loading: 'eager',
                            decoding: 'async',
                          },
                          css:
                            'display:block;width:100%;height:100%;object-fit:cover;transform-origin:62% 48%;',
                        }),
                      ],
                    }),
                    el('hero-frame', 'div', {
                      attrs: { 'aria-hidden': 'true' },
                      css:
                        'position:absolute;inset:14px;z-index:2;border:1px solid rgba(226,175,50,0.3);border-radius:14px;pointer-events:none;',
                      bp: { sm: { base: 'inset:11px;' } },
                    }),
                    el('hero-plate', 'div', {
                      css:
                        'position:absolute;z-index:3;inset-inline-start:20px;bottom:20px;width:224px;padding:16px 18px;border-radius:14px;border:1px solid rgba(226,175,50,0.32);background:rgba(25,19,16,0.9);backdrop-filter:blur(8px);box-shadow:0 26px 50px -30px rgba(0,0,0,0.95);',
                      bp: {
                        md: { base: 'inset-inline-start:16px;bottom:16px;width:200px;padding:14px 16px;' },
                        sm: { base: 'inset-inline-start:14px;bottom:14px;width:178px;padding:12px 14px;' },
                      },
                      children: [
                        el('hero-plate-label', 'span', {
                          text: txt('hero-plate-label'),
                          css: 'display:block;font-size:11.5px;font-weight:600;color:var(--muted,#BFAEA3);line-height:1.5;',
                        }),
                        el('hero-plate-price', 'span', {
                          text: txt('hero-plate-price'),
                          css: 'display:block;font-size:19px;font-weight:800;color:var(--brass,#E2AF32);margin-top:4px;line-height:1.4;',
                        }),
                        el('hero-plate-time', 'div', {
                          css:
                            'display:flex;align-items:center;gap:6px;margin-top:8px;color:var(--ink,#F7F1E8);font-size:12.5px;',
                          children: [
                            el('hero-plate-ic', 'span', {
                              cls: ['ic'],
                              content: txt('hero-plate-ic'),
                              css: 'display:inline-flex;width:14px;height:14px;color:var(--brass,#E2AF32);',
                            }),
                            el('hero-plate-time-t', 'span', { text: txt('hero-plate-time-t') }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ───────── moving service strip ─────────
        el('strip', 'div', {
          cls: ['strip'],
          css:
            'position:relative;height:48px;display:flex;justify-content:center;background-color:var(--bg2,#191310);border-block:1px solid rgba(226,175,50,0.14);overflow:hidden;',
          children: [
            el('strip-pause', 'input', {
              attrs: { type: 'checkbox', id: 'strip-pause', 'aria-label': 'توقف یا ادامهٔ نوار خدمات' },
              css: 'position:absolute;width:1px;height:1px;opacity:0;margin:0;pointer-events:none;',
            }),
            el('strip-inner', 'div', {
              css:
                'width:100%;max-width:1320px;padding:0 28px;height:100%;display:flex;align-items:stretch;',
              bp: {
                md: { base: 'padding:0 24px;' },
                sm: { base: 'padding:0 20px;' },
              },
              children: [
                el('strip-toggle', 'label', {
                  attrs: { for: 'strip-pause' },
                  css:
                    'flex:0 0 auto;width:62px;height:100%;display:inline-flex;align-items:center;justify-content:center;border-inline-end:1px solid rgba(226,175,50,0.18);color:var(--muted,#BFAEA3);font-size:10.5px;font-weight:600;letter-spacing:0.04em;cursor:pointer;transition:color 160ms ease,background-color 160ms ease;',
                  states: { hover: 'color:var(--brass,#E2AF32);background-color:rgba(226,175,50,0.06);' },
                }),
                el('strip-viewport', 'div', {
                  css:
                    'flex:1;height:100%;overflow:hidden;direction:ltr;mask-image:linear-gradient(to right,transparent 0%,#000 6%,#000 94%,transparent 100%);-webkit-mask-image:linear-gradient(to right,transparent 0%,#000 6%,#000 94%,transparent 100%);',
                  children: [
                    el('strip-track', 'div', {
                      css:
                        'display:flex;align-items:center;direction:ltr;width:max-content;height:100%;will-change:transform;backface-visibility:hidden;',
                      children: [
                        el('strip-group-a', 'div', {
                          css: 'display:flex;align-items:center;gap:34px;padding-inline-end:34px;height:100%;',
                          children: stripItems('a'),
                        }),
                        el('strip-group-b', 'div', {
                          attrs: { 'aria-hidden': 'true' },
                          css: 'display:flex;align-items:center;gap:34px;padding-inline-end:34px;height:100%;',
                          children: stripItems('b'),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ───────── services ─────────
        el('services', 'section', {
          attrs: { id: 'services' },
          css:
            'padding:84px 0 76px;background-color:var(--bg2,#191310);scroll-margin-top:92px;',
          bp: { md: { base: 'padding:60px 0 56px;' }, sm: { base: 'padding:48px 0 44px;' } },
          children: [
            el('svc-inner', 'div', {
              css: 'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;',
              bp: {
                xxl: { base: 'max-width:1320px;' },
                md: { base: 'padding:0 24px;' },
                sm: { base: 'padding:0 20px;' },
              },
              children: [
                el('svc-head', 'div', {
                  css:
                    'display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:30px;',
                  bp: { md: { base: 'margin-bottom:24px;' } },
                  children: [
                    el('svc-title', 'h2', {
                      text: txt('svc-title'),
                      css: 'margin:0;font-size:40px;font-weight:900;line-height:1.15;color:var(--ink,#F7F1E8);',
                      bp: { md: { base: 'font-size:32px;' }, sm: { base: 'font-size:28px;' } },
                    }),
                    el('svc-link', 'a', {
                      cls: ['link-arrow'],
                      attrs: { href: '#pricing' },
                      css:
                        'display:inline-flex;align-items:center;gap:8px;padding-bottom:5px;border-bottom:1px solid rgba(226,175,50,0.32);color:var(--brass,#E2AF32);font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap;transition:border-color 160ms ease;',
                      states: { hover: 'border-color:var(--brass,#E2AF32);' },
                      children: [
                        el('svc-link-t', 'span', { text: txt('svc-link-t') }),
                        el('svc-link-ic', 'span', {
                          cls: ['ic'],
                          content: txt('svc-link-ic'),
                          css: 'display:inline-flex;width:15px;height:15px;',
                        }),
                      ],
                    }),
                  ],
                }),
                el('svc-grid', 'div', {
                  css:
                    'display:grid;grid-template-columns:minmax(0,1.06fr) minmax(0,1fr);gap:20px;align-items:stretch;',
                  bp: {
                    md: { base: 'grid-template-columns:minmax(0,1fr);gap:16px;' },
                  },
                  children: [
                    el('svc-hero', 'article', {
                      cls: ['svc-card'],
                      css:
                        'position:relative;overflow:hidden;border-radius:20px;min-height:456px;display:flex;flex-direction:column;justify-content:flex-end;background:#1d1611;',
                      bp: {
                        md: { base: 'min-height:340px;' },
                        sm: { base: 'min-height:300px;' },
                      },
                      children: [
                        el('svc-hero-img', 'img', {
                          attrs: {
                            src: at('svc-hero-img').src,
                            alt: at('svc-hero-img').alt,
                            loading: 'lazy',
                            decoding: 'async',
                          },
                          css:
                            'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.74;',
                        }),
                        el('svc-hero-shade', 'div', {
                          attrs: { 'aria-hidden': 'true' },
                          css:
                            'position:absolute;inset:0;background:linear-gradient(to top,rgba(15,11,9,0.94) 4%,rgba(15,11,9,0.5) 46%,rgba(15,11,9,0.06) 82%);',
                        }),
                        el('svc-hero-body', 'div', {
                          css: 'position:relative;z-index:2;padding:26px 26px 24px;',
                          bp: { md: { base: 'padding:22px;' }, sm: { base: 'padding:20px;' } },
                          children: [
                            el('svc-hero-name', 'h3', {
                              text: txt('svc-hero-name'),
                              css: 'margin:0;font-size:27px;font-weight:800;color:var(--ink,#F7F1E8);line-height:1.3;',
                              bp: { sm: { base: 'font-size:23px;' } },
                            }),
                            el('svc-hero-desc', 'p', {
                              text: txt('svc-hero-desc'),
                              css:
                                'margin:10px 0 0;max-width:34ch;font-size:14.5px;line-height:1.85;color:var(--muted,#BFAEA3);',
                            }),
                            el('svc-hero-meta', 'div', {
                              css: 'display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:18px;',
                              children: [
                                el('svc-hero-price', 'span', {
                                  text: txt('svc-hero-price'),
                                  css:
                                    'display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:8px;border:1px solid rgba(226,175,50,0.26);background:rgba(226,175,50,0.13);color:var(--brass,#E2AF32);font-size:12.5px;font-weight:700;',
                                }),
                                el('svc-hero-time', 'span', {
                                  text: txt('svc-hero-time'),
                                  css: 'font-size:12.5px;color:var(--muted,#BFAEA3);',
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                    el('svc-surface', 'div', {
                      css:
                        'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-radius:20px;border:1px solid rgba(226,175,50,0.16);background:rgba(34,26,21,0.5);overflow:hidden;',
                      bp: { sm: { base: 'grid-template-columns:minmax(0,1fr);' } },
                      children: [
                        serviceCell(2, ''),
                        serviceCell(3, 'border-inline-start:1px solid rgba(226,175,50,0.14);'),
                        serviceCell(4, 'border-block-start:1px solid rgba(226,175,50,0.14);'),
                        serviceCell(
                          5,
                          'border-inline-start:1px solid rgba(226,175,50,0.14);border-block-start:1px solid rgba(226,175,50,0.14);',
                        ),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ───────── pricing + packages ─────────
        el('pricing', 'section', {
          attrs: { id: 'pricing' },
          css: 'padding:88px 0 84px;background-color:var(--bg,#14100D);scroll-margin-top:92px;',
          bp: { md: { base: 'padding:64px 0 60px;' }, sm: { base: 'padding:52px 0 48px;' } },
          children: [
            el('price-inner', 'div', {
              css: 'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;',
              bp: {
                xxl: { base: 'max-width:1320px;' },
                md: { base: 'padding:0 24px;' },
                sm: { base: 'padding:0 20px;' },
              },
              children: [
                el('price-title', 'h2', {
                  text: txt('price-title'),
                  css: 'margin:0 0 32px;font-size:40px;font-weight:900;line-height:1.15;color:var(--ink,#F7F1E8);',
                  bp: { md: { base: 'font-size:32px;margin-bottom:24px;' }, sm: { base: 'font-size:28px;margin-bottom:20px;' } },
                }),
                el('price-body', 'div', {
                  css:
                    'display:grid;grid-template-columns:minmax(0,1.62fr) minmax(0,0.86fr);gap:32px;align-items:stretch;',
                  bp: { md: { base: 'grid-template-columns:minmax(0,1fr);gap:28px;' } },
                  children: [
                    el('price-panel', 'div', {
                      css:
                        'border-radius:20px;border:1px solid rgba(226,175,50,0.2);background-color:var(--bg3,#221A15);padding:6px 26px 8px;',
                      bp: {
                        md: { base: 'padding:4px 18px 6px;' },
                        sm: { base: 'padding:2px 14px 4px;border-radius:16px;' },
                      },
                      children: [
                        el('price-g1', 'div', {
                          children: [
                            el('price-g1-h', 'h3', {
                              text: txt('price-g1-h'),
                              css:
                                'margin:0;padding:20px 0 8px;font-size:12.5px;font-weight:700;letter-spacing:0.06em;color:var(--brass,#E2AF32);',
                            }),
                            ...[1, 2, 3, 4, 5].map((i) => priceRow(i)),
                          ],
                        }),
                        el('price-g2', 'div', {
                          css: 'margin-top:4px;border-top:1px solid rgba(226,175,50,0.14);',
                          children: [
                            el('price-g2-h', 'h3', {
                              text: txt('price-g2-h'),
                              css:
                                'margin:0;padding:18px 0 8px;font-size:12.5px;font-weight:700;letter-spacing:0.06em;color:var(--brass,#E2AF32);',
                            }),
                            ...[6, 7].map((i) => priceRow(i)),
                          ],
                        }),
                      ],
                    }),
                    el('price-aside', 'div', {
                      css:
                        'display:flex;flex-direction:column;justify-content:space-between;min-width:0;padding-top:4px;',
                      children: [
                        el('price-note', 'div', {
                          css: 'padding-bottom:20px;border-bottom:1px solid rgba(226,175,50,0.14);',
                          children: [
                            el('price-note-t', 'span', {
                              text: txt('price-note-t'),
                              css:
                                'display:block;margin-bottom:8px;font-size:12.5px;font-weight:700;letter-spacing:0.05em;color:var(--brass,#E2AF32);',
                            }),
                            el('price-note-v', 'p', {
                              text: txt('price-note-v'),
                              css: 'margin:0;font-size:13.5px;line-height:1.9;color:var(--muted,#BFAEA3);',
                            }),
                          ],
                        }),
                        el('price-hours', 'div', {
                          css: 'padding:20px 0;border-bottom:1px solid rgba(226,175,50,0.14);',
                          children: [
                            el('price-hours-t', 'span', {
                              text: txt('price-hours-t'),
                              css:
                                'display:block;margin-bottom:8px;font-size:12.5px;font-weight:700;letter-spacing:0.05em;color:var(--brass,#E2AF32);',
                            }),
                            el('price-hours-d', 'p', {
                              text: txt('price-hours-d'),
                              css: 'margin:0;font-size:13.5px;line-height:1.9;color:var(--ink,#F7F1E8);',
                            }),
                            el('price-hours-f', 'p', {
                              text: txt('price-hours-f'),
                              css: 'margin:2px 0 0;font-size:13.5px;line-height:1.9;color:var(--muted,#BFAEA3);',
                            }),
                          ],
                        }),
                        el('price-call', 'a', {
                          attrs: { href: 'tel:+982188774521' },
                          css:
                            'margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border-radius:10px;border:1px solid rgba(226,175,50,0.4);color:var(--ink,#F7F1E8);font-size:14px;font-weight:600;text-decoration:none;transition:border-color 160ms ease,background-color 160ms ease;',
                          states: {
                            hover: 'border-color:var(--brass,#E2AF32);background-color:rgba(226,175,50,0.08);',
                            'focus-visible': 'outline:2px solid var(--brass,#E2AF32);outline-offset:3px;',
                          },
                          children: [
                            el('price-call-ic', 'span', {
                              cls: ['ic'],
                              content: txt('price-call-ic'),
                              css: 'display:inline-flex;width:16px;height:16px;color:var(--brass,#E2AF32);',
                            }),
                            el('price-call-t', 'span', { text: txt('price-call-t') }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                el('pkg-block', 'div', {
                  css: 'margin-top:44px;',
                  bp: { md: { base: 'margin-top:34px;' } },
                  children: [
                    el('pkg-title', 'h3', {
                      text: txt('pkg-title'),
                      css:
                        'margin:0;padding-top:24px;border-top:1px solid rgba(226,175,50,0.16);font-size:25px;font-weight:800;color:var(--ink,#F7F1E8);line-height:1.3;',
                      bp: { md: { base: 'font-size:22px;padding-top:20px;' } },
                    }),
                    el('pkg-list', 'div', {
                      css: 'display:flex;flex-direction:column;margin-top:4px;',
                      children: [1, 2, 3].map((i) => packageRow(i)),
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ───────── gallery ─────────
        el('gallery', 'section', {
          attrs: { id: 'work' },
          css:
            'padding:72px 0;background-color:var(--bg2,#191310);border-block:1px solid rgba(226,175,50,0.1);scroll-margin-top:92px;',
          bp: { md: { base: 'padding:56px 0;' }, sm: { base: 'padding:44px 0;' } },
          children: [
            el('gal-inner', 'div', {
              css: 'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;',
              bp: {
                xxl: { base: 'max-width:1320px;' },
                md: { base: 'padding:0 24px;' },
                sm: { base: 'padding:0 20px;' },
              },
              children: [
                el('gal-title', 'h2', {
                  text: txt('gal-title'),
                  css: 'margin:0 0 26px;font-size:40px;font-weight:900;line-height:1.15;color:var(--ink,#F7F1E8);',
                  bp: { md: { base: 'font-size:32px;margin-bottom:20px;' }, sm: { base: 'font-size:28px;' } },
                }),
                el('gal-grid', 'div', {
                  css:
                    'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:168px;gap:14px;',
                  bp: {
                    lg: { base: 'grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:158px;' },
                    md: {
                      base: 'grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:150px;gap:12px;',
                    },
                    sm: { base: 'grid-auto-rows:126px;gap:10px;' },
                  },
                  children: [
                    galleryTile(1, 'grid-column:span 2;grid-row:span 2;'),
                    galleryTile(2, ''),
                    galleryTile(3, 'grid-row:span 2;'),
                    galleryTile(4, ''),
                    galleryTile(5, 'grid-column:span 2;'),
                    galleryTile(6, 'grid-column:span 2;'),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ───────── team ─────────
        el('team', 'section', {
          attrs: { id: 'team' },
          css: 'padding:84px 0;background-color:var(--bg,#14100D);scroll-margin-top:92px;',
          bp: { md: { base: 'padding:60px 0;' }, sm: { base: 'padding:48px 0;' } },
          children: [
            el('team-inner', 'div', {
              css: 'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;',
              bp: {
                xxl: { base: 'max-width:1320px;' },
                md: { base: 'padding:0 24px;' },
                sm: { base: 'padding:0 20px;' },
              },
              children: [
                el('team-title', 'h2', {
                  text: txt('team-title'),
                  css: 'margin:0 0 34px;font-size:40px;font-weight:900;line-height:1.15;color:var(--ink,#F7F1E8);',
                  bp: { md: { base: 'font-size:32px;margin-bottom:26px;' }, sm: { base: 'font-size:28px;' } },
                }),
                el('team-grid', 'div', {
                  css: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:44px;align-items:start;',
                  bp: {
                    md: { base: 'gap:24px;' },
                    sm: { base: 'grid-template-columns:minmax(0,1fr);gap:32px;' },
                  },
                  children: [1, 2, 3].map((i) => teamProfile(i)),
                }),
              ],
            }),
          ],
        }),

        // ───────── reviews ─────────
        el('reviews', 'section', {
          attrs: { id: 'reviews' },
          css:
            'padding:64px 0;background-color:var(--band,#2A1F19);border-block:1px solid rgba(226,175,50,0.14);scroll-margin-top:92px;',
          bp: { md: { base: 'padding:48px 0;' }, sm: { base: 'padding:40px 0;' } },
          children: [
            el('rev-inner', 'div', {
              css: 'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;',
              bp: {
                xxl: { base: 'max-width:1320px;' },
                md: { base: 'padding:0 24px;' },
                sm: { base: 'padding:0 20px;' },
              },
              children: [
                el('rev-title', 'h2', {
                  text: txt('rev-title'),
                  css: 'margin:0 0 30px;font-size:40px;font-weight:900;line-height:1.15;color:var(--ink,#F7F1E8);',
                  bp: { md: { base: 'font-size:32px;margin-bottom:22px;' }, sm: { base: 'font-size:28px;' } },
                }),
                el('rev-body', 'div', {
                  css: 'display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:40px;align-items:start;',
                  bp: { md: { base: 'grid-template-columns:minmax(0,1fr);gap:26px;' } },
                  children: [
                    el('rev-feature', 'blockquote', {
                      css: 'margin:0;padding:0;border:0;background:none;',
                      children: [
                        el('rev-feature-q', 'p', {
                          text: txt('rev-feature-q'),
                          css:
                            'margin:0;font-size:23px;font-weight:500;line-height:1.85;color:var(--ink,#F7F1E8);',
                          bp: { md: { base: 'font-size:19px;' }, sm: { base: 'font-size:17px;line-height:1.9;' } },
                        }),
                        el('rev-feature-by', 'footer', {
                          css: 'display:flex;align-items:center;gap:12px;margin-top:22px;',
                          children: [
                            el('rev-feature-av', 'span', {
                              text: txt('rev-feature-av'),
                              attrs: { 'aria-hidden': 'true' },
                              css:
                                'display:grid;place-items:center;width:38px;height:38px;border-radius:50%;border:1px solid rgba(226,175,50,0.32);background:rgba(226,175,50,0.16);color:var(--brass,#E2AF32);font-size:13px;font-weight:700;flex:0 0 auto;',
                            }),
                            el('rev-feature-meta', 'div', {
                              css: 'display:flex;flex-direction:column;gap:2px;',
                              children: [
                                el('rev-feature-name', 'cite', {
                                  text: txt('rev-feature-name'),
                                  css: 'font-style:normal;font-size:14px;font-weight:700;color:var(--ink,#F7F1E8);',
                                }),
                                el('rev-feature-note', 'span', {
                                  text: txt('rev-feature-note'),
                                  css: 'font-size:12px;color:var(--muted,#BFAEA3);',
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                    el('rev-list', 'div', {
                      css:
                        'display:flex;flex-direction:column;border-inline-start:1px solid rgba(226,175,50,0.18);padding-inline-start:28px;',
                      bp: {
                        md: {
                          base:
                            'border-inline-start:0;padding-inline-start:0;border-top:1px solid rgba(226,175,50,0.16);padding-top:18px;',
                        },
                        sm: { base: 'padding-top:14px;' },
                      },
                      children: [
                        ...[2, 3, 4].map((i) => shortReview(i)),
                        el('rev-summary', 'div', {
                          css: 'display:flex;align-items:baseline;gap:10px;padding-top:18px;',
                          children: [
                            el('rev-summary-v', 'span', {
                              text: txt('rev-summary-v'),
                              css: 'font-size:30px;font-weight:900;color:var(--brass,#E2AF32);line-height:1.2;',
                            }),
                            el('rev-summary-l', 'span', {
                              text: txt('rev-summary-l'),
                              css: 'font-size:12.5px;color:var(--muted,#BFAEA3);',
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ───────── booking ─────────
        el('booking', 'section', {
          attrs: { id: 'booking' },
          css:
            'position:relative;padding:88px 0;background-color:var(--bg,#14100D);background-image:radial-gradient(circle at 12% 0%,rgba(226,175,50,0.07),transparent 50%);scroll-margin-top:92px;',
          bp: { md: { base: 'padding:64px 0;' }, sm: { base: 'padding:52px 0;' } },
          children: [
            el('book-inner', 'div', {
              css: 'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;',
              bp: {
                xxl: { base: 'max-width:1320px;' },
                md: { base: 'padding:0 24px;' },
                sm: { base: 'padding:0 20px;' },
              },
              children: [
                el('book-title', 'h2', {
                  text: txt('book-title'),
                  css: 'margin:0 0 30px;font-size:40px;font-weight:900;line-height:1.15;color:var(--ink,#F7F1E8);',
                  bp: { md: { base: 'font-size:32px;margin-bottom:22px;' }, sm: { base: 'font-size:28px;' } },
                }),
                el('book-body', 'div', {
                  css:
                    'display:grid;grid-template-columns:minmax(0,0.82fr) minmax(0,1.18fr);gap:44px;align-items:start;',
                  bp: { md: { base: 'grid-template-columns:minmax(0,1fr);gap:26px;' } },
                  children: [
                    el('book-side', 'div', {
                      css: 'display:flex;flex-direction:column;padding-top:2px;',
                      bp: { md: { base: 'order:2;' } },
                      children: [
                        bookingFact('book-fact-phone', 'book-fact-phone-ic', txt('book-fact-phone-v'), {
                          valueTag: 'a',
                          valueAttrs: { href: 'tel:+982188774521' },
                          sub: txt('book-fact-phone-s'),
                        }),
                        bookingFact('book-addr', 'book-addr-ic', txt('book-addr-v'), {
                          sub: txt('book-addr-s'),
                        }),
                        bookingFact('book-meta', 'book-meta-ic', txt('book-meta-v'), {
                          sub: txt('book-meta-s'),
                        }),
                        el('book-cta-2', 'a', {
                          text: txt('book-cta-2'),
                          attrs: { href: 'tel:+982188774521' },
                          css:
                            'margin-top:22px;display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:10px;border:1px solid rgba(226,175,50,0.36);color:var(--ink,#F7F1E8);font-size:14px;font-weight:600;text-decoration:none;transition:border-color 160ms ease,background-color 160ms ease;',
                          states: {
                            hover: 'border-color:var(--brass,#E2AF32);background-color:rgba(226,175,50,0.08);',
                            'focus-visible': 'outline:2px solid var(--brass,#E2AF32);outline-offset:3px;',
                          },
                        }),
                      ],
                    }),
                    el('book-form', 'form', {
                      attrs: { action: '#booking', method: 'get' },
                      css:
                        'order:1;padding:26px;border-radius:20px;border:1px solid rgba(226,175,50,0.22);background-color:var(--bg3,#221A15);display:flex;flex-direction:column;gap:16px;',
                      bp: {
                        md: { base: 'padding:20px;' },
                        sm: { base: 'padding:18px;border-radius:16px;gap:14px;' },
                      },
                      children: [
                        el('book-form-title', 'h3', {
                          text: txt('book-form-title'),
                          css: 'margin:0;font-size:20px;font-weight:800;color:var(--ink,#F7F1E8);line-height:1.4;',
                        }),
                        el('book-row-1', 'div', {
                          css: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;',
                          bp: { sm: { base: 'grid-template-columns:minmax(0,1fr);' } },
                          children: [
                            fieldGroup('book-f1', 'lbl-name', 'fld-1', 'fld-name', 'input', {
                              type: 'text',
                              name: 'name',
                              placeholder: txt('fld-1') == null ? '' : '',
                              autocomplete: 'name',
                            }),
                            fieldGroup('book-f2', 'lbl-phone', 'fld-2', 'fld-phone', 'input', {
                              type: 'tel',
                              name: 'phone',
                            }),
                          ],
                        }),
                        el('book-row-2', 'div', {
                          css: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;',
                          bp: { sm: { base: 'grid-template-columns:minmax(0,1fr);' } },
                          children: [
                            fieldGroup('book-f3', 'lbl-service', 'fld-3', 'fld-service', 'select', {}),
                            fieldGroup('book-f4', 'lbl-date', 'fld-4', 'fld-date', 'input', {
                              type: 'date',
                              name: 'date',
                            }),
                          ],
                        }),
                        el('book-row-3', 'div', {
                          css: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;',
                          bp: { sm: { base: 'grid-template-columns:minmax(0,1fr);' } },
                          children: [
                            fieldGroup('book-f5', 'lbl-time', 'fld-5', 'fld-time', 'select', {}),
                            fieldGroup('book-f6', 'lbl-barber', 'fld-6', 'fld-barber', 'select', {}),
                          ],
                        }),
                        el('book-submit', 'button', {
                          text: txt('book-submit'),
                          attrs: { type: 'submit' },
                          css:
                            'margin-top:4px;display:inline-flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:0;border-radius:10px;background-image:linear-gradient(140deg,#E2AF32,#B8862A);color:#191310;font-size:15.5px;font-weight:800;font-family:inherit;cursor:pointer;transition:transform 160ms ease,box-shadow 160ms ease;',
                          states: {
                            hover: 'transform:translateY(-1px);box-shadow:0 20px 32px -22px rgba(226,175,50,0.95);',
                            active: 'transform:translateY(0);',
                            'focus-visible': 'outline:2px solid var(--ink,#F7F1E8);outline-offset:3px;',
                            disabled: 'opacity:0.55;cursor:not-allowed;',
                          },
                        }),
                        el('book-note', 'p', {
                          text: txt('book-note'),
                          css: 'margin:0;font-size:12px;line-height:1.8;color:var(--muted,#BFAEA3);',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ───────── faq ─────────
        el('faq', 'section', {
          attrs: { id: 'faq' },
          css:
            'padding:64px 0 72px;background-color:var(--bg,#14100D);border-top:1px solid rgba(226,175,50,0.12);scroll-margin-top:92px;',
          bp: { md: { base: 'padding:48px 0 56px;' }, sm: { base: 'padding:40px 0 44px;' } },
          children: [
            el('faq-inner', 'div', {
              css: 'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;',
              bp: {
                xxl: { base: 'max-width:1320px;' },
                md: { base: 'padding:0 24px;' },
                sm: { base: 'padding:0 20px;' },
              },
              children: [
                el('faq-title', 'h2', {
                  text: txt('faq-title'),
                  css: 'margin:0 0 22px;font-size:40px;font-weight:900;line-height:1.15;color:var(--ink,#F7F1E8);',
                  bp: { md: { base: 'font-size:32px;' }, sm: { base: 'font-size:28px;' } },
                }),
                el('faq-list', 'div', {
                  css: 'display:flex;flex-direction:column;',
                  children: [1, 2, 3, 4].map((i) => faqItem(i)),
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ───────── footer ─────────
    el('footer', 'footer', {
      css:
        'background-color:#0F0B09;border-top:1px solid rgba(226,175,50,0.18);padding:64px 0 26px;',
      bp: { md: { base: 'padding:48px 0 22px;' }, sm: { base: 'padding:40px 0 20px;' } },
      children: [
        el('ft-inner', 'div', {
          css: 'max-width:1240px;margin:0 auto;padding:0 28px;width:100%;',
          bp: {
            xxl: { base: 'max-width:1320px;' },
            md: { base: 'padding:0 24px;' },
            sm: { base: 'padding:0 20px;' },
          },
          children: [
            el('ft-grid', 'div', {
              css: 'display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:34px;align-items:start;',
              bp: {
                md: { base: 'grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;' },
                sm: { base: 'grid-template-columns:minmax(0,1fr);gap:26px;' },
              },
              children: [
                el('ft-brand', 'div', {
                  children: [
                    el('ft-logo', 'div', {
                      css: 'display:flex;align-items:center;gap:10px;',
                      children: [
                        el('ft-mark', 'span', {
                          text: txt('ft-mark'),
                          attrs: { 'aria-hidden': 'true' },
                          css:
                            'display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background-image:linear-gradient(140deg,#E2AF32,#B8862A);color:#191310;font-size:17px;font-weight:900;flex:0 0 auto;',
                        }),
                        el('ft-name', 'span', {
                          text: txt('ft-name'),
                          css: 'font-size:17px;font-weight:800;color:var(--ink,#F7F1E8);',
                        }),
                      ],
                    }),
                    el('ft-addr', 'p', {
                      text: txt('ft-addr'),
                      css: 'margin:14px 0 8px;max-width:30ch;font-size:13px;line-height:1.85;color:var(--muted,#BFAEA3);',
                    }),
                    el('ft-phone', 'a', {
                      text: txt('ft-phone'),
                      attrs: { href: 'tel:+982188774521' },
                      css:
                        'font-size:14px;font-weight:600;color:var(--ink,#F7F1E8);text-decoration:none;transition:color 160ms ease;',
                      states: { hover: 'color:var(--brass,#E2AF32);' },
                    }),
                  ],
                }),
                el('ft-hours', 'div', {
                  children: [
                    el('ft-hours-t', 'h3', {
                      text: txt('ft-hours-t'),
                      css: 'margin:0 0 12px;font-size:13px;font-weight:700;color:var(--ink,#F7F1E8);',
                    }),
                    ...[1, 2, 3, 4].map((i) =>
                      el('ft-hours-' + i, 'p', {
                        text: txt('ft-hours-' + i),
                        css:
                          'margin:0;font-size:12.5px;line-height:1.95;color:var(--muted,#BFAEA3);',
                      }),
                    ),
                  ],
                }),
                el('ft-links', 'div', {
                  children: [
                    el('ft-links-t', 'h3', {
                      text: txt('ft-links-t'),
                      css: 'margin:0 0 12px;font-size:13px;font-weight:700;color:var(--ink,#F7F1E8);',
                    }),
                    el('ft-links-list', 'div', {
                      css: 'display:flex;flex-direction:column;gap:8px;',
                      children: [1, 2, 3, 4, 5].map((i) =>
                        el('ft-link-' + i, 'a', {
                          text: txt('ft-link-' + i),
                          attrs: { href: at('ft-link-' + i) ? at('ft-link-' + i).href : '#' },
                          css:
                            'font-size:13px;color:var(--muted,#BFAEA3);text-decoration:none;transition:color 160ms ease;',
                          states: { hover: 'color:var(--ink,#F7F1E8);' },
                        }),
                      ),
                    }),
                  ],
                }),
                el('ft-social', 'div', {
                  children: [
                    el('ft-social-t', 'h3', {
                      text: txt('ft-social-t'),
                      css: 'margin:0 0 12px;font-size:13px;font-weight:700;color:var(--ink,#F7F1E8);',
                    }),
                    el('ft-social-row', 'div', {
                      css: 'display:flex;gap:10px;',
                      children: [
                        el('ft-ig', 'a', {
                          attrs: at('ft-ig'),
                          css:
                            'display:grid;place-items:center;width:38px;height:38px;border-radius:10px;border:1px solid rgba(226,175,50,0.2);color:var(--muted,#BFAEA3);transition:color 160ms ease,border-color 160ms ease;',
                          states: { hover: 'color:var(--brass,#E2AF32);border-color:rgba(226,175,50,0.55);' },
                          children: [
                            el('ft-ig-ic', 'span', {
                              cls: ['ic'],
                              content: txt('ft-ig-ic'),
                              css: 'display:inline-flex;width:18px;height:18px;',
                            }),
                          ],
                        }),
                        el('ft-wa', 'a', {
                          attrs: at('ft-wa'),
                          css:
                            'display:grid;place-items:center;width:38px;height:38px;border-radius:10px;border:1px solid rgba(226,175,50,0.2);color:var(--muted,#BFAEA3);transition:color 160ms ease,border-color 160ms ease;',
                          states: { hover: 'color:var(--brass,#E2AF32);border-color:rgba(226,175,50,0.55);' },
                          children: [
                            el('ft-wa-ic', 'span', {
                              cls: ['ic'],
                              content: txt('ft-wa-ic'),
                              css: 'display:inline-flex;width:18px;height:18px;',
                            }),
                          ],
                        }),
                      ],
                    }),
                    el('ft-cta', 'a', {
                      text: txt('ft-cta'),
                      attrs: { href: '#booking' },
                      css:
                        'display:inline-flex;align-items:center;justify-content:center;min-height:42px;margin-top:16px;padding:0 20px;border-radius:999px;background-image:linear-gradient(140deg,#E2AF32,#B8862A);color:#191310;font-size:13.5px;font-weight:800;text-decoration:none;transition:transform 160ms ease;',
                      states: {
                        hover: 'transform:translateY(-1px);',
                        'focus-visible': 'outline:2px solid var(--ink,#F7F1E8);outline-offset:3px;',
                      },
                    }),
                  ],
                }),
              ],
            }),
            el('ft-bottom', 'div', {
              css:
                'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-top:44px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);',
              children: [
                el('ft-copy', 'span', {
                  text: txt('ft-copy'),
                  css: 'font-size:11.5px;color:var(--muted,#BFAEA3);',
                }),
                el('ft-note', 'span', {
                  text: txt('ft-note'),
                  css: 'font-size:11.5px;color:rgba(191,174,163,0.7);',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────
// section helpers
// ─────────────────────────────────────────────────────────────
function stripItems(group) {
  const names = [txt('svc-hero-name'), txt('svc-2-name'), txt('svc-3-name'), txt('svc-4-name'), txt('svc-5-name')];
  const out = [];
  // each group carries the service names twice, which keeps a group wider than
  // the widest viewport so the -50% translate never exposes a seam
  for (let pass = 0; pass < 2; pass++) {
    names.forEach((name, i) => {
      const key = `${i}${pass === 0 ? '' : 'b'}`;
      out.push(
        el(`strip-${group}-item-${key}`, 'span', {
          css:
            'display:inline-flex;align-items:center;gap:12px;font-size:13.5px;font-weight:600;color:rgba(247,241,232,0.86);white-space:nowrap;',
          children: [
            el(`strip-${group}-sep-${key}`, 'span', {
              cls: ['ic'],
              content: txt('brand-mark'),
              attrs: { 'aria-hidden': 'true' },
              css:
                'display:inline-flex;width:14px;height:14px;color:var(--brass,#E2AF32);opacity:0.85;flex:0 0 auto;',
            }),
            el(`strip-${group}-t-${key}`, 'span', { text: name }),
          ],
        }),
      );
    });
  }
  return out;
}

function serviceCell(i, borders) {
  return el('svc-' + i, 'article', {
    cls: ['svc-cell'],
    css:
      'display:flex;flex-direction:column;gap:8px;min-width:0;padding:24px 22px;' + borders,
    bp: {
      sm: { base: 'padding:20px 18px;border-inline-start:0;' },
    },
    children: [
      el('svc-' + i + '-ic', 'span', {
        cls: ['ic'],
        content: txt('svc-' + i + '-ic'),
        css:
          'display:inline-flex;width:22px;height:22px;margin-bottom:4px;color:rgba(226,175,50,0.78);',
      }),
      el('svc-' + i + '-name', 'h3', {
        text: txt('svc-' + i + '-name'),
        css: 'margin:0;font-size:17.5px;font-weight:700;color:var(--ink,#F7F1E8);line-height:1.45;',
      }),
      el('svc-' + i + '-desc', 'p', {
        text: txt('svc-' + i + '-desc'),
        css: 'margin:2px 0 0;font-size:13.5px;line-height:1.8;color:var(--muted,#BFAEA3);',
      }),
      el('svc-' + i + '-meta', 'div', {
        css:
          'display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:auto;padding-top:16px;',
        children: [
          el('svc-' + i + '-price', 'span', {
            text: txt('svc-' + i + '-price'),
            css: 'font-size:14.5px;font-weight:800;color:var(--brass,#E2AF32);white-space:nowrap;',
          }),
          el('svc-' + i + '-time', 'span', {
            text: txt('svc-' + i + '-time'),
            css: 'font-size:12px;color:var(--muted,#BFAEA3);white-space:nowrap;',
          }),
        ],
      }),
    ],
  });
}

function priceRow(i) {
  return el('pr-' + i, 'div', {
    cls: ['price-row'],
    css:
      'display:grid;grid-template-columns:minmax(0,max-content) minmax(18px,1fr) 72px 108px;align-items:baseline;gap:12px;padding:16px 0;border-block-end:1px solid rgba(226,175,50,0.1);',
    bp: {
      sm: {
        base:
          'grid-template-columns:minmax(0,1fr) auto;gap:3px 12px;padding:14px 0;',
      },
    },
    children: [
      el('pr-' + i + '-name', 'span', {
        text: txt('pr-' + i + '-name'),
        css: 'font-size:15.5px;font-weight:600;color:var(--ink,#F7F1E8);line-height:1.65;',
        bp: { sm: { base: 'font-size:15px;' } },
      }),
      el('pr-' + i + '-lead', 'span', {
        attrs: { 'aria-hidden': 'true' },
        css: 'align-self:center;height:1px;border-bottom:1px dotted rgba(226,175,50,0.34);',
        bp: { sm: { base: 'display:none;' } },
      }),
      el('pr-' + i + '-time', 'span', {
        text: txt('pr-' + i + '-time'),
        css: 'font-size:12.5px;color:var(--muted,#BFAEA3);white-space:nowrap;text-align:end;',
        bp: { sm: { base: 'grid-column:2;grid-row:1;' } },
      }),
      el('pr-' + i + '-price', 'span', {
        text: txt('pr-' + i + '-price'),
        css: 'font-size:15.5px;font-weight:800;color:var(--brass,#E2AF32);white-space:nowrap;text-align:end;',
        bp: {
          sm: { base: 'grid-column:1 / -1;grid-row:2;font-size:14px;text-align:start;' },
        },
      }),
    ],
  });
}

function packageRow(i) {
  return el('pkg-' + i, 'div', {
    cls: ['pkg'],
    css:
      'display:grid;grid-template-columns:minmax(0,1fr) 148px 92px;align-items:center;gap:20px;padding:20px 0;border-block-end:1px solid rgba(226,175,50,0.12);',
    bp: {
      sm: {
        base: 'grid-template-columns:minmax(0,1fr) auto;gap:10px 12px;padding:18px 0;',
      },
    },
    children: [
      el('pkg-' + i + '-body', 'div', {
        css: 'min-width:0;',
        bp: { sm: { base: 'grid-column:1 / -1;' } },
        children: [
          el('pkg-' + i + '-name', 'h4', {
            text: txt('pkg-' + i + '-name'),
            css: 'margin:0;font-size:17px;font-weight:700;color:var(--ink,#F7F1E8);line-height:1.45;',
          }),
          el('pkg-' + i + '-desc', 'p', {
            text: txt('pkg-' + i + '-desc'),
            css: 'margin:4px 0 0;max-width:52ch;font-size:13px;line-height:1.8;color:var(--muted,#BFAEA3);',
          }),
        ],
      }),
      el('pkg-' + i + '-price', 'span', {
        text: txt('pkg-' + i + '-price'),
        css: 'font-size:15px;font-weight:800;color:var(--brass,#E2AF32);white-space:nowrap;text-align:end;',
        bp: { sm: { base: 'grid-column:1;grid-row:2;text-align:start;justify-self:start;font-size:14px;' } },
      }),
      el('pkg-' + i + '-cta', 'a', {
        text: txt('pkg-' + i + '-cta'),
        attrs: { href: '#booking' },
        css:
          'display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 16px;border-radius:999px;border:1px solid rgba(226,175,50,0.32);color:var(--ink,#F7F1E8);font-size:12.5px;font-weight:600;text-decoration:none;white-space:nowrap;transition:border-color 160ms ease,background-color 160ms ease;',
        states: {
          hover: 'border-color:var(--brass,#E2AF32);background-color:rgba(226,175,50,0.08);',
          'focus-visible': 'outline:2px solid var(--brass,#E2AF32);outline-offset:3px;',
        },
        bp: { sm: { base: 'grid-column:2;grid-row:2;' } },
      }),
    ],
  });
}

function galleryTile(i, grid) {
  return el('gal-' + i, 'figure', {
    cls: ['gal-tile'],
    css:
      'margin:0;position:relative;overflow:hidden;border-radius:16px;min-height:0;background:#1b1512;' + grid,
    children: [
      el('gal-' + i + '-img', 'img', {
        attrs: {
          src: at('gal-' + i + '-img').src,
          alt: at('gal-' + i + '-img').alt,
          loading: 'lazy',
          decoding: 'async',
        },
        css:
          'display:block;width:100%;height:100%;object-fit:cover;filter:saturate(0.9) contrast(1.03);',
      }),
    ],
  });
}

function teamProfile(i) {
  return el('tm-' + i, 'article', {
    css: 'min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center;',
    children: [
      el('tm-' + i + '-ring', 'div', {
        css:
          'width:100%;max-width:236px;padding:7px;border-radius:50%;border:1px solid rgba(226,175,50,0.26);',
        children: [
          el('tm-' + i + '-img', 'img', {
            attrs: {
              src: TEAM_IMAGES[i].src,
              alt: TEAM_IMAGES[i].alt,
              loading: 'lazy',
              decoding: 'async',
            },
            css:
              'display:block;width:100%;aspect-ratio:1 / 1;object-fit:cover;border-radius:50%;filter:saturate(0.9);',
          }),
        ],
      }),
      el('tm-' + i + '-name', 'h3', {
        text: txt('tm-' + i + '-name'),
        css: 'margin:18px 0 0;font-size:19px;font-weight:800;color:var(--ink,#F7F1E8);line-height:1.4;',
      }),
      el('tm-' + i + '-role', 'span', {
        text: txt('tm-' + i + '-role'),
        css: 'margin-top:6px;min-height:20px;font-size:12.5px;color:var(--brass,#E2AF32);line-height:1.6;',
      }),
      el('tm-' + i + '-spec', 'span', {
        text: txt('tm-' + i + '-spec'),
        css: 'margin-top:8px;min-height:44px;max-width:26ch;font-size:13px;line-height:1.75;color:var(--muted,#BFAEA3);',
        bp: { sm: { base: 'min-height:0;' } },
      }),
      el('tm-' + i + '-years', 'span', {
        text: txt('tm-' + i + '-years'),
        css: 'margin-top:10px;font-size:11.5px;letter-spacing:0.04em;color:rgba(191,174,163,0.8);',
      }),
    ],
  });
}

function shortReview(i) {
  return el('rev-' + i, 'div', {
    cls: ['rev-item'],
    css: 'padding:15px 0;border-block-end:1px solid rgba(226,175,50,0.12);',
    children: [
      el('rev-' + i + '-top', 'div', {
        css: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;',
        children: [
          el('rev-' + i + '-name', 'span', {
            text: txt('rev-' + i + '-name'),
            css: 'font-size:13.5px;font-weight:700;color:var(--ink,#F7F1E8);',
          }),
          el('rev-' + i + '-stars', 'span', {
            text: txt('rev-' + i + '-stars'),
            attrs: at('rev-' + i + '-stars'),
            css: 'font-size:11px;letter-spacing:0.12em;color:var(--brass,#E2AF32);white-space:nowrap;',
          }),
        ],
      }),
      el('rev-' + i + '-text', 'p', {
        text: txt('rev-' + i + '-text'),
        css: 'margin:6px 0 0;font-size:13px;line-height:1.85;color:var(--muted,#BFAEA3);',
      }),
    ],
  });
}

function bookingFact(id, iconId, value, o = {}) {
  const valueEl =
    o.valueTag === 'a'
      ? el(id + '-v', 'a', {
          text: value,
          attrs: o.valueAttrs || {},
          css:
            'font-size:15px;font-weight:600;color:var(--ink,#F7F1E8);line-height:1.75;text-decoration:none;transition:color 160ms ease;',
          states: { hover: 'color:var(--brass,#E2AF32);' },
        })
      : el(id + '-v', 'span', {
          text: value,
          css: 'font-size:15px;font-weight:600;color:var(--ink,#F7F1E8);line-height:1.75;',
        });

  return el(id, 'div', {
    css:
      'display:grid;grid-template-columns:20px minmax(0,1fr);gap:12px;padding:18px 0;border-block-end:1px solid rgba(226,175,50,0.14);',
    children: [
      el(iconId, 'span', {
        cls: ['ic'],
        content: txt(iconId),
        css: 'display:inline-flex;width:18px;height:18px;margin-top:3px;color:var(--brass,#E2AF32);',
      }),
      el(id + '-body', 'div', {
        css: 'min-width:0;',
        children: [
          valueEl,
          el(id + '-s', 'span', {
            text: o.sub,
            css: 'display:block;margin-top:4px;font-size:12.5px;color:var(--muted,#BFAEA3);line-height:1.7;',
          }),
        ],
      }),
    ],
  });
}

function fieldGroup(wrapId, labelId, fieldId, domId, kind) {
  const labelText = txt(labelId);
  const isSelect = kind === 'select';
  const fieldCss =
    'width:100%;min-height:48px;padding:0 14px;border-radius:10px;border:1px solid rgba(226,175,50,0.2);background-color:rgba(20,16,13,0.55);color:var(--ink,#F7F1E8);font-size:14.5px;font-family:inherit;transition:border-color 160ms ease,box-shadow 160ms ease;';
  const fieldStates = {
    focus: 'border-color:var(--brass,#E2AF32);box-shadow:0 0 0 3px rgba(226,175,50,0.16);outline:none;',
    hover: 'border-color:rgba(226,175,50,0.36);',
  };
  const options = [];
  if (isSelect) {
    const optNodeBase = fieldId === 'fld-3' ? 'fld-3-opt-' : fieldId === 'fld-5' ? 'fld-5-opt-' : 'fld-6-opt-';
    const count = fieldId === 'fld-3' ? 6 : fieldId === 'fld-5' ? 7 : 4;
    for (let i = 0; i < count; i++) {
      const oid = optNodeBase + i;
      options.push(
        el(oid, 'option', {
          text: txt(oid),
          attrs: at(oid),
          css: 'background-color:#191310;color:var(--ink,#F7F1E8);',
        }),
      );
    }
  }
  const childField = isSelect
    ? el(fieldId, 'select', { attrs: at(fieldId), css: fieldCss, states: fieldStates, children: options })
    : el(fieldId, 'input', { attrs: at(fieldId), css: fieldCss, states: fieldStates });
  return el(wrapId, 'div', {
    css: 'display:flex;flex-direction:column;gap:7px;min-width:0;',
    children: [
      el(labelId, 'label', {
        text: labelText,
        attrs: { for: domId },
        css: 'font-size:12.5px;font-weight:500;color:var(--muted,#BFAEA3);',
      }),
      childField,
    ],
  });
}

function faqItem(i) {
  return el('faq-' + i, 'details', {
    cls: ['faq'],
    attrs: i === 1 ? { open: '' } : {},
    css: 'border-block-end:1px solid rgba(226,175,50,0.14);',
    children: [
      el('faq-' + i + '-sum', 'summary', {
        cls: ['faq-summary'],
        css:
          'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;cursor:pointer;list-style:none;',
        children: [
          el('faq-' + i + '-q', 'span', {
            text: txt('faq-' + i + '-q'),
            css: 'font-size:16.5px;font-weight:600;color:var(--ink,#F7F1E8);line-height:1.6;',
            bp: { sm: { base: 'font-size:15.5px;' } },
          }),
          el('faq-' + i + '-ic', 'span', {
            cls: ['ic', 'faq-icon'],
            attrs: { 'aria-hidden': 'true' },
            content: txt('faq-' + i + '-ic'),
            css:
              'display:inline-flex;width:30px;height:30px;padding:7px;border-radius:50%;background-color:rgba(226,175,50,0.1);color:var(--brass,#E2AF32);flex:0 0 auto;',
          }),
        ],
      }),
      el('faq-' + i + '-a', 'p', {
        cls: ['faq-answer'],
        text: txt('faq-' + i + '-a'),
        css:
          'margin:0;padding:0 0 20px;max-width:72ch;font-size:14.5px;line-height:1.9;color:var(--muted,#BFAEA3);',
        bp: { sm: { base: 'font-size:14px;padding-bottom:18px;' } },
      }),
    ],
  });
}

// ─────────────────────────────────────────────────────────────
// stylesheets
// ─────────────────────────────────────────────────────────────
const styles = [
  {
    name: 'default',
    data: [
      '* { box-sizing:border-box; }',
      'html { -webkit-text-size-adjust:100%; }',
      'body { margin:0; background:#14100D; }',
      'img { max-width:100%; }',
      'pre { white-space:pre-wrap; font-family:inherit; }',
      'a { -webkit-tap-highlight-color:transparent; }',
    ].join('\n'),
  },
  {
    name: 'fonts',
    data: [
      "@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap');",
      'html { scroll-behavior:smooth; }',
      '::selection { background:rgba(226,175,50,0.35); color:#14100D; }',
    ].join('\n'),
  },
  {
    name: 'effects',
    data: `
.ic { line-height:0; display:inline-flex; }
.ic svg { width:100%; height:100%; display:block; }

.burger-summary, .faq-summary { list-style:none; }
.burger-summary::-webkit-details-marker, .faq-summary::-webkit-details-marker { display:none; }
.burger[open] .burger-summary { border-color:var(--brass,#E2AF32); color:var(--brass,#E2AF32); }

.faq-icon { transition:transform 180ms ease, background-color 180ms ease; }
.faq[open] .faq-icon { transform:rotate(45deg); background-color:rgba(226,175,50,0.22); }
.faq[open] > .faq-summary { color:var(--ink,#F7F1E8); }
.faq-answer { animation:taha-answer 180ms ease both; }

.link-arrow .ic { transition:transform 160ms ease; }
.link-arrow:hover .ic { transform:translateX(-3px); }

@media print {
  [class*="blk-"] { animation:none !important; transition:none !important; }
  [data-id="hero-shotwrap"] { clip-path:none !important; }
  [data-id="scroll-line"] { display:none; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior:auto; }
  [class*="blk-"] { animation:none !important; transition:none !important; }
  [data-id="hero-shot"] { transform:none !important; }
  [data-id="hero-shotwrap"] { clip-path:none !important; }
  [data-id="scroll-line"] { display:none; }
}
`.trim(),
  },
  {
    name: 'motion',
    data: `
/* ── keyframes ─────────────────────────────────────────── */
@keyframes taha-rise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes taha-clip {
  from { clip-path:inset(0 0 0 100% round 22px); }
  to   { clip-path:inset(0 0 0 0 round 22px); }
}
@keyframes taha-photo { from { transform:scale(1); } to { transform:scale(1.035); } }
@keyframes taha-plate { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes taha-strip { from { transform:translate3d(0,0,0); } to { transform:translate3d(-50%,0,0); } }
@keyframes taha-scroll-line { from { transform:scaleX(0); } to { transform:scaleX(1); } }
@keyframes taha-reveal { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes taha-answer { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }

/* ── opening sequence ──────────────────────────────────── */
[data-id="hero-title-a"],
[data-id="hero-title-b"] { animation:taha-rise 420ms cubic-bezier(0.22,0.7,0.2,1) both; }
[data-id="hero-desc"] { animation:taha-rise 420ms 80ms cubic-bezier(0.22,0.7,0.2,1) both; }
[data-id="hero-cta-row"] { animation:taha-rise 420ms 160ms cubic-bezier(0.22,0.7,0.2,1) both; }
[data-id="hero-facts"] { animation:taha-rise 420ms 240ms cubic-bezier(0.22,0.7,0.2,1) both; }
[data-id="hero-shotwrap"] { animation:taha-clip 850ms 120ms cubic-bezier(0.22,1,0.36,1) both; }
[data-id="hero-shot"] { animation:taha-photo 12s 260ms cubic-bezier(0.2,0.6,0.3,1) both; will-change:transform; }
[data-id="hero-plate"] { animation:taha-plate 380ms 450ms cubic-bezier(0.22,0.7,0.2,1) both; }

/* ── scroll reveal (progressive enhancement) ───────────── */
@supports (animation-timeline: view()) {
  [data-id="page"] [data-id="svc-inner"],
  [data-id="page"] [data-id="price-inner"],
  [data-id="page"] [data-id="gal-inner"],
  [data-id="page"] [data-id="team-inner"],
  [data-id="page"] [data-id="rev-inner"],
  [data-id="page"] [data-id="book-inner"],
  [data-id="page"] [data-id="faq-inner"],
  [data-id="page"] [data-id="ft-inner"] {
    animation-name:taha-reveal;
    animation-duration:1ms;
    animation-duration:auto;
    animation-timing-function:linear;
    animation-fill-mode:both;
    animation-timeline:view();
    animation-range:entry 8% cover 24%;
  }
}

/* ── scroll progress hairline ──────────────────────────── */
@supports (animation-timeline: scroll()) {
  [data-id="scroll-line"] {
    animation-name:taha-scroll-line;
    animation-duration:1ms;
    animation-duration:auto;
    animation-timing-function:linear;
    animation-fill-mode:both;
    animation-timeline:scroll(nearest block);
  }
}

/* ── service strip ─────────────────────────────────────── */
[data-id="strip-track"] { animation:taha-strip 34s linear infinite; }
[data-id="strip"]:hover [data-id="strip-track"],
[data-id="strip"]:focus-within [data-id="strip-track"] { animation-play-state:paused; }
[data-id="strip-pause"]:checked ~ [data-id="strip-inner"] [data-id="strip-track"] { animation-play-state:paused; }
[data-id="strip-pause"]:checked ~ [data-id="strip-inner"] [data-id="strip-toggle"] {
  border-color:var(--brass,#E2AF32); color:var(--brass,#E2AF32); background:rgba(226,175,50,0.14);
}
[data-id="strip-pause"]:focus-visible ~ [data-id="strip-inner"] [data-id="strip-toggle"] {
  outline:2px solid var(--brass,#E2AF32); outline-offset:2px;
}
[data-id="strip-toggle"]::before { content:"توقف"; }
[data-id="strip-pause"]:checked ~ [data-id="strip-inner"] [data-id="strip-toggle"]::before { content:"ادامه"; }
`.trim(),
  },
];

const out = {
  config: {
    title: 'آرایشگاه مردانه طاها — کوتاهی، اصلاح و رزرو نوبت',
    description:
      'آرایشگاه مردانه طاها در خیابان ولیعصر تهران: کوتاهی مو، اصلاح ریش با تیغ، رنگ و پکیج داماد. تعرفه خدمات و رزرو نوبت آنلاین.',
    size: 'A4',
    orientation: 'Portrait',
    direction: 'rtl',
  },
  data: [
    {
      headerItems: [],
      bodyItems: [nav],
      footerItems: [],
      config: {
        title: 'خانه',
        description: 'صفحه اصلی آرایشگاه مردانه طاها',
      },
      order: 0,
    },
  ],
  styles,
  cssVariables: [
    { type: 'Color', name: 'bg', value: '#14100D' },
    { type: 'Color', name: 'bg2', value: '#191310' },
    { type: 'Color', name: 'bg3', value: '#221A15' },
    { type: 'Color', name: 'band', value: '#2A1F19' },
    { type: 'Color', name: 'ink', value: '#F7F1E8' },
    { type: 'Color', name: 'muted', value: '#BFAEA3' },
    { type: 'Color', name: 'brass', value: '#E2AF32' },
    { type: 'Color', name: 'brass2', value: '#B8862A' },
    { type: 'Color', name: 'line', value: 'rgba(226,175,50,0.16)' },
  ],
};

fs.writeFileSync('taha-barbershop.page.json', JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('written; nodes:', idCounter.size, 'bytes:', JSON.stringify(out).length);
