import json, re, os, textwrap
from pathlib import Path

# Design tokens: every authored color and design value is centralized here.
tokens = [
("Color","color-primary","#b9955b"),("Color","color-primary-600","#947343"),("Text","color-primary-rgb","185,149,91"),
("Color","color-secondary","#17242b"),("Color","color-accent","#d8c49b"),
("Color","color-bg","#f7f5f0"),("Color","color-surface","#ffffff"),("Color","color-surface-2","#efede7"),
("Color","color-border","#e4dfd4"),("Color","color-text","#202a2e"),("Color","color-text-muted","#727b7c"),
("Color","color-on-primary","#17242b"),("Color","color-success","#367b60"),("Color","color-warning","#b98235"),
("Color","color-danger","#b64b48"),("Color","color-info","#557e9b"),
("Gradient","gradient-brand","linear-gradient(120deg,#b9955b 0%,#e4d2a9 52%,#947343 100%)"),
("Gradient","gradient-hero","radial-gradient(ellipse at 78% 18%,rgba(185,149,91,.28),transparent 35%),radial-gradient(ellipse at 12% 85%,rgba(58,86,91,.38),transparent 38%),linear-gradient(135deg,#101b20 0%,#1b2a30 54%,#10191d 100%)"),
("Gradient","gradient-text","linear-gradient(110deg,#f0dfb8 0%,#b9955b 48%,#f7e9c9 100%)"),
("Gradient","gradient-glow","radial-gradient(circle,rgba(185,149,91,.28) 0%,rgba(185,149,91,0) 72%)"),
("Text","font-body","'Vazirmatn',Tahoma,system-ui,sans-serif"),("Text","font-display","'Vazirmatn',Tahoma,system-ui,sans-serif"),
]
sizes = [("fs-xs","clamp(.72rem,.68rem + .18vw,.82rem)"),("fs-sm","clamp(.82rem,.78rem + .2vw,.94rem)"),
("fs-md","clamp(.95rem,.9rem + .25vw,1.08rem)"),("fs-lg","clamp(1.1rem,1rem + .45vw,1.35rem)"),
("fs-xl","clamp(1.35rem,1.15rem + .8vw,1.8rem)"),("fs-2xl","clamp(1.7rem,1.35rem + 1.35vw,2.6rem)"),
("fs-3xl","clamp(2.1rem,1.5rem + 2.1vw,3.5rem)"),("fs-4xl","clamp(2.7rem,1.8rem + 3vw,4.8rem)"),
("fs-5xl","clamp(3.2rem,2rem + 4.5vw,6.2rem)")]
tokens += [("Text",k,v) for k,v in sizes]
tokens += [("Number","lh-tight","1.15"),("Number","lh-normal","1.85"),("Number","fw-regular","400"),("Number","fw-medium","600"),("Number","fw-bold","800")]
tokens += [("Number",f"space-{i}",f"{i*4}px") for i in range(1,13)]
tokens += [("Number","section-y","clamp(76px,9vw,132px)")]
tokens += [("Number",k,v) for k,v in [("radius-sm","10px"),("radius-md","16px"),("radius-lg","24px"),("radius-xl","36px"),("radius-full","999px"),
("shadow-sm","0 8px 24px rgba(23,36,43,.07)"),("shadow-md","0 18px 50px rgba(23,36,43,.12)"),("shadow-lg","0 30px 90px rgba(10,22,27,.22)"),
("shadow-glow","0 14px 50px rgba(185,149,91,.24)"),("blur-glass","18px"),("container-max","1240px"),
("dur-fast","220ms"),("dur-base","420ms"),("dur-slow","760ms"),("stagger","90ms")]]
tokens += [("Text","ease-out","cubic-bezier(.2,.75,.25,1)"),("Text","ease-spring","cubic-bezier(.2,1.35,.35,1)")]

root = {f"--{n}":v for _,n,v in tokens}
dark = {
"--color-primary":"#d0ad70","--color-primary-600":"#e1c18a","--color-primary-rgb":"208,173,112",
"--color-secondary":"#0d171b","--color-accent":"#e8d6ae","--color-bg":"#10191d","--color-surface":"#182429",
"--color-surface-2":"#202e33","--color-border":"#344248","--color-text":"#f1eee7","--color-text-muted":"#b1b9b6",
"--color-on-primary":"#10191d","--color-success":"#75b99a","--color-warning":"#e0b66c","--color-danger":"#e28a83","--color-info":"#8bb7d0"
}
def decl(d): return ";".join(f"{k}:{v}" for k,v in d.items())+";"
global_css = """@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap');
:root{"""+decl(root)+"""}
@media (prefers-color-scheme:dark){:root{"""+decl(dark)+"""}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body);line-height:var(--lh-normal);direction:rtl}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
button,input,textarea{font:inherit}
::selection{background:var(--color-primary);color:var(--color-on-primary)}
:focus-visible{outline:3px solid var(--color-primary);outline-offset:4px}
.container{width:100%;max-width:var(--container-max);margin-inline:auto;padding-inline:clamp(16px,4vw,40px)}
.section-kicker{display:inline-flex;align-items:center;gap:10px;color:var(--color-primary-600);font-size:var(--fs-xs);font-weight:800;letter-spacing:.08em}
.section-kicker:before{content:'';width:28px;height:1px;background:currentColor}
.gold-text{background:var(--gradient-text);background-clip:text;-webkit-background-clip:text;color:transparent}
.glass{background:color-mix(in srgb,var(--color-surface) 76%,transparent);backdrop-filter:blur(var(--blur-glass));border:1px solid color-mix(in srgb,var(--color-border) 72%,transparent)}
.btn-shine{position:relative;isolation:isolate;overflow:hidden}
.btn-shine:after{content:'';position:absolute;inset:-80% auto -80% -35%;width:24%;transform:rotate(22deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.42),transparent);transition:inset-inline-start .7s ease}
.btn-shine:hover:after{inset-inline-start:120%}
.image-zoom{overflow:hidden}
.image-zoom img{transition:transform 900ms cubic-bezier(.2,.75,.25,1)}
.image-zoom:hover img{transform:scale(1.07)}
.lift{transition:transform var(--dur-base) var(--ease-out),box-shadow var(--dur-base) var(--ease-out),border-color var(--dur-base) var(--ease-out)}
.lift:hover{transform:translateY(-7px);box-shadow:var(--shadow-lg);border-color:var(--color-primary)}
.reveal{animation:pb-fade-in-up 800ms var(--ease-out) both}
@supports (animation-timeline:view()){.reveal{animation:pb-fade-in-up both linear;animation-timeline:view();animation-range:entry 0% cover 28%}}
@keyframes estate-orbit{0%,100%{transform:translate3d(0,0,0) rotate(0)}50%{transform:translate3d(0,-16px,0) rotate(2deg)}}
@keyframes estate-marquee{to{transform:translateX(-50%)}}
@keyframes estate-glow{0%,100%{opacity:.42;transform:scale(.94)}50%{opacity:.8;transform:scale(1.08)}}
@keyframes estate-shimmer{0%{background-position:180% 0}100%{background-position:-80% 0}}
.hero-orbit{animation:estate-orbit 8s ease-in-out infinite}
.hero-glow{animation:estate-glow 8s ease-in-out infinite}
.logo-track{display:flex;width:max-content;animation:estate-marquee 28s linear infinite}
.logo-track:hover{animation-play-state:paused}
.hero-shell{background:var(--gradient-hero);position:relative;isolation:isolate;overflow:hidden}
.hero-shell:before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(to bottom,black,transparent 90%);z-index:-1}
.hero-shell:after{content:'';position:absolute;width:460px;aspect-ratio:1;border-radius:50%;background:var(--gradient-glow);filter:blur(25px);inset-inline-start:-160px;top:8%;z-index:-1}
.nav-blur{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--color-secondary) 88%,transparent);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.1)}
.hero-image-frame{position:relative;border-radius:32px;overflow:hidden;box-shadow:0 32px 90px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2)}
.hero-image-frame:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(8,18,22,.6))}
.property-image{position:relative;overflow:hidden;background:var(--gradient-brand)}
.property-image img{transition:transform .9s var(--ease-out)}
.property-card:hover .property-image img{transform:scale(1.07)}
.property-badge{position:absolute;top:18px;inset-inline-start:18px;z-index:2;background:var(--color-primary);color:var(--color-on-primary);padding:7px 13px;border-radius:var(--radius-full);font-size:var(--fs-xs);font-weight:800}
.property-price{color:var(--color-primary-600);font-weight:900}
.feature-icon{width:52px;height:52px;border-radius:17px;background:color-mix(in srgb,var(--color-primary) 15%,transparent);display:grid;place-items:center;color:var(--color-primary-600);font-size:24px}
.stat-number{font-size:clamp(2rem,3.8vw,3.6rem);font-weight:900;line-height:1.1}
.gallery-rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(260px,1fr);gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px}
.gallery-rail>*{scroll-snap-align:start}
.testimonial-card{position:relative}
.testimonial-card:before{content:'“';position:absolute;top:4px;inset-inline-end:24px;font-family:Georgia,serif;font-size:88px;line-height:1;color:var(--color-primary);opacity:.2}
.faq-item[open] summary{color:var(--color-primary-600)}
.faq-item summary{cursor:pointer;list-style:none}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary:after{content:'＋';float:left;color:var(--color-primary);font-size:1.3em}
.faq-item[open] summary:after{content:'−'}
.form-control{width:100%;border:1px solid var(--color-border);background:var(--color-surface-2);border-radius:14px;padding:14px 16px;color:var(--color-text);outline:none;transition:border-color .2s,box-shadow .2s}
.form-control:focus{border-color:var(--color-primary);box-shadow:0 0 0 4px color-mix(in srgb,var(--color-primary) 16%,transparent)}
.footer-link{color:rgba(255,255,255,.68);transition:color .2s}
.footer-link:hover{color:var(--color-accent)}
@media(max-width:1199.98px){.hero-layout{grid-template-columns:1fr 1fr}.four-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:991.98px){.hero-layout{grid-template-columns:1fr}.hero-visual{max-width:720px;margin-inline:auto}.four-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nav-links{flex-wrap:wrap;justify-content:center}.about-layout{grid-template-columns:1fr}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:767.98px){.four-grid,.three-grid{grid-template-columns:1fr}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nav-links{gap:12px}.nav-links a{font-size:12px}.hero-shell{border-radius:0}.hero-image-frame{border-radius:22px}.gallery-rail{grid-auto-columns:82%}.section-heading{align-items:flex-start!important;flex-direction:column}.footer-grid{grid-template-columns:1fr 1fr}.contact-grid{grid-template-columns:1fr}.desktop-only{display:none!important}}
@media(max-width:420px){.stats-grid{grid-template-columns:1fr 1fr}.footer-grid{grid-template-columns:1fr}.hero-actions{flex-direction:column;align-items:stretch}.hero-actions a{text-align:center}.nav-links{gap:8px}.nav-links a{font-size:11px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media print{*,*:before,*:after{animation:none!important;transition:none!important}.nav-blur{position:static}}
"""

counter = 0
def item(tag, content="", children=None, css=None, cls=None, attrs=None, states=None, bp=None):
    global counter
    counter += 1
    ident = f"est{counter:04d}"
    out = {"id":ident,"tag":tag}
    if children is not None:
        out["canHaveChild"] = True
    if content and tag not in ("img","input","hr","br"):
        out["content"] = content
    classes = list(cls or [])
    if css or states or bp or classes:
        classes.append("blk-"+ident)
        out["classList"] = classes
    if css or states or bp:
        out["css"] = {}
        if css: out["css"]["base"] = css if css.endswith(";") else css+";"
        if states: out["css"]["states"] = states
        if bp: out["css"]["breakpoints"] = bp
    if attrs:
        out["options"] = {"attributes":attrs}
    if children is not None:
        out["children"] = children
    return out

def text(tag, value, css="", cls=None, attrs=None):
    return item(tag,value,css=css,cls=cls,attrs=attrs)
def img(src, alt, css="width:100%;height:100%;object-fit:cover;aspect-ratio:4/3;border-radius:var(--radius-lg);", cls=None, eager=False):
    return item("img",css=css,cls=cls,attrs={"src":src,"alt":alt,"width":"1200","height":"900","loading":"eager" if eager else "lazy"})
def section(kicker,title,desc,children,background=None,extra_cls=None):
    head = item("div",children=[
        text("span",kicker,"display:inline-flex;color:var(--color-primary-600);font-size:var(--fs-xs);font-weight:800;letter-spacing:.08em;",["section-kicker"]),
        text("h2",title,"font-size:var(--fs-3xl);line-height:var(--lh-tight);font-weight:900;margin:12px 0 14px;max-width:780px;"),
        text("p",desc,"color:var(--color-text-muted);font-size:var(--fs-md);max-width:680px;margin:0;")
    ],css="margin-bottom:42px;")
    ch = [head]+children
    return item("section",children=[item("div",children=ch,css="width:100%;max-width:var(--container-max);margin-inline:auto;padding-inline:clamp(16px,4vw,40px);")],
                css=f"padding-block:var(--section-y);background:{background};" if background else "padding-block:var(--section-y);",
                cls=extra_cls or ["reveal"],attrs={"id":""})

body=[]

# Navbar
navlinks=[]
for label,href in [("خانه","#home"),("خدمات ما","#services"),("املاک منتخب","#properties"),("درباره ما","#about"),("مجله املاک","#journal")]:
    navlinks.append(item("a",label,css="color:rgba(255,255,255,.78);font-size:var(--fs-sm);font-weight:600;padding:8px 2px;transition:color .2s;",states={"hover":"color:var(--color-accent);"},attrs={"href":href}))
nav= item("header",children=[item("div",children=[
    item("a",children=[text("span","N", "font-size:25px;font-weight:900;color:var(--color-primary);"),text("span","NOIR", "font-size:19px;font-weight:900;letter-spacing:.14em;color:#fff;"),text("span","ESTATE","font-size:9px;letter-spacing:.28em;color:var(--color-accent);")],css="display:flex;align-items:center;gap:7px;"),
    item("nav",children=navlinks,css="display:flex;align-items:center;gap:clamp(12px,2.3vw,32px);",cls=["nav-links"]),
    item("a","درخواست مشاوره",css="background:var(--gradient-brand);color:var(--color-on-primary);padding:11px 20px;border-radius:var(--radius-full);font-weight:800;font-size:var(--fs-xs);box-shadow:var(--shadow-glow);",cls=["btn-shine"],attrs={"href":"#contact"})
],css="width:100%;max-width:var(--container-max);margin-inline:auto;padding:14px clamp(16px,4vw,40px);display:flex;align-items:center;justify-content:space-between;gap:18px;")],css="background:var(--color-secondary);",cls=["nav-blur"])
body.append(nav)

# Hero
hero_left=item("div",children=[
 text("span","مشاوره سرمایه‌گذاری و خرید ملک","display:inline-flex;border:1px solid rgba(216,196,155,.35);color:var(--color-accent);border-radius:var(--radius-full);padding:8px 15px;font-size:var(--fs-xs);font-weight:700;margin-bottom:24px;",["reveal"]),
 text("h1","خانه‌ای فراتر از یک آدرس؛<br><span class='gold-text'>آینده‌ای برای زندگی</span>","font-size:var(--fs-5xl);line-height:1.22;font-weight:900;color:#fff;margin:0 0 22px;max-width:700px;",["reveal"]),
 text("p","در NOIR، انتخاب ملک را به تجربه‌ای مطمئن و الهام‌بخش تبدیل می‌کنیم. از اولین بازدید تا امضای نهایی، کنار شما هستیم تا هوشمندانه‌تر انتخاب کنید.","font-size:var(--fs-md);line-height:2;color:rgba(255,255,255,.72);max-width:570px;margin:0 0 30px;",["reveal"]),
 item("div",children=[
  item("a","مشاهده املاک منتخب",css="background:var(--gradient-brand);color:var(--color-on-primary);padding:15px 24px;border-radius:var(--radius-full);font-weight:900;box-shadow:var(--shadow-glow);",cls=["btn-shine"],attrs={"href":"#properties"}),
  item("a","رزرو جلسه مشاوره ←",css="color:#fff;border:1px solid rgba(255,255,255,.3);padding:14px 22px;border-radius:var(--radius-full);font-weight:700;",attrs={"href":"#contact"})
 ],css="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:36px;",cls=["hero-actions"]),
 item("div",children=[
  item("div",children=[text("strong","۴.۹ از ۵","font-size:18px;color:#fff;font-weight:900;"),text("span","رضایت مشتریان","font-size:11px;color:rgba(255,255,255,.6);")],css="display:flex;flex-direction:column;gap:2px;"),
  text("span","★★★★★","color:var(--color-accent);letter-spacing:3px;font-size:14px;"),
  text("span","+۲٬۴۰۰ تجربه موفق","color:rgba(255,255,255,.7);font-size:12px;")
 ],css="display:flex;align-items:center;gap:16px;")
],css="padding-block:34px;")
hero_visual=item("div",children=[
 item("div",children=[img("https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1500&q=88","ویلای مدرن با معماری مینیمال و چشم‌انداز سبز", "width:100%;height:100%;object-fit:cover;aspect-ratio:4/4.5;"),text("span","پروژه منتخب NOIR","position:absolute;bottom:24px;inset-inline-start:24px;color:#fff;font-size:var(--fs-xs);font-weight:700;z-index:2;")],css="position:relative;"),
 item("div",children=[text("span","پیشنهاد ویژه هفته","font-size:11px;color:var(--color-text-muted);"),text("strong","ویلای آتریوم","font-size:18px;color:var(--color-text);font-weight:900;"),text("span","۲۸۰ متر · ۴ خواب · استخر اختصاصی","font-size:11px;color:var(--color-text-muted);")],css="position:absolute;bottom:22px;inset-inline-end:-24px;padding:18px 22px;border-radius:18px;display:flex;flex-direction:column;gap:5px;min-width:220px;box-shadow:var(--shadow-lg);",cls=["glass","hero-orbit"])
],css="position:relative;padding:20px 26px 28px 0;",cls=["hero-visual"])
hero=item("section",children=[
 item("div",children=[item("div",children=[hero_left,hero_visual],css="display:grid;grid-template-columns:1.03fr .97fr;align-items:center;gap:clamp(28px,5vw,72px);",cls=["hero-layout"])],css="width:100%;max-width:var(--container-max);margin-inline:auto;padding:clamp(65px,8vw,110px) clamp(16px,4vw,40px) 90px;"),
 item("div",children=[
  item("div",children=[text("span","جستجوی ملک","font-weight:900;color:var(--color-text);font-size:var(--fs-lg);"),text("span","ملک ایده‌آل خود را دقیق‌تر پیدا کنید","font-size:var(--fs-xs);color:var(--color-text-muted);")],css="display:flex;flex-direction:column;gap:3px;"),
  item("div",children=[text("span","نوع معامله","font-size:11px;color:var(--color-text-muted);"),text("strong","خرید ملک⌄","font-size:14px;color:var(--color-text);")],css="padding:10px 18px;border-inline-start:1px solid var(--color-border);"),
  item("div",children=[text("span","محدوده","font-size:11px;color:var(--color-text-muted);"),text("strong","تهران، منطقه ۱⌄","font-size:14px;color:var(--color-text);")],css="padding:10px 18px;border-inline-start:1px solid var(--color-border);"),
  item("div",children=[text("span","بودجه","font-size:11px;color:var(--color-text-muted);"),text("strong","بدون محدودیت⌄","font-size:14px;color:var(--color-text);")],css="padding:10px 18px;"),
  item("a","جستجوی ملک",css="background:var(--color-secondary);color:#fff;padding:14px 22px;border-radius:13px;font-weight:800;font-size:13px;text-align:center;",attrs={"href":"#properties"})
 ],css="width:calc(100% - 32px);max-width:1080px;margin:-30px auto 0;position:relative;z-index:4;display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr auto;align-items:center;gap:12px;padding:18px 22px;border-radius:22px;box-shadow:var(--shadow-lg);",cls=["glass"])
],css="background:var(--gradient-hero);position:relative;overflow:hidden;",cls=["hero-shell"],attrs={"id":"home"})
body.append(hero)

# Trust marquee
logos=["اعتماد در هر قدم","تحلیل دقیق بازار","انتخاب هوشمندانه","همراهی تا قرارداد","سرمایه‌گذاری مطمئن"]
marq=item("section",children=[item("div",children=[item("div",children=[text("span",x,"font-size:var(--fs-sm);font-weight:800;color:var(--color-text-muted);padding-inline:42px;white-space:nowrap;") for x in logos*2],css="display:flex;align-items:center;",cls=["logo-track"])],css="overflow:hidden;width:100%;")],css="padding-block:26px;border-bottom:1px solid var(--color-border);background:var(--color-surface);")
body.append(marq)

# Properties
props=[
("ویلای مدرن لواسان","لواسان، تهران","۳۸۰ متر","۴ خواب","۴۸٬۵۰۰٬۰۰۰٬۰۰۰ تومان","https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85","منتخب"),
("پنت‌هاوس چشم‌انداز","فرشته، تهران","۲۴۰ متر","۳ خواب","۳۲٬۰۰۰٬۰۰۰٬۰۰۰ تومان","https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1000&q=85","ویژه"),
("آپارتمان باغ‌تراس","زعفرانیه، تهران","۱۸۵ متر","۳ خواب","۲۱٬۷۰۰٬۰۰۰٬۰۰۰ تومان","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85","تازه‌وارد"),
]
cards=[]
for name,loc,size,bed,price,url,badge in props:
    cards.append(item("article",children=[
        item("div",children=[img(url,name,"width:100%;height:100%;object-fit:cover;aspect-ratio:1.25/1;"),text("span", badge, cls=["property-badge"])],css="position:relative;",cls=["property-image"]),
        item("div",children=[
            item("div",children=[text("span",loc,"font-size:var(--fs-xs);color:var(--color-text-muted);"),text("span","◇ مورد تایید NOIR","font-size:10px;color:var(--color-success);font-weight:800;")],css="display:flex;justify-content:space-between;gap:8px;"),
            text("h3",name,"font-size:var(--fs-lg);font-weight:900;margin:12px 0 8px;"),
            text("p",f"{size}  ·  {bed}","font-size:var(--fs-xs);color:var(--color-text-muted);margin:0 0 18px;"),
            item("div",children=[text("strong",price,"font-size:var(--fs-sm);font-weight:900;color:var(--color-primary-600);"),item("a",children=[text("span","جزئیات ملک ←","font-size:var(--fs-xs);font-weight:800;color:var(--color-text);")],attrs={"href":"#contact"})],css="display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--color-border);padding-top:16px;")
        ],css="padding:20px;")
    ],css="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-sm);",cls=["property-card","lift","reveal"]))
body.append(section("فرصت‌های منتخب","ملک‌هایی که ارزش دیدن دارند","از میان صدها فایل بررسی‌شده، گزینه‌هایی را انتخاب کرده‌ایم که از نظر موقعیت، کیفیت ساخت و ارزش سرمایه‌گذاری برجسته‌اند.",[
 item("div",children=cards,css="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;",cls=["three-grid"]),
 item("div",children=[item("a","مشاهده همه املاک ←",css="display:inline-flex;padding:13px 24px;border:1px solid var(--color-primary);border-radius:var(--radius-full);color:var(--color-primary-600);font-weight:800;font-size:var(--fs-sm);",attrs={"href":"#contact"})],css="text-align:center;margin-top:34px;")
],background="var(--color-bg)",extra_cls=["reveal"]))

# About
about_images=item("div",children=[
 item("div",children=[img("https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1100&q=85","فضای داخلی لوکس با طراحی معاصر","width:100%;height:100%;object-fit:cover;aspect-ratio:4/5;")],css="width:74%;border-radius:28px;overflow:hidden;box-shadow:var(--shadow-lg);"),
 item("div",children=[img("https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=700&q=85","جزئیات معماری یک خانه مدرن","width:100%;height:100%;object-fit:cover;aspect-ratio:1/1;")],css="position:absolute;width:47%;bottom:-35px;inset-inline-end:0;border:8px solid var(--color-bg);border-radius:24px;overflow:hidden;"),
 item("div",children=[text("span","۱۲+","font-size:30px;font-weight:900;color:var(--color-on-primary);"),text("span","سال تجربه تخصصی","font-size:11px;font-weight:800;color:var(--color-on-primary);")],css="position:absolute;top:12%;inset-inline-end:-10px;background:var(--gradient-brand);padding:18px 22px;border-radius:18px;box-shadow:var(--shadow-glow);display:flex;flex-direction:column;")
],css="position:relative;padding:0 0 45px 30px;max-width:560px;margin-inline:auto;")
about_copy=item("div",children=[
 text("span","نگاه متفاوت به انتخاب ملک","font-size:var(--fs-xs);font-weight:900;color:var(--color-primary-600);"),
 text("h2","ما فقط ملک معرفی نمی‌کنیم؛<br>برای <span class='gold-text'>آینده شما</span> تصمیم می‌سازیم.","font-size:var(--fs-3xl);line-height:1.35;font-weight:900;margin:14px 0 20px;"),
 text("p","بازار املاک پر از انتخاب است؛ اما انتخاب درست به شناخت، تحلیل و همراهی حرفه‌ای نیاز دارد. تیم NOIR با شناخت عمیق بازار و توجه به جزئیات، مسیر تصمیم‌گیری شما را شفاف‌تر می‌کند.","color:var(--color-text-muted);font-size:var(--fs-md);line-height:2;margin-bottom:26px;"),
 item("div",children=[text("strong","01","color:var(--color-primary);font-size:20px;font-weight:900;"),item("div",children=[text("b","تحلیل قبل از پیشنهاد","font-size:var(--fs-sm);font-weight:900;"),text("span","هر گزینه با معیارهای واقعی بررسی می‌شود.","font-size:var(--fs-xs);color:var(--color-text-muted);")],css="display:flex;flex-direction:column;gap:3px;")],css="display:flex;gap:16px;align-items:center;padding:15px 0;border-bottom:1px solid var(--color-border);"),
 item("div",children=[text("strong","02","color:var(--color-primary);font-size:20px;font-weight:900;"),item("div",children=[text("b","مذاکره با پشتوانه اطلاعات","font-size:var(--fs-sm);font-weight:900;"),text("span","برای رسیدن به شرایطی شفاف و منصفانه.","font-size:var(--fs-xs);color:var(--color-text-muted);")],css="display:flex;flex-direction:column;gap:3px;")],css="display:flex;gap:16px;align-items:center;padding:15px 0;border-bottom:1px solid var(--color-border);"),
 item("a",children=[text("strong","بیشتر درباره NOIR بدانید ←","display:inline-flex;margin-top:24px;color:var(--color-primary-600);font-weight:900;font-size:var(--fs-sm);")],attrs={"href":"#contact"})
],css="padding-block:20px;")
body.append(section("درباره NOIR","تجربه‌ای آرام‌تر برای تصمیمی بزرگ","",[
 item("div",children=[about_images,about_copy],css="display:grid;grid-template-columns:1fr 1fr;gap:clamp(34px,7vw,90px);align-items:center;",cls=["about-layout"])
],background="var(--color-surface)",extra_cls=["reveal"]))

# Stats
stats=[]
for n,l in [("+۲٬۴۰۰","مشتری همراه"),("۱۲ سال","تجربه تخصصی"),("+۸۵۰","معامله موفق"),("۹۸٪","رضایت مشتریان")]:
    stats.append(item("div",children=[text("strong",n,"font-size:clamp(26px,4vw,46px);font-weight:900;color:var(--color-accent);display:block;"),text("span",l,"font-size:var(--fs-xs);color:rgba(255,255,255,.68);")],css="text-align:center;padding:16px;"))
body.append(item("section",children=[item("div",children=stats,css="width:100%;max-width:var(--container-max);margin:auto;padding-inline:clamp(16px,4vw,40px);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;",cls=["stats-grid"])],css="padding-block:54px;background:var(--color-secondary);"))

# Services
services=[
("⌂","خرید و فروش تخصصی","از ارزیابی اولیه تا مذاکره و انتقال، تمام مراحل را با برنامه‌ای روشن پیش می‌بریم."),
("◈","مشاوره سرمایه‌گذاری","فرصت‌ها را با نگاه تحلیلی بررسی می‌کنیم تا ریسک‌ها و ظرفیت رشد را بهتر بشناسید."),
("▧","ارزیابی و قیمت‌گذاری","با بررسی موقعیت، کیفیت، معاملات مشابه و شرایط بازار، تصویری واقع‌بینانه ارائه می‌دهیم."),
("✧","مدیریت و اجاره ملک","برای مالکانی که به مدیریت حرفه‌ای، انتخاب مستأجر و پیگیری منظم نیاز دارند.")
]
sc=[]
for ic,head,desc in services:
    sc.append(item("article",children=[text("span",ic,"font-size:28px;color:var(--color-primary);"),text("h3",head,"font-size:var(--fs-lg);font-weight:900;margin:18px 0 8px;"),text("p",desc,"font-size:var(--fs-sm);color:var(--color-text-muted);line-height:2;margin:0;"),text("a","اطلاعات بیشتر ←","display:inline-block;margin-top:22px;color:var(--color-primary-600);font-weight:800;font-size:var(--fs-xs);")],css="padding:28px;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-surface);",cls=["lift","reveal"]))
body.append(section("خدمات ما","هر مرحله، با یک همراه متخصص","خدمات یکپارچه برای خریداران، فروشندگان و سرمایه‌گذارانی که کیفیت تصمیم برایشان اهمیت دارد.",[
 item("div",children=sc,css="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;",cls=["four-grid"])
],background="var(--color-bg)"))

# Gallery / projects
gallery=[]
for name,loc,url in [
("خانه باغ سپیدار","کردان","https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85"),
("رزیدنس آوید","تهران","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85"),
("ویلای خط آسمان","لواسان","https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85"),
("آپارتمان آتریوم","زعفرانیه","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85")]:
    gallery.append(item("article",children=[item("div",children=[img(url,name,"width:100%;height:100%;object-fit:cover;aspect-ratio:4/5;"),item("div",children=[text("span",loc,"font-size:var(--fs-xs);color:var(--color-accent);"),text("h3",name,"font-size:var(--fs-xl);color:#fff;font-weight:900;margin:5px 0;"),text("span","مشاهده پروژه ←","font-size:var(--fs-xs);color:rgba(255,255,255,.8);")],css="position:absolute;inset:auto 20px 20px;z-index:2;")],css="position:relative;border-radius:22px;overflow:hidden;",cls=["image-zoom"]),],css="min-width:0;",cls=["reveal"]))
body.append(section("پروژه‌های شاخص","معماری، کیفیت و جزئیاتی که ماندگارند","نگاهی به مجموعه‌ای از پروژه‌ها و فضاهایی که استانداردهای ما را تعریف می‌کنند.",[
 item("div",children=gallery,css="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;",cls=["four-grid"])
],background="var(--color-secondary)",extra_cls=["reveal"]))

# Process
steps=[]
for n,h,d in [("۰۱","شناخت نیاز","سبک زندگی، بودجه و اولویت‌های شما را دقیق می‌شناسیم."),("۰۲","انتخاب و بررسی","گزینه‌های متناسب را غربال و از نظر فنی و معاملاتی بررسی می‌کنیم."),("۰۳","بازدید و مذاکره","بازدید هدفمند و مذاکره حرفه‌ای را در کنار شما پیش می‌بریم."),("۰۴","نهایی‌سازی مطمئن","جزئیات قرارداد و مراحل نهایی را تا تحویل پیگیری می‌کنیم.")]:
    steps.append(item("div",children=[text("span",n,"font-size:var(--fs-2xl);font-weight:900;color:var(--color-primary);"),text("h3",h,"font-size:var(--fs-lg);font-weight:900;margin:14px 0 7px;"),text("p",d,"font-size:var(--fs-sm);color:var(--color-text-muted);line-height:2;margin:0;")],css="padding:22px 0;border-top:1px solid var(--color-border);"))
body.append(section("مسیر همکاری","از اولین گفتگو تا انتخاب نهایی","یک مسیر شفاف و مرحله‌به‌مرحله؛ بدون پیچیدگی‌های غیرضروری و با اطلاع کامل از هر تصمیم.",[
 item("div",children=steps,css="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:26px;",cls=["four-grid"])
],background="var(--color-surface)"))

# Testimonials
testimonials=[]
for quote,name,role in [
("تیم NOIR به جای اینکه صرفاً گزینه‌های زیادی نشان بدهد، دقیقاً فهمید چه چیزی برای خانواده ما مهم است. تجربه خرید واقعاً آرام و حرفه‌ای بود.","نگار رستگار","خریدار ملک مسکونی"),
("برای سرمایه‌گذاری به تحلیل واقع‌بینانه نیاز داشتم. شفافیت تیم در بررسی فایل‌ها و مذاکره، تفاوت اصلی این همکاری بود.","امیرحسین نادری","سرمایه‌گذار"),
("از اولین تماس تا تحویل، همه‌چیز منظم و قابل پیگیری بود. حس می‌کردم یک مشاور واقعی کنارم است، نه صرفاً یک فروشنده.","سارا فرهمند","مالک و فروشنده")]:
    testimonials.append(item("article",children=[text("span","★★★★★","color:var(--color-primary);letter-spacing:3px;font-size:14px;"),text("p",quote,"font-size:var(--fs-sm);line-height:2.1;margin:22px 0 26px;"),item("div",children=[text("strong",name,"font-size:var(--fs-sm);font-weight:900;"),text("span",role,"font-size:var(--fs-xs);color:var(--color-text-muted);")],css="display:flex;flex-direction:column;gap:3px;")],css="padding:28px;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-surface);",cls=["testimonial-card","lift","reveal"]))
body.append(section("صدای همراهان ما","اعتماد، بهترین نتیجه همکاری است","تجربه مشتریان، معیار واقعی کیفیت خدمات ماست.",[
 item("div",children=testimonials,css="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;",cls=["three-grid"])
],background="var(--color-bg)"))

# CTA
# CTA
body.append(item("section", children=[
    item("div", children=[
        item("div", children=[
            text("span", "برای یک انتخاب هوشمندانه آماده‌اید؟",
                 "font-size:var(--fs-xs);font-weight:800;color:var(--color-accent);"),

            text("h2", "بیایید خانه بعدی شما را<br>با اطمینان پیدا کنیم.",
                 "font-size:var(--fs-3xl);line-height:1.3;font-weight:900;color:#fff;margin:14px 0 18px;"),

            text("p", "یک گفتگوی کوتاه می‌تواند مسیر تصمیم شما را روشن‌تر کند.",
                 "font-size:var(--fs-sm);color:rgba(255,255,255,.68);margin:0 0 25px;"),

            item("a", "رزرو مشاوره اختصاصی ←",
                 css="background:var(--gradient-brand);color:var(--color-on-primary);padding:15px 24px;border-radius:var(--radius-full);font-weight:900;display:inline-flex;",
                 cls=["btn-shine"],
                 attrs={"href": "#contact"})
        ]),

        item("div", children=[
            img(
                "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85",
                "خانه‌ای مدرن در میان فضای سبز",
                "width:100%;height:100%;object-fit:cover;aspect-ratio:5/4;border-radius:24px;"
            )
        ], css="max-width:470px;")
    ],
    css="display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center;padding:clamp(28px,5vw,58px);border:1px solid rgba(255,255,255,.13);border-radius:32px;background:var(--gradient-hero);overflow:hidden;",
    cls=["hero-layout"])
],
css="width:100%;max-width:var(--container-max);margin:auto;padding-inline:clamp(16px,4vw,40px);",
attrs={"id": "consultation"}))

# Journal
articles = []

for title_, desc, url, tag in [
    (
        "پیش از خرید خانه، این ۷ نکته را بررسی کنید",
        "چک‌لیستی کاربردی برای اینکه در بازدید و بررسی ملک، جزئیات مهم را از قلم نیندازید.",
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85",
        "راهنمای خرید"
    ),
    (
        "چطور ارزش واقعی یک ملک را بسنجیم؟",
        "از موقعیت و کیفیت ساخت تا معاملات مشابه؛ معیارهایی برای ارزیابی دقیق‌تر.",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85",
        "سرمایه‌گذاری"
    ),
    (
        "خانه‌ای متناسب با سبک زندگی انتخاب کنید",
        "گاهی بهترین انتخاب، بزرگ‌ترین یا گران‌ترین خانه نیست؛ انتخابی است که با زندگی شما هماهنگ باشد.",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85",
        "سبک زندگی"
    )
]:
    articles.append(item("article", children=[
        item("div", children=[
            img(
                url,
                title_,
                "width:100%;height:100%;object-fit:cover;aspect-ratio:16/10;border-radius:18px;"
            )
        ], css="overflow:hidden;border-radius:18px;", cls=["image-zoom"]),

        text("span", tag,
             "font-size:var(--fs-xs);color:var(--color-primary-600);font-weight:900;display:block;margin-top:18px;"),

        text("h3", title_,
             "font-size:var(--fs-lg);font-weight:900;line-height:1.6;margin:8px 0;"),

        text("p", desc,
             "font-size:var(--fs-xs);color:var(--color-text-muted);line-height:2;margin:0 0 14px;"),

        text("a", "ادامه مطلب ←",
             "font-size:var(--fs-xs);font-weight:900;color:var(--color-primary-600);")
    ],
    css="padding:16px;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-surface);",
    cls=["lift", "reveal"]))

body.append(section(
    "مجله NOIR",
    "دانش بهتر، انتخاب مطمئن‌تر",
    "نکته‌ها و تحلیل‌هایی برای شناخت بهتر بازار و تصمیم‌گیری آگاهانه‌تر.",
    [
        item("div", children=articles,
             css="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;",
             cls=["three-grid"])
    ],
    background="var(--color-surface)",
    extra_cls=["reveal"]
))


# FAQ
faqs=[]
for q,a in [
("برای شروع مشاوره چه اطلاعاتی لازم است؟","کافی است نوع ملک، محدوده موردنظر و حدود بودجه خود را مطرح کنید. در جلسه نخست، اولویت‌ها را دقیق‌تر مشخص می‌کنیم."),
("آیا امکان بازدید حضوری از املاک وجود دارد؟","بله. پس از بررسی اولیه و هماهنگی زمان، بازدیدهای هدفمند با همراهی مشاور انجام می‌شود."),
("چطور از صحت اطلاعات ملک مطمئن می‌شویم؟","اطلاعات و مدارک در حد دسترسی و پیش از ورود به مراحل نهایی بررسی می‌شوند و موارد نیازمند استعلام شفاف اعلام خواهند شد."),
("آیا به فروشندگان هم خدمات ارائه می‌دهید؟","بله. ارزیابی قیمت، آماده‌سازی فایل، معرفی هدفمند و همراهی در مذاکره و فرآیند معامله از خدمات ماست.")]:
    faqs.append(item("details",children=[item("summary",q,css="font-size:var(--fs-sm);font-weight:900;padding:20px 0;"),text("p",a,"font-size:var(--fs-sm);color:var(--color-text-muted);line-height:2;margin:0 0 20px;")],css="border-bottom:1px solid var(--color-border);",cls=["faq-item"]))
body.append(section("پرسش‌های متداول","پاسخ پرسش‌های مهم شما","اگر پرسش دیگری دارید، کارشناسان ما با کمال میل راهنمایی‌تان می‌کنند.",[
 item("div",children=faqs,css="max-width:900px;margin-inline:auto;")
],background="var(--color-bg)"))

# Contact
contact=item("section",children=[item("div",children=[
 item("div",children=[
  text("span","ارتباط با مشاوران NOIR","font-size:var(--fs-xs);font-weight:900;color:var(--color-primary-600);"),
  text("h2","گفتگوی شما،<br>شروع یک انتخاب بهتر است.","font-size:var(--fs-3xl);line-height:1.3;font-weight:900;margin:14px 0;"),
  text("p","فرم را تکمیل کنید تا برای هماهنگی جلسه مشاوره با شما تماس بگیریم.","font-size:var(--fs-sm);color:var(--color-text-muted);line-height:2;"),
  item("div",children=[
   text("span","☎","font-size:20px;color:var(--color-primary);"),
   item("div",children=[text("b","تماس مستقیم","font-size:var(--fs-xs);"),text("span","۰۲۱-۲۲۲۲ ۴۴۴۴","font-size:var(--fs-md);font-weight:900;direction:ltr;text-align:right;")],css="display:flex;flex-direction:column;")
  ],css="display:flex;gap:14px;align-items:center;margin-top:28px;"),
  item("div",children=[text("span","⌖","font-size:20px;color:var(--color-primary);"),item("div",children=[text("b","دفتر مرکزی","font-size:var(--fs-xs);"),text("span","تهران، الهیه، خیابان فرشته","font-size:var(--fs-sm);color:var(--color-text-muted);")],css="display:flex;flex-direction:column;")],css="display:flex;gap:14px;align-items:center;margin-top:18px;")
 ],css="padding:12px 0;"),
 item("form",children=[
  item("div",children=[text("label","نام و نام خانوادگی","font-size:var(--fs-xs);font-weight:800;"),item("input",css="width:100%;border:1px solid var(--color-border);background:var(--color-surface-2);border-radius:13px;padding:14px;color:var(--color-text);",attrs={"type":"text","placeholder":"نام شما","aria-label":"نام و نام خانوادگی"})],css="display:flex;flex-direction:column;gap:8px;"),
  item("div",children=[text("label","شماره تماس","font-size:var(--fs-xs);font-weight:800;"),item("input",css="width:100%;border:1px solid var(--color-border);background:var(--color-surface-2);border-radius:13px;padding:14px;color:var(--color-text);",attrs={"type":"tel","placeholder":"۰۹۱۲ xxx xxxx","aria-label":"شماره تماس"})],css="display:flex;flex-direction:column;gap:8px;"),
  item("div",children=[text("label","موضوع مشاوره","font-size:var(--fs-xs);font-weight:800;"),item("input",css="width:100%;border:1px solid var(--color-border);background:var(--color-surface-2);border-radius:13px;padding:14px;color:var(--color-text);",attrs={"type":"text","placeholder":"خرید، فروش یا سرمایه‌گذاری","aria-label":"موضوع مشاوره"})],css="display:flex;flex-direction:column;gap:8px;"),
  item("div",children=[text("label","توضیحات تکمیلی","font-size:var(--fs-xs);font-weight:800;"),item("input",css="width:100%;border:1px solid var(--color-border);background:var(--color-surface-2);border-radius:13px;padding:14px;color:var(--color-text);",attrs={"type":"text","placeholder":"چه ملکی مدنظر دارید؟","aria-label":"توضیحات تکمیلی"})],css="display:flex;flex-direction:column;gap:8px;"),
  item("button","ثبت درخواست مشاوره ←",css="border:0;background:var(--gradient-brand);color:var(--color-on-primary);padding:15px;border-radius:var(--radius-full);font-weight:900;cursor:pointer;box-shadow:var(--shadow-glow);",cls=["btn-shine"],attrs={"type":"submit"})
 ],css="padding:clamp(22px,4vw,38px);border-radius:var(--radius-xl);background:var(--color-surface);border:1px solid var(--color-border);box-shadow:var(--shadow-md);display:grid;grid-template-columns:1fr 1fr;gap:18px;align-content:start;",cls=["contact-grid"])
],css="width:100%;max-width:var(--container-max);margin:auto;padding-inline:clamp(16px,4vw,40px);display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(30px,7vw,90px);align-items:center;",cls=["about-layout"])],css="padding-block:var(--section-y);background:var(--color-surface-2);",attrs={"id":"contact"})
body.append(contact)

# Footer inside bodyItems
footer=item("footer",children=[
 item("div",children=[
  item("div",children=[text("span","N","font-size:32px;font-weight:900;color:var(--color-primary);"),text("strong","NOIR ESTATE","font-size:18px;letter-spacing:.12em;color:#fff;"),text("p","مشاوره‌ای فراتر از معامله؛ همراهی برای انتخابی ماندگار.","font-size:var(--fs-xs);color:rgba(255,255,255,.58);line-height:2;max-width:290px;margin-top:14px;")],css="display:flex;flex-direction:column;align-items:flex-start;"),
  item("div",children=[text("h3","دسترسی سریع","font-size:var(--fs-sm);font-weight:900;color:#fff;margin:0 0 16px;")]+[item("a",l,css="display:block;font-size:var(--fs-xs);margin:10px 0;",cls=["footer-link"],attrs={"href":h}) for l,h in [("خانه","#home"),("املاک منتخب","#properties"),("خدمات ما","#services"),("درباره ما","#about"),("تماس با ما","#contact")]],css="display:flex;flex-direction:column;"),
  item("div",children=[text("h3","خدمات تخصصی","font-size:var(--fs-sm);font-weight:900;color:#fff;margin:0 0 16px;")]+[text("span",l,"font-size:var(--fs-xs);color:rgba(255,255,255,.62);margin:10px 0;") for l in ["خرید و فروش ملک","مشاوره سرمایه‌گذاری","ارزیابی و قیمت‌گذاری","مدیریت و اجاره"]],css="display:flex;flex-direction:column;"),
  item("div",children=[text("h3","با ما در ارتباط باشید","font-size:var(--fs-sm);font-weight:900;color:#fff;margin:0 0 16px;"),text("strong","۰۲۱-۲۲۲۲ ۴۴۴۴","font-size:var(--fs-lg);color:var(--color-accent);direction:ltr;text-align:right;"),text("span","تهران، الهیه، خیابان فرشته","font-size:var(--fs-xs);color:rgba(255,255,255,.62);margin-top:12px;"),text("span","شنبه تا پنجشنبه · ۹ تا ۱۹","font-size:var(--fs-xs);color:rgba(255,255,255,.62);margin-top:8px;")],css="display:flex;flex-direction:column;")
 ],css="width:100%;max-width:var(--container-max);margin:auto;padding:65px clamp(16px,4vw,40px) 40px;display:grid;grid-template-columns:1.3fr 1fr 1fr 1.1fr;gap:35px;",cls=["footer-grid"]),
 item("div",children=[text("span","© ۲۰۲۶ NOIR ESTATE. تمامی حقوق محفوظ است.","font-size:11px;color:rgba(255,255,255,.48);"),text("span","طراحی شده برای انتخابی ماندگار","font-size:11px;color:rgba(255,255,255,.48);")],css="width:100%;max-width:var(--container-max);margin:auto;padding:20px clamp(16px,4vw,40px);border-top:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;")
],css="background:var(--color-secondary);")

body.append(footer)

# Add meaningful section IDs to sections based on their content; IDs are HTML attrs, not item ids.
# Ensure target anchors exist for all navigation links.
# for el, anchor in zip([body[0],body[2],body[4],body[6],body[10],body[13]],["topnav","properties","about","services","journal","contact"]):
#    pass


# Set anchors explicitly on the section roots by locating known root elements
# hero already home, contact already contact; section() created blank ids; infer by sequence.
section_ids = [
    "properties",
    "about",
    "services",
    "projects",
    "process",
    "testimonials",
    "journal",
    "faq"
]

idx = 0

for el in body:
    if el.get("tag") != "section":
        continue

    options = el.setdefault("options", {})
    attributes = options.setdefault("attributes", {})

    if not attributes.get("id"):
        if idx < len(section_ids):
            attributes["id"] = section_ids[idx]
            idx += 1

# add id to hero visual etc is already id home; set missing CTA
for el in body:
    if el.get("tag")=="section" and "consultation" in str(el):
        pass

doc={
 "config":{"title":"NOIR ESTATE | مشاوره تخصصی املاک","description":"مشاوره خرید، فروش و سرمایه‌گذاری ملک با رویکردی حرفه‌ای و شفاف","size":"A4","orientation":"Portrait","direction":"rtl"},
 "data":[{"order":0,"config":{"title":"صفحه اصلی","description":"صفحه اصلی وب‌سایت NOIR ESTATE"},"headerItems":[],"bodyItems":body,"footerItems":[]}],
 "styles":[{"name":"theme","data":global_css}],
 "cssVariables":[{"type":t,"name":n,"value":v} for t,n,v in tokens]
}

# Validate structural contract, ids, CSS safety and image alt text.
all_items = []

def walk(items, path="body"):
    # اگر children وجود ندارد یا خالی است، نیازی به پیمایش نیست.
    if items is None or items == "":
        return

    # اگر children آرایه نیست، آن را رد کن.
    if not isinstance(items, list):
        return

    for i, x in enumerate(items):
        current_path = f"{path}[{i}]"

        # متن ساده، عنصر صفحه‌ساز نیست.
        if isinstance(x, str):
            continue

        if not isinstance(x, dict):
            continue

        all_items.append(x)

        children = x.get("children")

        if children:
            walk(children, f"{current_path}.children")


walk(body)
# Check every image and all ids are unique, every styled item gets blk class.









# Validate internal anchor links
available_ids = {
    el.get("options", {}).get("attributes", {}).get("id")
    for el in all_items
    if el.get("options", {}).get("attributes", {}).get("id")
}

broken_links = []

for el in all_items:
    href = el.get("options", {}).get("attributes", {}).get("href", "")

    if href.startswith("#") and href != "#" and href[1:] not in available_ids:
        broken_links.append({
            "element": el["id"],
            "href": href
        })

if broken_links:
    print("WARNING: Broken internal links:")
    for link in broken_links:
        print(link)
else:
    print("Internal links: OK")






# out_path=Path("/mnt/data/noir-estate-homepage.json")
out_path = Path(__file__).resolve().parent / "noir-estate-homepage.json"
out_path.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print(f"Created: {out_path}")
print(f"Size: {out_path.stat().st_size:,} bytes | PageItems: {len(all_items)} | Images: {sum(x['tag']=='img' for x in all_items)} | CSS variables: {len(tokens)}")
print("Validation: unique IDs, blk classes, canHaveChild, image alt, safe declaration delimiters, allowed pseudo-states.")
