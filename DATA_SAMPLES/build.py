#!/usr/bin/env python3
"""Generates landing-page JSON for ngx-page-builder (EN/LTR + FA/RTL) from one structure."""
import json, sys

# ----------------------------------------------------------------------------- palette
PALETTE = {
    'ink':      ('color',    '#0b1020'),
    'muted':    ('color',    '#5b6475'),
    'line':     ('color',    '#e6e8f0'),
    'surface':  ('color',    '#f5f6fb'),
    'brand':    ('color',    '#5b5bf0'),
    'brand-dark': ('color',  '#4338ca'),
    'brand-2':  ('color',    '#8b5cf6'),
    'accent':   ('color',    '#22d3ee'),
    'grad':     ('gradient', 'linear-gradient(135deg, #5b5bf0 0%, #8b5cf6 60%, #c084fc 100%)'),
    'radius':   ('text',     '20px'),
    'shadow-card': ('text',  '0 18px 40px -16px rgba(20, 24, 60, 0.22)'),
}

def V(name):
    """var(--name, fallback): works even if the host ignores cssVariables."""
    return f'var(--{name},{PALETTE[name][1]})'


class Doc:
    def __init__(self, lang):
        self.lang = lang
        self.fa = lang == 'fa'
        self.ids = set()

    # -- language helpers
    def L(self, en, fa):
        if not self.fa:
            return en
        return fa.translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹'))

    def ls(self, v):            # letter-spacing breaks Arabic-script joining → never in FA
        return '' if self.fa else f'letter-spacing:{v};'

    def lh(self, en, fa):       # Persian needs taller lines
        return f'line-height:{fa if self.fa else en};'

    # -- node factory
    def n(self, tag, id, base='', bp=None, st=None, bps=None, a=None, t=None, k=None, cls=None, cc=None):
        assert id not in self.ids, f'duplicate id {id}'
        self.ids.add(id)
        kids = k or []
        item = {'id': id, 'tag': tag}
        item['canHaveChild'] = bool(kids) or tag in {'div', 'section', 'a', 'nav', 'header', 'footer', 'ul', 'ol', 'li',
                                                     'form', 'details', 'summary', 'select', 'main', 'article', 'label'} if cc is None else cc
        if t is not None:
            item['content'] = t
        if a:
            item['options'] = {'attributes': a}
        item['classList'] = [f'blk-{id}'] + (cls or [])
        css = {}
        if base:
            css['base'] = base
        if st:
            css['states'] = {s: v for s, v in st.items() if v}
        chunks = {}
        for key, v in (bp or {}).items():
            if v:
                chunks.setdefault(key, {})['base'] = v
        for (key, s), v in (bps or {}).items():
            if v:
                chunks.setdefault(key, {}).setdefault('states', {})[s] = v
        if chunks:
            order = ['xxl', 'lg', 'md', 'sm']
            css['breakpoints'] = {k2: chunks[k2] for k2 in order if k2 in chunks}
        if css:
            item['css'] = css
        item['children'] = kids
        return item


def build(lang):
    d = Doc(lang)
    n, L, ls, lh, fa = d.n, d.L, d.ls, d.lh, d.fa
    ARROW = '←' if fa else '→'

    # ------------------------------------------------------------------ icon helpers
    def svg(inner, size=24, extra=''):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
                f'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" {extra}>{inner}</svg>')

    ICON = {
        'layout':  '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>',
        'code':    '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
        'cart':    '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.5L21 7H6"/>',
        'sparkle': '<path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z"/>',
        'bolt':    '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
        'shield':  '<path d="M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
        'check':   '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        'mail':    '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5L12 13l8.5-5.5"/>',
        'phone':   '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
        'pin':     '<path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
        'plus':    '<path d="M12 5v14M5 12h14"/>',
        'menu':    '<path d="M4 7h16M4 12h16M4 17h16"/>',
        'bolt2':   '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    }
    TINTS = [('rgba(91,91,240,0.10)', V('brand')), ('rgba(139,92,246,0.12)', V('brand-2')), ('rgba(34,211,238,0.14)', '#0891b2')]

    # ------------------------------------------------------------------ layout helpers
    def container(id, kids, extra='', bp=None, tag='div'):
        bpx = {'xxl': 'max-width:1280px;', 'sm': 'padding:0 20px;'}
        for k2, v in (bp or {}).items():
            bpx[k2] = bpx.get(k2, '') + v
        return n(tag, id, f'max-width:1200px;margin:0 auto;padding:0 24px;width:100%;{extra}', bp=bpx, k=kids)

    def section(id, kids, bg='transparent', pad='96px 0', bp=None, extra='', tag='section'):
        b = {'md': 'padding:72px 0;', 'sm': 'padding:56px 0;'}
        for k2, v in (bp or {}).items():
            b[k2] = b.get(k2, '') + v
        return n(tag, id, f'background:{bg};padding:{pad};scroll-margin-top:72px;{extra}', bp=b, a={'id': id}, k=kids)

    def sec_head(p, eyebrow, title, sub, dark=False, align='center'):
        tc = '#ffffff' if dark else V('ink')
        sc = 'rgba(255,255,255,0.72)' if dark else V('muted')
        ec = V('accent') if dark else V('brand')
        return n('div', f'{p}-head', f'max-width:720px;margin:0 auto 56px;text-align:{align};', bp={'sm': 'margin-bottom:36px;'}, k=[
            n('span', f'{p}-eyebrow', f'display:inline-block;font-size:13px;font-weight:700;{ls("0.14em")}text-transform:uppercase;color:{ec};', t=eyebrow),
            n('h2', f'{p}-title', f'margin:14px 0 0;font-size:42px;font-weight:800;{ls("-0.025em")}{lh("1.15", "1.4")}color:{tc};',
              bp={'lg': 'font-size:38px;', 'md': 'font-size:34px;', 'sm': 'font-size:27px;'}, t=title),
            n('p', f'{p}-sub', f'margin:16px 0 0;font-size:18px;{lh("1.7", "1.95")}color:{sc};', bp={'sm': 'font-size:16px;'}, t=sub),
        ])

    def btn(id, text, href, kind='primary', extra='', bp=None):
        if kind == 'primary':
            b = (f'display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:15px 28px;border-radius:14px;'
                 f'background:{V("grad")};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;'
                 f'box-shadow:0 14px 28px -12px rgba(91,91,240,0.65);transition:transform .2s ease,box-shadow .2s ease;{extra}')
            st = {'hover': 'transform:translateY(-2px);box-shadow:0 20px 34px -12px rgba(91,91,240,0.8);',
                  'active': 'transform:translateY(0);', 'focus-visible': 'outline:3px solid rgba(91,91,240,0.35);outline-offset:3px;'}
        elif kind == 'secondary':
            b = (f'display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 26px;border-radius:14px;'
                 f'background:#ffffff;color:{V("ink")};border:1px solid {V("line")};font-size:16px;font-weight:600;text-decoration:none;'
                 f'transition:border-color .2s ease,color .2s ease,transform .2s ease;{extra}')
            st = {'hover': f'border-color:{V("brand")};color:{V("brand")};transform:translateY(-2px);',
                  'focus-visible': 'outline:3px solid rgba(91,91,240,0.35);outline-offset:3px;'}
        elif kind == 'light':
            b = (f'display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:15px 28px;border-radius:14px;'
                 f'background:#ffffff;color:{V("brand-dark")};font-size:16px;font-weight:700;text-decoration:none;'
                 f'transition:transform .2s ease,box-shadow .2s ease;{extra}')
            st = {'hover': 'transform:translateY(-2px);box-shadow:0 16px 30px -12px rgba(0,0,0,0.35);'}
        else:  # ghost
            b = (f'display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 26px;border-radius:14px;'
                 f'background:transparent;color:#ffffff;border:1px solid rgba(255,255,255,0.45);font-size:16px;font-weight:600;text-decoration:none;'
                 f'transition:background .2s ease,border-color .2s ease;{extra}')
            st = {'hover': 'background:rgba(255,255,255,0.12);border-color:#ffffff;'}
        return n('a', id, b, bp=bp, st=st, a={'href': href}, t=text)

    # ================================================================== 1. NAV
    nav_links = [(L('Services', 'خدمات'), '#services'), (L('Process', 'فرآیند کار'), '#process'), (L('Work', 'نمونه‌کارها'), '#work'),
                 (L('Pricing', 'تعرفه‌ها'), '#pricing'), (L('FAQ', 'سوالات متداول'), '#faq')]
    link_css = (f'font-size:15px;font-weight:500;color:{V("muted")};text-decoration:none;transition:color .2s ease;')
    nav_desktop = n('nav', 'nav-links', 'display:flex;align-items:center;gap:32px;', bp={'md': 'display:none;'}, a={'aria-label': L('Main', 'منوی اصلی')},
                    k=[n('a', f'nav-link-{i}', link_css, st={'hover': f'color:{V("brand")};'}, a={'href': h}, t=t) for i, (t, h) in enumerate(nav_links)])
    logo = lambda pid, color: n('a', pid, f'display:inline-flex;align-items:center;gap:10px;font-size:21px;font-weight:800;{ls("-0.02em")}color:{color};text-decoration:none;',
                               a={'href': '#top', 'aria-label': 'Lumora'}, k=[
        n('span', f'{pid}-mark', f'display:inline-grid;place-items:center;width:34px;height:34px;border-radius:11px;background:{V("grad")};color:#ffffff;font-size:18px;font-weight:800;box-shadow:0 8px 16px -8px rgba(91,91,240,0.8);', t='L'),
        n('span', f'{pid}-text', '', t=L('Lumora', 'لومورا')),
    ])
    mobile_panel = n('div', 'nav-mobile-panel',
                     f'position:absolute;top:100%;left:0;right:0;background:#ffffff;border-bottom:1px solid {V("line")};padding:12px 24px 24px;display:flex;flex-direction:column;gap:4px;box-shadow:0 24px 40px -24px rgba(20,24,60,0.3);',
                     bp={'sm': 'padding:12px 20px 20px;'},
                     k=[n('a', f'nav-m-link-{i}', f'padding:14px 4px;font-size:17px;font-weight:600;color:{V("ink")};text-decoration:none;border-bottom:1px solid {V("line")};',
                          a={'href': h}, t=t) for i, (t, h) in enumerate(nav_links)] +
                       [btn('nav-m-cta', L('Get a free quote', 'درخواست مشاوره رایگان'), '#contact', extra='margin-top:16px;')])
    nav_mobile = n('details', 'nav-mobile', 'display:none;', bp={'md': 'display:block;'}, k=[
        n('summary', 'nav-burger', f'list-style:none;cursor:pointer;display:grid;place-items:center;width:44px;height:44px;border-radius:12px;border:1px solid {V("line")};color:{V("ink")};background:#ffffff;',
          st={'hover': f'border-color:{V("brand")};color:{V("brand")};'}, a={'aria-label': L('Open menu', 'باز کردن منو')}, cls=['lp-summary'], t=svg(ICON['menu'], 22)),
        mobile_panel])
    nav_cta = btn('nav-cta', L('Get a quote', 'درخواست پروژه'), '#contact', extra='padding:11px 22px;font-size:15px;border-radius:12px;',
                  bp={'sm': 'display:none;'})
    header = n('header', 'nav', f'position:sticky;top:0;z-index:100;background:rgba(255,255,255,0.82);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid {V("line")};',
               k=[container('nav-inner', [logo('nav-logo', V('ink')), nav_desktop,
                                          n('div', 'nav-actions', 'display:flex;align-items:center;gap:12px;', k=[nav_cta, nav_mobile])],
                            'display:flex;align-items:center;justify-content:space-between;height:72px;gap:24px;',
                            bp={'md': 'height:64px;'})])

    # ================================================================== 2. HERO
    badge = n('div', 'hero-badge', f'display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:999px;background:rgba(91,91,240,0.08);border:1px solid rgba(91,91,240,0.2);color:{V("brand")};font-size:13.5px;font-weight:600;', k=[
        n('span', 'hero-badge-dot', f'width:8px;height:8px;border-radius:50%;background:{V("accent")};box-shadow:0 0 0 4px rgba(34,211,238,0.25);display:inline-block;'),
        n('span', 'hero-badge-text', '', t=L('Web design & development studio', 'استودیو طراحی و توسعه وب')),
    ])
    h1 = n('h1', 'hero-title', f'margin:22px 0 0;font-size:62px;font-weight:800;{ls("-0.035em")}{lh("1.06", "1.35")}color:{V("ink")};',
           bp={'xxl': 'font-size:68px;', 'lg': 'font-size:54px;', 'md': 'font-size:46px;', 'sm': 'font-size:34px;'}, cc=True, k=[
        n('span', 'hero-title-a', '', t=L('We design websites that ', 'ما وب‌سایت‌هایی طراحی می‌کنیم که ')),
        n('span', 'hero-title-b', f'background:{V("grad")};-webkit-background-clip:text;background-clip:text;color:transparent;', t=L('turn visitors into customers', 'بازدیدکننده را به مشتری تبدیل می‌کنند')),
    ])
    lead = n('p', 'hero-lead', f'margin:22px 0 0;max-width:540px;font-size:19px;{lh("1.7", "1.95")}color:{V("muted")};', bp={'md': 'max-width:620px;', 'sm': 'font-size:16.5px;margin-top:18px;'},
             t=L('Lumora is a design-led studio crafting fast, beautiful and conversion-focused websites for ambitious brands, from strategy to launch.',
                 'لومورا یک استودیوی طراحی‌محور است که برای برندهای جاه‌طلب، وب‌سایت‌های سریع، زیبا و فروش‌محور می‌سازد؛ از استراتژی تا راه‌اندازی.'))
    ctas = n('div', 'hero-ctas', 'display:flex;flex-wrap:wrap;gap:14px;margin-top:34px;', bp={'sm': 'flex-direction:column;margin-top:26px;'}, k=[
        btn('hero-cta-1', L(f'Start your project {ARROW}', f'شروع پروژه {ARROW}'), '#contact'),
        btn('hero-cta-2', L('View our work', 'مشاهده نمونه‌کارها'), '#work', 'secondary'),
    ])
    stat_items = [('120+', L('Projects delivered', 'پروژه تحویل‌شده')), ('8 yrs', L('Of experience', 'سال تجربه')), ('98%', L('Client satisfaction', 'رضایت مشتریان'))]
    stats = n('div', 'hero-stats', f'display:flex;flex-wrap:wrap;gap:40px;margin-top:46px;padding-top:28px;border-top:1px solid {V("line")};', bp={'sm': 'gap:20px 28px;margin-top:34px;'}, k=[
        n('div', f'hero-stat-{i}', '', k=[
            n('div', f'hero-stat-{i}-n', f'font-size:30px;font-weight:800;{ls("-0.02em")}color:{V("ink")};', bp={'sm': 'font-size:24px;'}, t=(L(num, num))),
            n('div', f'hero-stat-{i}-l', f'margin-top:2px;font-size:14px;color:{V("muted")};', t=lab)]) for i, (num, lab) in enumerate(stat_items)])
    hero_text = n('div', 'hero-text', 'min-width:0;', k=[badge, h1, lead, ctas, stats])

    dots = [n('span', f'hero-dot-{i}', f'width:11px;height:11px;border-radius:50%;background:{c};display:inline-block;') for i, c in enumerate(['#ff5f57', '#febc2e', '#28c840'])]
    browser_bar = n('div', 'hero-bar', f'display:flex;align-items:center;gap:8px;padding:14px 18px;background:{V("surface")};border-bottom:1px solid {V("line")};', k=dots + [
        n('span', 'hero-url', f'flex:1;margin-inline-start:12px;height:26px;border-radius:999px;background:#ffffff;border:1px solid {V("line")};display:flex;align-items:center;padding:0 14px;font-size:12px;color:{V("muted")};direction:ltr;', t='lumora.studio')])
    hero_img = n('img', 'hero-img', f'display:block;width:100%;aspect-ratio:4 / 3;object-fit:cover;background:{V("surface")};', a={'alt': L('Website preview', 'پیش‌نمایش وب‌سایت'), 'loading': 'eager'}, cls=['img'])
    frame = n('div', 'hero-frame', f'position:relative;border-radius:22px;overflow:hidden;background:#ffffff;border:1px solid {V("line")};box-shadow:0 40px 80px -30px rgba(20,24,60,0.35);', k=[browser_bar, hero_img])
    glow = n('div', 'hero-glow', 'position:absolute;inset:-6% -8% auto auto;width:70%;height:70%;border-radius:50%;background:radial-gradient(closest-side,rgba(139,92,246,0.35),transparent);filter:blur(30px);z-index:0;')
    chip1 = n('div', 'hero-chip-1', f'position:absolute;bottom:-20px;inset-inline-start:-22px;z-index:2;display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:16px;background:#ffffff;border:1px solid {V("line")};box-shadow:{V("shadow-card")};',
              bp={'md': 'inset-inline-start:12px;bottom:-18px;', 'sm': 'display:none;'}, cls=['lp-float'], k=[
        n('span', 'hero-chip-1-ico', 'display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:rgba(34,211,238,0.16);color:#0891b2;', t=svg(ICON['bolt'], 20)),
        n('div', 'hero-chip-1-t', '', k=[
            n('div', 'hero-chip-1-a', f'font-size:15px;font-weight:700;color:{V("ink")};', t=L('98 / 100', '۹۸ از ۱۰۰')),
            n('div', 'hero-chip-1-b', f'font-size:12px;color:{V("muted")};', t=L('PageSpeed score', 'امتیاز سرعت سایت'))])])
    chip2 = n('div', 'hero-chip-2', f'position:absolute;top:56px;inset-inline-end:-22px;z-index:2;padding:12px 18px;border-radius:16px;background:#ffffff;border:1px solid {V("line")};box-shadow:{V("shadow-card")};',
              bp={'md': 'inset-inline-end:12px;', 'sm': 'display:none;'}, cls=['lp-float'], k=[
        n('div', 'hero-chip-2-a', 'font-size:15px;font-weight:700;color:#f5a400;letter-spacing:0;', t='★★★★★'),
        n('div', 'hero-chip-2-b', f'margin-top:2px;font-size:12px;color:{V("muted")};', t=L('4.9 client rating', 'امتیاز ۴٫۹ از مشتریان'))])
    hero_visual = n('div', 'hero-visual', 'position:relative;min-width:0;', bp={'md': 'max-width:620px;margin:0 auto;width:100%;'}, k=[glow, n('div', 'hero-visual-in', 'position:relative;z-index:1;', k=[frame, chip1, chip2])])
    hero = section('top', [container('hero-inner', [hero_text, hero_visual],
                                     'display:grid;grid-template-columns:1.05fr 0.95fr;gap:64px;align-items:center;',
                                     bp={'lg': 'gap:40px;', 'md': 'grid-template-columns:minmax(0,1fr);gap:56px;'})],
                   bg=(f'radial-gradient(900px 480px at 90% -10%,rgba(139,92,246,0.16),transparent 60%),'
                       f'radial-gradient(800px 420px at 0% 10%,rgba(34,211,238,0.12),transparent 55%),#ffffff'),
                   pad='88px 0 96px', bp={'md': 'padding:56px 0 72px;', 'sm': 'padding:40px 0 56px;'}, extra='overflow:visible;')

    # ================================================================== 3. TRUST STRIP
    brands = ['Aperture', 'Nimbus', 'Kitebox', 'Orbitly', 'Vertex']
    trust = n('section', 'trust', f'padding:30px 0;border-top:1px solid {V("line")};border-bottom:1px solid {V("line")};background:#ffffff;', bp={'sm': 'padding:24px 0;'}, k=[
        container('trust-inner', [
            n('span', 'trust-label', f'font-size:13px;font-weight:600;{ls("0.12em")}text-transform:uppercase;color:{V("muted")};', bp={'md': 'width:100%;text-align:center;'}, t=L('Trusted by fast-growing teams', 'مورد اعتماد تیم‌های در حال رشد')),
            n('div', 'trust-logos', 'display:flex;align-items:center;gap:48px;flex-wrap:wrap;', bp={'md': 'justify-content:center;gap:20px 36px;width:100%;'}, k=[
                n('span', f'trust-logo-{i}', 'font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#a3abbd;', t=b) for i, b in enumerate(brands)])],
            'display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap;')])

    # ================================================================== 4. SERVICES
    services = [
        ('layout', L('UI/UX Design', 'طراحی رابط و تجربه کاربری'), L('Research-backed interfaces that feel effortless and guide visitors toward action.', 'رابط‌هایی مبتنی بر پژوهش که استفاده از آن‌ها روان است و بازدیدکننده را به سمت اقدام هدایت می‌کند.')),
        ('code', L('Website Development', 'توسعه وب‌سایت'), L('Clean, scalable code with a CMS you will actually enjoy using.', 'کدنویسی تمیز و مقیاس‌پذیر، همراه با پنل مدیریتی که کار با آن لذت‌بخش است.')),
        ('cart', L('E-commerce', 'فروشگاه آنلاین'), L('Online stores built to convert, with secure payments and smart catalogues.', 'فروشگاه‌هایی برای افزایش فروش، با پرداخت امن و مدیریت هوشمند محصولات.')),
        ('sparkle', L('Branding & Identity', 'برندینگ و هویت بصری'), L('Logos, colour systems and guidelines that make your brand unmistakable.', 'لوگو، پالت رنگی و راهنمای برند که شما را در بازار متمایز می‌کند.')),
        ('bolt', L('SEO & Performance', 'سئو و بهینه‌سازی سرعت'), L('Lightning-fast pages and technical SEO that win rankings and keep users.', 'صفحات فوق‌سریع و سئوی فنی که رتبه می‌آورد و کاربر را نگه می‌دارد.')),
        ('shield', L('Care & Support', 'پشتیبانی و نگهداری'), L('Hosting, security updates and ongoing improvements, so you can focus on business.', 'میزبانی، به‌روزرسانی امنیتی و بهبود مداوم؛ تا شما روی کسب‌وکارتان تمرکز کنید.')),
    ]
    cards = []
    for i, (ic, ti, de) in enumerate(services):
        bgc, fg = TINTS[i % 3]
        cards.append(n('div', f'svc-{i}', f'display:flex;flex-direction:column;padding:32px;border-radius:{V("radius")};background:#ffffff;border:1px solid {V("line")};transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease;',
                       bp={'sm': 'padding:24px;'}, st={'hover': f'transform:translateY(-6px);box-shadow:{V("shadow-card")};border-color:rgba(91,91,240,0.35);'}, k=[
            n('span', f'svc-{i}-ico', f'display:inline-grid;place-items:center;width:54px;height:54px;border-radius:15px;background:{bgc};color:{fg};', t=svg(ICON[ic], 26)),
            n('h3', f'svc-{i}-title', f'margin:22px 0 8px;font-size:20px;font-weight:700;{ls("-0.01em")}color:{V("ink")};', t=ti),
            n('p', f'svc-{i}-text', f'margin:0;font-size:15.5px;{lh("1.7", "1.95")}color:{V("muted")};', t=de),
            n('a', f'svc-{i}-link', f'margin-top:20px;display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:600;color:{V("brand")};text-decoration:none;', st={'hover': f'color:{V("brand-dark")};'},
              a={'href': '#contact'}, t=L(f'Learn more {ARROW}', f'اطلاعات بیشتر {ARROW}'))]))
    services_sec = section('services', [container('svc-inner', [
        sec_head('svc', L('What we do', 'خدمات ما'), L('Everything you need to launch and grow online', 'هرآنچه برای راه‌اندازی و رشد آنلاین لازم دارید'),
                 L('From the first sketch to the final deployment, one team takes care of the whole journey.', 'از اولین طرح تا انتشار نهایی، یک تیم کل مسیر را برای شما مدیریت می‌کند.')),
        n('div', 'svc-grid', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;', bp={'md': 'grid-template-columns:repeat(2,minmax(0,1fr));', 'sm': 'grid-template-columns:minmax(0,1fr);gap:16px;'}, k=cards)])])

    # ================================================================== 5. WHY US
    benefits = [
        (L('Conversion-focused design', 'طراحی فروش‌محور'), L('Every layout decision is tested against one goal: more enquiries and sales.', 'هر تصمیم طراحی با یک هدف سنجیده می‌شود: افزایش درخواست‌ها و فروش.')),
        (L('Blazing-fast performance', 'سرعت بسیار بالا'), L('Optimised code and assets deliver sub-second loads on every device.', 'کد و فایل‌های بهینه‌شده، بارگذاری در کمتر از یک ثانیه را روی همه دستگاه‌ها ممکن می‌کند.')),
        (L('Transparent process & pricing', 'فرآیند و قیمت شفاف'), L('Clear milestones, weekly demos and fixed quotes. No surprises.', 'مراحل مشخص، دموی هفتگی و قیمت ثابت؛ بدون هیچ سورپرایزی.')),
        (L('Support after launch', 'پشتیبانی پس از انتشار'), L('We stay with you after go-live with updates, monitoring and improvements.', 'بعد از انتشار هم کنار شما می‌مانیم؛ با به‌روزرسانی، پایش و بهبود مستمر.')),
    ]
    benefit_nodes = [n('div', f'why-b-{i}', 'display:flex;gap:16px;align-items:flex-start;', k=[
        n('span', f'why-b-{i}-ico', f'flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:{V("grad")};color:#ffffff;margin-top:2px;', t=svg(ICON['check'], 17)),
        n('div', f'why-b-{i}-body', 'min-width:0;', k=[
            n('h3', f'why-b-{i}-t', f'margin:0 0 4px;font-size:18px;font-weight:700;color:{V("ink")};', t=t),
            n('p', f'why-b-{i}-d', f'margin:0;font-size:15.5px;{lh("1.7", "1.9")}color:{V("muted")};', t=dsc)])]) for i, (t, dsc) in enumerate(benefits)]
    why_img = n('img', 'why-img', f'display:block;width:100%;aspect-ratio:5 / 4;object-fit:cover;border-radius:28px;background:{V("surface")};box-shadow:0 40px 70px -34px rgba(20,24,60,0.4);', a={'alt': L('Our team at work', 'تیم ما در حال کار'), 'loading': 'lazy'}, cls=['img'])
    why_badge = n('div', 'why-badge', f'position:absolute;bottom:24px;inset-inline-start:-18px;padding:16px 22px;border-radius:18px;background:#ffffff;box-shadow:{V("shadow-card")};border:1px solid {V("line")};',
                  bp={'md': 'inset-inline-start:16px;', 'sm': 'bottom:14px;padding:12px 16px;'}, cls=['lp-float'], k=[
        n('div', 'why-badge-n', f'font-size:32px;font-weight:800;{ls("-0.02em")}background:{V("grad")};-webkit-background-clip:text;background-clip:text;color:transparent;', bp={'sm': 'font-size:26px;'}, t=L('8+ years', '+۸ سال')),
        n('div', 'why-badge-l', f'font-size:13px;color:{V("muted")};', t=L('of crafting great websites', 'تجربه‌ی ساخت وب‌سایت حرفه‌ای'))])
    why_sec = section('why', [container('why-inner', [
        n('div', 'why-visual', 'position:relative;min-width:0;', bp={'md': 'order:2;max-width:560px;margin:0 auto;width:100%;'}, k=[why_img, why_badge]),
        n('div', 'why-text', 'min-width:0;', bp={'md': 'order:1;'}, k=[
            n('span', 'why-eyebrow', f'font-size:13px;font-weight:700;{ls("0.14em")}text-transform:uppercase;color:{V("brand")};', t=L('Why Lumora', 'چرا لومورا')),
            n('h2', 'why-title', f'margin:14px 0 18px;font-size:40px;font-weight:800;{ls("-0.025em")}{lh("1.15", "1.4")}color:{V("ink")};', bp={'lg': 'font-size:36px;', 'md': 'font-size:33px;', 'sm': 'font-size:27px;'},
              t=L('A partner who cares about your results', 'شریکی که به نتیجه‌ی کار شما اهمیت می‌دهد')),
            n('p', 'why-lead', f'margin:0 0 30px;font-size:17.5px;{lh("1.75", "2")}color:{V("muted")};', bp={'sm': 'font-size:16px;'},
              t=L('A beautiful website is only the beginning. We combine strategy, design and engineering to build digital products that grow with your business.',
                  'یک وب‌سایت زیبا فقط شروع کار است. ما استراتژی، طراحی و مهندسی را کنار هم می‌گذاریم تا محصولی دیجیتال بسازیم که همراه کسب‌وکار شما رشد کند.')),
            n('div', 'why-list', 'display:flex;flex-direction:column;gap:22px;', k=benefit_nodes)])],
        'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:72px;align-items:center;', bp={'lg': 'gap:48px;', 'md': 'grid-template-columns:minmax(0,1fr);gap:44px;'})], bg=V('surface'))

    # ================================================================== 6. PROCESS (dark)
    steps = [
        ('01', L('Discover', 'کشف و تحلیل'), L('We learn your goals, audience and competitors in a focused kick-off workshop.', 'در یک جلسه‌ی تخصصی، اهداف، مخاطبان و رقبای شما را می‌شناسیم.')),
        ('02', L('Design', 'طراحی'), L('Wireframes, visual design and a clickable prototype you can react to early.', 'وایرفریم، طراحی بصری و پروتوتایپ قابل‌کلیک؛ تا زود بازخورد بدهید.')),
        ('03', L('Build', 'توسعه'), L('Responsive, accessible development with a CMS and clean, documented code.', 'توسعه‌ی ریسپانسیو و در دسترس، همراه با پنل مدیریت و کد تمیز و مستند.')),
        ('04', L('Launch & grow', 'انتشار و رشد'), L('Testing, launch, analytics and continuous optimisation after go-live.', 'تست، انتشار، راه‌اندازی آنالیتیکس و بهینه‌سازی مداوم پس از انتشار.')),
    ]
    step_nodes = [n('div', f'proc-{i}', f'padding:30px;border-radius:{V("radius")};background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);transition:background .25s ease,transform .25s ease;',
                    bp={'sm': 'padding:24px;'}, st={'hover': 'background:rgba(255,255,255,0.08);transform:translateY(-4px);'}, k=[
        n('div', f'proc-{i}-n', f'font-size:15px;font-weight:700;{ls("0.1em")}color:{V("accent")};', t=num),
        n('h3', f'proc-{i}-t', 'margin:14px 0 10px;font-size:22px;font-weight:700;color:#ffffff;', t=t),
        n('p', f'proc-{i}-d', f'margin:0;font-size:15.5px;{lh("1.7", "1.95")}color:rgba(255,255,255,0.68);', t=dsc)]) for i, (num, t, dsc) in enumerate(steps)]
    process_sec = section('process', [container('proc-inner', [
        sec_head('proc', L('How we work', 'نحوه‌ی کار ما'), L('A simple process that keeps projects on track', 'فرآیندی ساده که پروژه را روی مسیر نگه می‌دارد'),
                 L('Four clear stages, regular check-ins and no guesswork, from kick-off to launch day.', 'چهار مرحله‌ی شفاف، گزارش‌های منظم و بدون ابهام؛ از شروع تا روز انتشار.'), dark=True),
        n('div', 'proc-grid', 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;', bp={'lg': 'gap:16px;', 'md': 'grid-template-columns:repeat(2,minmax(0,1fr));', 'sm': 'grid-template-columns:minmax(0,1fr);'}, k=step_nodes)])],
        bg=f'radial-gradient(800px 400px at 100% 0%,rgba(139,92,246,0.25),transparent 60%),{V("ink")}')

    # ================================================================== 7. WORK
    projects = [
        ('Nimbus Cloud', [L('SaaS', 'نرم‌افزار سازمانی'), L('Web design', 'طراحی وب')], L('Marketing website that doubled demo requests in three months.', 'وب‌سایت معرفی که درخواست دمو را در سه ماه دو برابر کرد.')),
        ('Kitebox', [L('E-commerce', 'فروشگاه آنلاین'), L('Development', 'توسعه')], L('A fast, mobile-first online store with a streamlined checkout.', 'فروشگاهی سریع و موبایل‌محور با فرآیند پرداخت ساده.')),
        ('Aperture', [L('Branding', 'برندینگ'), L('Portfolio', 'نمونه‌کار')], L('A bold identity and portfolio site for a photography studio.', 'هویت بصری جسورانه و سایت نمونه‌کار برای یک استودیوی عکاسی.')),
    ]
    proj_nodes = []
    for i, (name, tags, desc) in enumerate(projects):
        third = i == 2
        proj_nodes.append(n('article', f'work-{i}', f'display:flex;flex-direction:column;overflow:hidden;border-radius:{V("radius")};background:#ffffff;border:1px solid {V("line")};transition:transform .25s ease,box-shadow .25s ease;',
                            bp={'md': 'grid-column:1 / -1;' if third else ''}, st={'hover': f'transform:translateY(-6px);box-shadow:{V("shadow-card")};'}, cc=True, k=[
            n('img', f'work-{i}-img', f'display:block;width:100%;aspect-ratio:16 / 11;object-fit:cover;background:{V("surface")};', bp={'md': 'aspect-ratio:21 / 9;' if third else '', 'sm': 'aspect-ratio:16 / 11;'}, a={'alt': name, 'loading': 'lazy'}, cls=['img']),
            n('div', f'work-{i}-body', 'padding:24px 26px 28px;', bp={'sm': 'padding:20px;'}, k=[
                n('div', f'work-{i}-tags', 'display:flex;flex-wrap:wrap;gap:8px;', k=[n('span', f'work-{i}-tag-{j}', f'padding:4px 12px;border-radius:999px;background:{V("surface")};font-size:12px;font-weight:600;color:{V("muted")};', t=tg) for j, tg in enumerate(tags)]),
                n('h3', f'work-{i}-title', f'margin:14px 0 6px;font-size:21px;font-weight:700;color:{V("ink")};', t=name),
                n('p', f'work-{i}-desc', f'margin:0;font-size:15px;{lh("1.65", "1.9")}color:{V("muted")};', t=desc)])]))
    work_sec = section('work', [container('work-inner', [
        sec_head('work', L('Selected work', 'نمونه‌کارهای منتخب'), L('Websites our clients are proud of', 'وب‌سایت‌هایی که مشتریان ما به آن‌ها افتخار می‌کنند'),
                 L('A few recent projects that combine strategy, design and engineering.', 'چند پروژه‌ی اخیر که استراتژی، طراحی و مهندسی را کنار هم دارند.')),
        n('div', 'work-grid', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;', bp={'lg': 'gap:20px;', 'md': 'grid-template-columns:repeat(2,minmax(0,1fr));', 'sm': 'grid-template-columns:minmax(0,1fr);gap:18px;'}, k=proj_nodes),
        n('div', 'work-more', 'display:flex;justify-content:center;margin-top:44px;', bp={'sm': 'margin-top:32px;'}, k=[btn('work-more-btn', L(f'View all projects {ARROW}', f'مشاهده همه پروژه‌ها {ARROW}'), '#contact', 'secondary')])])])

    # ================================================================== 8. TESTIMONIALS
    quotes = [
        (L('Sara Mitchell', 'سارا محمدی'), L('Marketing Director, Nimbus', 'مدیر بازاریابی، نیمبوس'), 'SM', L('Our new site loads instantly and our demo requests doubled. The Lumora team felt like part of our own company.', 'سایت جدید ما فوق‌العاده سریع است و درخواست دمو دو برابر شد. تیم لومورا مثل بخشی از شرکت خودمان بود.')),
        (L('Daniel Reyes', 'دانیال رضایی'), L('Founder, Kitebox', 'بنیان‌گذار، کایت‌باکس'), 'DR', L('From design to checkout, every detail was thought through. Sales are up 64% since launch.', 'از طراحی تا پرداخت، همه‌چیز دقیق فکر شده بود. فروش ما از زمان انتشار ۶۴ درصد رشد کرده است.')),
        (L('Aisha Karim', 'عایشه کریمی'), L('CEO, Aperture', 'مدیرعامل، اپرچر'), 'AK', L('They understood our brand immediately and delivered a site that is beautiful, fast and easy to manage.', 'برند ما را سریع فهمیدند و سایتی تحویل دادند که زیبا، سریع و مدیریتش ساده است.')),
    ]
    q_nodes = [n('figure', f'tm-{i}', f'margin:0;display:flex;flex-direction:column;padding:32px;border-radius:{V("radius")};background:#ffffff;border:1px solid {V("line")};', bp={'sm': 'padding:24px;'}, cc=True, k=[
        n('div', f'tm-{i}-stars', 'font-size:17px;color:#f5a400;letter-spacing:2px;', t='★★★★★'),
        n('blockquote', f'tm-{i}-q', f'margin:16px 0 26px;font-size:16.5px;{lh("1.75", "2")}color:{V("ink")};', cc=False, t=q),
        n('figcaption', f'tm-{i}-who', 'margin-top:auto;display:flex;align-items:center;gap:14px;', cc=True, k=[
            n('span', f'tm-{i}-av', f'flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:{V("grad")};color:#ffffff;font-size:15px;font-weight:700;', t=ini),
            n('div', f'tm-{i}-meta', '', k=[
                n('div', f'tm-{i}-name', f'font-size:15px;font-weight:700;color:{V("ink")};', t=nm),
                n('div', f'tm-{i}-role', f'font-size:13px;color:{V("muted")};', t=role)])])]) for i, (nm, role, ini, q) in enumerate(quotes)]
    tm_sec = section('testimonials', [container('tm-inner', [
        sec_head('tm', L('Testimonials', 'نظر مشتریان'), L('Loved by teams who care about quality', 'مورد علاقه‌ی تیم‌هایی که کیفیت برایشان مهم است'),
                 L('Do not just take our word for it. Here is what clients say after launch.', 'فقط به حرف ما اکتفا نکنید؛ ببینید مشتریان بعد از انتشار چه می‌گویند.')),
        n('div', 'tm-grid', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;', bp={'md': 'grid-template-columns:minmax(0,1fr);max-width:640px;margin:0 auto;', 'sm': 'gap:16px;'}, k=q_nodes)])], bg=V('surface'))

    # ================================================================== 9. PRICING
    plans = [
        ('starter', L('Starter', 'پایه'), L('For small businesses getting online.', 'برای کسب‌وکارهای کوچک و شروع حضور آنلاین.'), L('$1,490', '۱۵ میلیون'), L('/ project', 'تومان / پروژه'), False,
         [L('Up to 5 pages', 'تا ۵ صفحه'), L('Responsive design', 'طراحی ریسپانسیو'), L('Basic SEO setup', 'سئوی پایه'), L('Contact form', 'فرم تماس'), L('2 revision rounds', '۲ مرحله بازبینی')], L('Choose Starter', 'انتخاب پلن پایه')),
        ('business', L('Business', 'حرفه‌ای'), L('For growing brands that need more.', 'برای برندهای در حال رشد با نیازهای بیشتر.'), L('$3,900', '۴۵ میلیون'), L('/ project', 'تومان / پروژه'), True,
         [L('Up to 12 pages', 'تا ۱۲ صفحه'), L('Custom UI/UX design', 'طراحی سفارشی رابط و تجربه کاربری'), L('CMS integration', 'اتصال به پنل مدیریت محتوا'), L('Advanced SEO & speed', 'سئو و بهینه‌سازی سرعت پیشرفته'), L('30 days of support', '۳۰ روز پشتیبانی')], L('Choose Business', 'انتخاب پلن حرفه‌ای')),
        ('enterprise', L('Enterprise', 'سازمانی'), L('For complex products and platforms.', 'برای محصولات و پلتفرم‌های پیچیده.'), L('Custom', 'توافقی'), '', False,
         [L('E-commerce or web app', 'فروشگاه یا اپلیکیشن وب'), L('Custom integrations', 'اتصال به سیستم‌های دلخواه'), L('Dedicated project manager', 'مدیر پروژه‌ی اختصاصی'), L('Priority support & SLA', 'پشتیبانی اولویت‌دار و SLA')], L('Talk to us', 'صحبت با ما')),
    ]
    plan_nodes = []
    for pid, name, desc, price, unit, pop, feats, cta in plans:
        card_base = (f'position:relative;display:flex;flex-direction:column;padding:38px 32px;border-radius:26px;background:#ffffff;'
                     + (f'border:2px solid {V("brand")};box-shadow:0 30px 60px -28px rgba(91,91,240,0.55);' if pop else f'border:1px solid {V("line")};'))
        feat_nodes = [n('li', f'price-{pid}-f{j}', f'display:flex;align-items:flex-start;gap:10px;font-size:15px;{lh("1.5", "1.8")}color:{V("ink")};', k=[
            n('span', f'price-{pid}-f{j}-ico', f'flex:none;margin-top:2px;color:{V("brand")};display:inline-flex;', t=svg(ICON['check'], 18)),
            n('span', f'price-{pid}-f{j}-t', '', t=f)]) for j, f in enumerate(feats)]
        kids = []
        if pop:
            kids.append(n('span', f'price-{pid}-badge', f'position:absolute;top:-15px;left:50%;transform:translateX(-50%);padding:6px 16px;border-radius:999px;background:{V("grad")};color:#ffffff;font-size:12.5px;font-weight:700;white-space:nowrap;', t=L('Most popular', 'پرطرفدارترین')))
        kids += [
            n('h3', f'price-{pid}-name', f'margin:0;font-size:20px;font-weight:700;color:{V("ink")};', t=name),
            n('p', f'price-{pid}-desc', f'margin:8px 0 0;font-size:14.5px;{lh("1.6", "1.85")}color:{V("muted")};', t=desc),
            n('div', f'price-{pid}-price', 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:24px 0 4px;', k=[
                n('span', f'price-{pid}-amount', f'font-size:42px;font-weight:800;{ls("-0.03em")}color:{V("ink")};', bp={'sm': 'font-size:36px;'}, t=price),
                n('span', f'price-{pid}-unit', f'font-size:14px;color:{V("muted")};', t=unit)] if unit else [
                n('span', f'price-{pid}-amount', f'font-size:42px;font-weight:800;{ls("-0.03em")}color:{V("ink")};', bp={'sm': 'font-size:36px;'}, t=price)]),
            n('ul', f'price-{pid}-list', 'list-style:none;margin:24px 0 30px;padding:0;display:flex;flex-direction:column;gap:13px;', k=feat_nodes),
            btn(f'price-{pid}-cta', cta, '#contact', 'primary' if pop else 'secondary', extra='margin-top:auto;width:100%;'),
        ]
        plan_nodes.append(n('div', f'price-{pid}', card_base, bp={'lg': 'padding:34px 24px;'}, k=kids))
    pricing_sec = section('pricing', [container('price-inner', [
        sec_head('price', L('Pricing', 'تعرفه‌ها'), L('Simple, transparent pricing', 'تعرفه‌های ساده و شفاف'),
                 L('Fixed-price packages for most projects. Need something different? We will tailor a quote.', 'پکیج‌های قیمت‌ثابت برای اغلب پروژه‌ها. نیاز دیگری دارید؟ پیشنهاد اختصاصی می‌دهیم.')),
        n('div', 'price-grid', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;align-items:stretch;', bp={'lg': 'gap:16px;', 'md': 'grid-template-columns:minmax(0,1fr);max-width:480px;margin:0 auto;gap:28px;'}, k=plan_nodes)])])

    # ================================================================== 10. FAQ
    faqs = [
        (L('How long does a typical website take?', 'ساخت یک وب‌سایت معمولاً چقدر طول می‌کشد؟'), L('Most business websites take 3 to 6 weeks from kick-off to launch, depending on scope and how quickly feedback arrives.', 'اغلب وب‌سایت‌های شرکتی بین ۳ تا ۶ هفته از شروع تا انتشار زمان می‌برند؛ بسته به حجم کار و سرعت بازخورد شما.')),
        (L('Do you provide hosting and maintenance?', 'آیا هاستینگ و نگهداری هم ارائه می‌دهید؟'), L('Yes. We can host your site on fast, secure infrastructure and handle updates, backups and monitoring on a monthly plan.', 'بله. می‌توانیم سایت شما را روی زیرساخت سریع و امن میزبانی کنیم و به‌روزرسانی، پشتیبان‌گیری و پایش را در قالب پلن ماهانه انجام دهیم.')),
        (L('Can you redesign my existing website?', 'آیا می‌توانید وب‌سایت فعلی من را بازطراحی کنید؟'), L('Absolutely. We audit your current site, keep what works, and rebuild what does not while protecting your SEO rankings.', 'حتماً. سایت فعلی را بررسی می‌کنیم، آنچه کار می‌کند را نگه می‌داریم و بقیه را بازسازی می‌کنیم؛ بدون آسیب به رتبه‌ی سئوی شما.')),
        (L('Will my website work well on mobile and rank on Google?', 'آیا سایت روی موبایل خوب کار می‌کند و در گوگل دیده می‌شود؟'), L('Every site we build is mobile-first, accessible and technically optimised for search engines from day one.', 'همه‌ی سایت‌های ما از ابتدا موبایل‌محور، قابل‌دسترس و از نظر فنی برای موتورهای جستجو بهینه هستند.')),
        (L('How does payment work?', 'روش پرداخت چگونه است؟'), L('We split projects into milestones, typically 40% to start, 30% at design approval and 30% on launch.', 'پروژه را به مراحل تقسیم می‌کنیم؛ معمولاً ۴۰٪ ابتدای کار، ۳۰٪ هنگام تایید طراحی و ۳۰٪ هنگام انتشار.')),
    ]
    faq_nodes = [n('details', f'faq-{i}', f'background:#ffffff;border:1px solid {V("line")};border-radius:18px;overflow:hidden;transition:border-color .2s ease,box-shadow .2s ease;', st={'hover': 'border-color:rgba(91,91,240,0.4);'}, cls=['lp-faq'], k=[
        n('summary', f'faq-{i}-q', f'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 26px;cursor:pointer;font-size:17px;font-weight:600;{lh("1.5", "1.8")}color:{V("ink")};', bp={'sm': 'padding:18px 18px;font-size:16px;'}, cls=['lp-summary'], k=[
            n('span', f'faq-{i}-qt', '', t=q),
            n('span', f'faq-{i}-ic', f'flex:none;display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:{V("surface")};color:{V("brand")};', cls=['lp-faq-icon'], t=svg(ICON['plus'], 16))]),
        n('p', f'faq-{i}-a', f'margin:0;padding:0 26px 24px;font-size:15.5px;{lh("1.75", "2")}color:{V("muted")};', bp={'sm': 'padding:0 18px 20px;'}, t=a)]) for i, (q, a) in enumerate(faqs)]
    faq_sec = section('faq', [container('faq-inner', [
        sec_head('faq', L('FAQ', 'سوالات متداول'), L('Questions, answered', 'پاسخ پرسش‌های شما'), L('Cannot find what you are looking for? Send us a message and we will reply within one working day.', 'پاسخ خود را پیدا نکردید؟ پیام بدهید؛ حداکثر ظرف یک روز کاری پاسخ می‌دهیم.')),
        n('div', 'faq-list', 'display:flex;flex-direction:column;gap:12px;max-width:820px;margin:0 auto;', k=faq_nodes)])], bg=V('surface'))

    # ================================================================== 11. CTA BAND
    cta_sec = n('section', 'cta', 'padding:96px 0;background:#ffffff;', bp={'md': 'padding:72px 0;', 'sm': 'padding:48px 0;'}, k=[container('cta-inner', [
        n('div', 'cta-card', f'position:relative;overflow:hidden;text-align:center;padding:76px 48px;border-radius:32px;background:radial-gradient(600px 300px at 90% 0%,rgba(34,211,238,0.35),transparent 60%),{V("grad")};',
          bp={'md': 'padding:56px 32px;', 'sm': 'padding:44px 22px;border-radius:24px;'}, k=[
            n('h2', 'cta-title', f'margin:0 auto;max-width:720px;font-size:42px;font-weight:800;{ls("-0.025em")}{lh("1.15", "1.4")}color:#ffffff;', bp={'md': 'font-size:34px;', 'sm': 'font-size:26px;'},
              t=L('Ready to build a website that works as hard as you do?', 'آماده‌اید وب‌سایتی بسازیم که به اندازه‌ی شما کار کند؟')),
            n('p', 'cta-sub', f'margin:18px auto 0;max-width:560px;font-size:18px;{lh("1.7", "1.95")}color:rgba(255,255,255,0.88);', bp={'sm': 'font-size:16px;'},
              t=L('Tell us about your project and get a free, no-obligation proposal within 48 hours.', 'درباره‌ی پروژه‌تان بگویید و ظرف ۴۸ ساعت یک پیشنهاد رایگان و بدون تعهد دریافت کنید.')),
            n('div', 'cta-actions', 'display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:34px;', bp={'sm': 'flex-direction:column;'}, k=[
                btn('cta-btn-1', L(f'Get a free proposal {ARROW}', f'دریافت پیشنهاد رایگان {ARROW}'), '#contact', 'light'),
                btn('cta-btn-2', L('See our work', 'مشاهده نمونه‌کارها'), '#work', 'ghost')])])])])

    # ================================================================== 12. CONTACT
    contact_items = [('mail', L('Email', 'ایمیل'), 'hello@lumora.studio', 'mailto:hello@lumora.studio'),
                     ('phone', L('Phone', 'تلفن'), L('+1 (555) 012-3456', '۰۲۱-۱۲۳۴۵۶۷۸'), 'tel:+15550123456'),
                     ('pin', L('Studio', 'آدرس استودیو'), L('12 Creative Street, Suite 4, Your City', 'تهران، خیابان نمونه، پلاک ۱۲'), '#contact')]
    info_nodes = [n('div', f'ct-i-{i}', 'display:flex;align-items:center;gap:16px;', k=[
        n('span', f'ct-i-{i}-ico', f'flex:none;display:grid;place-items:center;width:50px;height:50px;border-radius:15px;background:rgba(91,91,240,0.1);color:{V("brand")};', t=svg(ICON[ic], 22)),
        n('div', f'ct-i-{i}-t', 'min-width:0;', k=[
            n('div', f'ct-i-{i}-l', f'font-size:13px;color:{V("muted")};', t=lab),
            n('a', f'ct-i-{i}-v', f'font-size:16.5px;font-weight:600;color:{V("ink")};text-decoration:none;word-break:break-word;', st={'hover': f'color:{V("brand")};'}, a={'href': href}, t=val)])]) for i, (ic, lab, val, href) in enumerate(contact_items)]

    field_css = (f'width:100%;height:50px;padding:0 16px;border-radius:12px;border:1px solid {V("line")};background:#ffffff;font-size:15px;font-family:inherit;color:{V("ink")};')
    field_focus = f'border-color:{V("brand")};box-shadow:0 0 0 4px rgba(91,91,240,0.15);outline:none;'
    label_css = f'display:block;margin-bottom:8px;font-size:13.5px;font-weight:600;color:{V("ink")};'
    def field(fid, label, control):
        return n('div', f'f-{fid}', 'min-width:0;', k=[n('label', f'f-{fid}-label', label_css, a={'for': f'in-{fid}'}, t=label), control])
    f_name = field('name', L('Your name', 'نام شما'), n('input', 'f-name-input', field_css, st={'focus': field_focus}, a={'id': 'in-name', 'name': 'name', 'type': 'text', 'placeholder': L('Jane Doe', 'نام و نام خانوادگی'), 'autocomplete': 'name'}, cc=False))
    f_mail = field('email', L('Email address', 'ایمیل'), n('input', 'f-email-input', field_css, st={'focus': field_focus}, a={'id': 'in-email', 'name': 'email', 'type': 'email', 'placeholder': 'you@company.com', 'autocomplete': 'email'}, cc=False))
    opts = [L('New website', 'وب‌سایت جدید'), L('Website redesign', 'بازطراحی وب‌سایت'), L('E-commerce store', 'فروشگاه آنلاین'), L('Branding', 'برندینگ'), L('Something else', 'موارد دیگر')]
    f_type = field('type', L('What do you need?', 'به چه چیزی نیاز دارید؟'), n('select', 'f-type-select', field_css + 'appearance:auto;', st={'focus': field_focus}, a={'id': 'in-type', 'name': 'project-type'}, k=[
        n('option', f'f-type-o{i}', '', a={'value': o}, t=o, cc=False) for i, o in enumerate(opts)]))
    f_msg = field('msg', L('Project details', 'جزئیات پروژه'), n('textarea', 'f-msg-input', field_css.replace('height:50px;', 'height:140px;') + 'padding:14px 16px;resize:vertical;line-height:1.6;', st={'focus': field_focus},
                                                              a={'id': 'in-msg', 'name': 'message', 'rows': '5', 'placeholder': L('Tell us about your goals, timeline and budget…', 'از اهداف، زمان‌بندی و بودجه‌ی خود بنویسید…')}, t='', cc=False))
    submit = n('button', 'f-submit', f'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:54px;border:0;border-radius:14px;background:{V("grad")};color:#ffffff;font-size:16px;font-weight:700;font-family:inherit;cursor:pointer;box-shadow:0 14px 28px -12px rgba(91,91,240,0.65);transition:transform .2s ease,box-shadow .2s ease;',
               st={'hover': 'transform:translateY(-2px);box-shadow:0 20px 34px -12px rgba(91,91,240,0.8);', 'active': 'transform:translateY(0);', 'focus-visible': 'outline:3px solid rgba(91,91,240,0.35);outline-offset:3px;'},
               a={'type': 'submit'}, t=L(f'Send message {ARROW}', f'ارسال پیام {ARROW}'), cc=False)
    form = n('form', 'ct-form', f'padding:38px;border-radius:26px;background:#ffffff;border:1px solid {V("line")};box-shadow:0 30px 60px -34px rgba(20,24,60,0.35);display:grid;gap:20px;',
             bp={'sm': 'padding:24px 20px;border-radius:22px;gap:16px;'}, a={'action': '#', 'method': 'post'}, k=[
        n('div', 'f-row', 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;', bp={'sm': 'grid-template-columns:minmax(0,1fr);gap:16px;'}, k=[f_name, f_mail]),
        f_type, f_msg, submit,
        n('p', 'f-note', f'margin:0;text-align:center;font-size:13px;color:{V("muted")};', t=L('We reply within one working day. Your details stay private.', 'حداکثر ظرف یک روز کاری پاسخ می‌دهیم. اطلاعات شما محرمانه می‌ماند.'))])
    contact_sec = section('contact', [container('ct-inner', [
        n('div', 'ct-text', 'min-width:0;', k=[
            n('span', 'ct-eyebrow', f'font-size:13px;font-weight:700;{ls("0.14em")}text-transform:uppercase;color:{V("brand")};', t=L('Contact', 'تماس با ما')),
            n('h2', 'ct-title', f'margin:14px 0 16px;font-size:40px;font-weight:800;{ls("-0.025em")}{lh("1.15", "1.4")}color:{V("ink")};', bp={'lg': 'font-size:36px;', 'md': 'font-size:33px;', 'sm': 'font-size:27px;'}, t=L('Let us talk about your project', 'درباره‌ی پروژه‌ی شما صحبت کنیم')),
            n('p', 'ct-lead', f'margin:0 0 34px;font-size:17.5px;{lh("1.75", "2")}color:{V("muted")};max-width:460px;', bp={'sm': 'font-size:16px;'}, t=L('Share a few details and we will get back with ideas, a timeline and a clear quote.', 'چند توضیح کوتاه بدهید؛ با ایده، زمان‌بندی و قیمت شفاف برمی‌گردیم.')),
            n('div', 'ct-info', 'display:flex;flex-direction:column;gap:22px;', k=info_nodes)]),
        form], 'display:grid;grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr);gap:64px;align-items:start;', bp={'lg': 'gap:40px;', 'md': 'grid-template-columns:minmax(0,1fr);gap:44px;'})])

    # ================================================================== 13. FOOTER
    def fcol(pid, title, links):
        return n('div', pid, 'min-width:0;', k=[
            n('h4', f'{pid}-t', 'margin:0 0 18px;font-size:15px;font-weight:700;color:#ffffff;', t=title),
            n('ul', f'{pid}-list', 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;', k=[
                n('li', f'{pid}-li-{i}', '', k=[n('a', f'{pid}-a-{i}', 'font-size:15px;color:rgba(255,255,255,0.68);text-decoration:none;transition:color .2s ease;', st={'hover': 'color:#ffffff;'}, a={'href': h}, t=t)]) for i, (t, h) in enumerate(links)])])
    footer = n('footer', 'footer', f'background:{V("ink")};padding:72px 0 32px;', bp={'sm': 'padding:52px 0 28px;'}, k=[container('ft-inner', [
        n('div', 'ft-grid', 'display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:48px;', bp={'lg': 'gap:36px;', 'md': 'grid-template-columns:repeat(2,minmax(0,1fr));gap:40px 32px;', 'sm': 'grid-template-columns:minmax(0,1fr);'}, k=[
            n('div', 'ft-brand', 'min-width:0;', bp={'md': 'grid-column:1 / -1;', 'sm': 'grid-column:auto;'}, k=[
                logo('ft-logo', '#ffffff'),
                n('p', 'ft-about', f'margin:18px 0 0;max-width:340px;font-size:15px;{lh("1.75", "2")}color:rgba(255,255,255,0.62);', t=L('A design-led web studio building fast, beautiful websites that help ambitious brands grow.', 'استودیوی طراحی وب که برای رشد برندهای جاه‌طلب، وب‌سایت‌های سریع و زیبا می‌سازد.'))]),
            fcol('ft-c1', L('Services', 'خدمات'), [(L('UI/UX design', 'طراحی رابط کاربری'), '#services'), (L('Development', 'توسعه وب'), '#services'), (L('E-commerce', 'فروشگاه آنلاین'), '#services'), (L('SEO', 'سئو'), '#services')]),
            fcol('ft-c2', L('Company', 'شرکت'), [(L('Our work', 'نمونه‌کارها'), '#work'), (L('Process', 'فرآیند کار'), '#process'), (L('Pricing', 'تعرفه‌ها'), '#pricing'), (L('Contact', 'تماس'), '#contact')]),
            fcol('ft-c3', L('Follow', 'شبکه‌های اجتماعی'), [('Instagram', '#'), ('Dribbble', '#'), ('LinkedIn', '#')])]),
        n('div', 'ft-bottom', 'margin-top:56px;padding-top:26px;border-top:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;', bp={'sm': 'margin-top:40px;flex-direction:column;text-align:center;'}, k=[
            n('span', 'ft-copy', 'font-size:14px;color:rgba(255,255,255,0.55);', t=L('© 2026 Lumora Studio. All rights reserved.', '© ۲۰۲۶ استودیو لومورا. تمامی حقوق محفوظ است.')),
            n('div', 'ft-legal', 'display:flex;gap:22px;', k=[
                n('a', 'ft-privacy', 'font-size:14px;color:rgba(255,255,255,0.55);text-decoration:none;', st={'hover': 'color:#ffffff;'}, a={'href': '#'}, t=L('Privacy', 'حریم خصوصی')),
                n('a', 'ft-terms', 'font-size:14px;color:rgba(255,255,255,0.55);text-decoration:none;', st={'hover': 'color:#ffffff;'}, a={'href': '#'}, t=L('Terms', 'شرایط استفاده'))])])])])

    # ================================================================== ROOT
    font = ("Vazirmatn, Tahoma, 'Segoe UI', sans-serif" if fa else "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif")
    root = n('div', 'lp-root', f'font-family:{font};color:{V("ink")};background:#ffffff;{lh("1.6", "1.9")}overflow-x:clip;-webkit-font-smoothing:antialiased;',
             k=[header, n('main', 'lp-main', '', k=[hero, trust, services_sec, why_sec, process_sec, work_sec, tm_sec, pricing_sec, faq_sec, cta_sec, contact_sec]), footer])

    fonts_import = ("@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap');\n" if fa
                    else "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');\n")
    landing_css = fonts_import + '''html { scroll-behavior: smooth; }
@keyframes lp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
.lp-float { animation: lp-float 6s ease-in-out infinite; }
.lp-summary { list-style: none; }
.lp-summary::-webkit-details-marker { display: none; }
.lp-faq-icon { transition: transform .25s ease, background .25s ease; }
.lp-faq[open] .lp-faq-icon { transform: rotate(45deg); background: rgba(91, 91, 240, 0.14); }
.lp-faq[open] { border-color: rgba(91, 91, 240, 0.4); box-shadow: 0 18px 40px -22px rgba(20, 24, 60, 0.3); }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .lp-float { animation: none; } }
'''
    title = L('Lumora Studio — Web design & development agency', 'استودیو لومورا — طراحی و توسعه وب‌سایت')
    desc = L('Lumora builds fast, beautiful, conversion-focused websites for ambitious brands.', 'لومورا برای برندهای جاه‌طلب وب‌سایت‌های سریع، زیبا و فروش‌محور می‌سازد.')
    return {
        'config': {'title': title, 'description': desc, 'size': 'A4', 'orientation': 'Portrait', 'direction': 'rtl' if fa else 'ltr'},
        'data': [{'headerItems': [], 'bodyItems': [root], 'footerItems': [], 'config': {'title': title, 'description': desc}, 'order': 0}],
        'styles': [
            {'name': 'default', 'createdAt': '2026-10-05T08:02:31.199Z', 'updatedAt': '2026-10-05T08:02:31.328Z',
             'data': '* { box-sizing:border-box; }\n\nimg { max-width: 100%; }\n\npre { white-space: pre-wrap; font-family: inherit; }'},
            {'name': 'landing', 'createdAt': '2026-10-05T08:10:00.000Z', 'updatedAt': '2026-10-05T08:10:00.000Z', 'data': landing_css},
        ],
        'cssVariables': [{'type': t, 'name': name, 'value': val} for name, (t, val) in PALETTE.items()],
    }


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    for lang in ('en', 'fa'):
        doc = build(lang)
        path = f'{out}/landing-page.{lang}.json'
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        print('wrote', path)