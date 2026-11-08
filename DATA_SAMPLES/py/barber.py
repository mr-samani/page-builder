
import json
import uuid
from pathlib import Path


OUTPUT_DIR = Path(__file__).parent / "taha-output"


def uid():
    return str(uuid.uuid4())


def node(tag, class_name="", content=None, children=None, css=None,
         attributes=None, can_have_child=None):
    return {
        "id": uid(),
        "tag": tag,
        "canHaveChild": bool(children) if can_have_child is None else can_have_child,
        "children": children or [],
        "classList": class_name.split() if class_name else [],
        **({"content": content} if content is not None else {}),
        "css": {"base": css or {}},
        "options": {
            "attributes": attributes or {}
        }
    }


def text(content, class_name="", css=None, tag="div"):
    return node(tag, class_name, content=content, css=css)


def section(class_name, children, css=None):
    return node(
        "section",
        class_name,
        children=children,
        css=css,
        can_have_child=True
    )


def build_design(theme):
    dark = theme == "dark"

    colors = {
        "background": "#10100F" if dark else "#F7F5F0",
        "surface": "#191918" if dark else "#FFFFFF",
        "surface_alt": "#22211F" if dark else "#EEEAE2",
        "text": "#F5F1E9" if dark else "#24211D",
        "muted": "#AAA39A" if dark else "#777168",
        "brand": "#C9A66B" if dark else "#9B713B",
        "border": "#37332D" if dark else "#E4DED3",
        "white": "#FFFFFF",
    }

    c = colors

    global_css = f"""
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap');

* {{
    box-sizing: border-box;
}}

html {{
    scroll-behavior: smooth;
}}

body {{
    margin: 0;
    background: {c['background']};
    color: {c['text']};
    font-family: 'Vazirmatn', sans-serif;
    direction: rtl;
}}

.taha-page {{
    width: 100%;
    overflow: hidden;
    background: {c['background']};
    color: {c['text']};
}}

.taha-container {{
    width: min(1160px, calc(100% - 48px));
    margin: 0 auto;
}}

.taha-header {{
    padding: 22px 0;
    border-bottom: 1px solid {c['border']};
}}

.taha-nav {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
}}

.taha-logo {{
    color: {c['brand']};
    font-size: 30px;
    font-weight: 800;
}}

.taha-links {{
    display: flex;
    gap: 30px;
    align-items: center;
}}

.taha-links a {{
    color: {c['muted']};
    text-decoration: none;
    font-size: 14px;
}}

.taha-button {{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 13px 25px;
    border-radius: 4px;
    background: {c['brand']};
    color: #17130D;
    text-decoration: none;
    font-weight: 700;
}}

.taha-hero {{
    padding: 105px 0 95px;
    text-align: center;
    background:
        radial-gradient(ellipse at 50% 0%, {c['surface_alt']}, transparent 70%);
}}

.taha-eyebrow {{
    color: {c['brand']};
    font-size: 14px;
    letter-spacing: 2px;
    margin-bottom: 20px;
}}

.taha-hero h1 {{
    font-size: clamp(38px, 6vw, 68px);
    line-height: 1.5;
    margin: 0 auto 20px;
    max-width: 850px;
    font-weight: 800;
}}

.taha-hero p {{
    max-width: 620px;
    margin: 0 auto 32px;
    color: {c['muted']};
    font-size: 16px;
    line-height: 2.2;
}}

.taha-intro {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: {c['surface']};
    border: 1px solid {c['border']};
    margin-top: -1px;
}}

.taha-intro-item {{
    text-align: center;
    padding: 28px 15px;
    border-left: 1px solid {c['border']};
}}

.taha-intro-item:last-child {{
    border-left: 0;
}}

.taha-intro-item strong {{
    display: block;
    color: {c['brand']};
    font-size: 24px;
    margin-bottom: 8px;
}}

.taha-intro-item span {{
    color: {c['muted']};
    font-size: 13px;
}}

.taha-section {{
    padding: 90px 0;
}}

.taha-section-heading {{
    text-align: center;
    margin-bottom: 45px;
}}

.taha-section-heading h2 {{
    font-size: 34px;
    margin: 0 0 12px;
}}

.taha-section-heading p {{
    color: {c['muted']};
    line-height: 2;
}}

.taha-services {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
}}

.taha-service {{
    padding: 30px 22px;
    min-height: 220px;
    background: {c['surface']};
    border: 1px solid {c['border']};
    transition: transform .25s, border-color .25s;
}}

.taha-service:hover {{
    transform: translateY(-6px);
    border-color: {c['brand']};
}}

.taha-service-icon {{
    color: {c['brand']};
    font-size: 30px;
    margin-bottom: 22px;
}}

.taha-service h3 {{
    font-size: 18px;
    margin: 0 0 12px;
}}

.taha-service p {{
    color: {c['muted']};
    font-size: 13px;
    line-height: 2;
    margin: 0;
}}

.taha-about {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 55px;
    align-items: center;
}}

.taha-about-visual {{
    min-height: 390px;
    background:
        linear-gradient(145deg, {c['surface_alt']}, {c['surface']});
    border: 1px solid {c['border']};
    display: flex;
    align-items: center;
    justify-content: center;
    color: {c['brand']};
    font-size: 38px;
    font-weight: 800;
}}

.taha-about-copy h2 {{
    font-size: 34px;
    line-height: 1.7;
}}

.taha-about-copy p {{
    color: {c['muted']};
    line-height: 2.4;
}}

.taha-gallery {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}}

.taha-gallery-item {{
    min-height: 230px;
    background: linear-gradient(145deg, {c['surface_alt']}, {c['surface']});
    border: 1px solid {c['border']};
    display: flex;
    justify-content: center;
    align-items: center;
    color: {c['brand']};
    font-size: 20px;
}}

.taha-cta {{
    padding: 65px 30px;
    text-align: center;
    background: {c['surface']};
    border: 1px solid {c['border']};
}}

.taha-cta h2 {{
    font-size: 32px;
    margin: 0 0 15px;
}}

.taha-cta p {{
    color: {c['muted']};
    margin-bottom: 28px;
}}

.taha-footer {{
    padding: 45px 0;
    border-top: 1px solid {c['border']};
    color: {c['muted']};
    text-align: center;
    font-size: 13px;
}}

@media (max-width: 900px) {{
    .taha-services {{
        grid-template-columns: repeat(2, 1fr);
    }}

    .taha-about {{
        grid-template-columns: 1fr;
    }}

    .taha-about-visual {{
        min-height: 280px;
    }}
}}

@media (max-width: 600px) {{
    .taha-container {{
        width: calc(100% - 30px);
    }}

    .taha-links {{
        display: none;
    }}

    .taha-hero {{
        padding: 70px 0;
    }}

    .taha-intro {{
        grid-template-columns: 1fr;
    }}

    .taha-intro-item {{
        border-left: 0;
        border-bottom: 1px solid {c['border']};
    }}

    .taha-services {{
        grid-template-columns: 1fr;
    }}

    .taha-gallery {{
        grid-template-columns: 1fr;
    }}

    .taha-section {{
        padding: 65px 0;
    }}
}}
"""

    header = section("taha-header", [
        node("div", "taha-container", children=[
            node("nav", "taha-nav", children=[
                text("طاها", "taha-logo"),
                node("div", "taha-links", children=[
                    text("خانه", tag="a", css={"href": "#home"}),
                    text("خدمات", tag="a", css={"href": "#services"}),
                    text("درباره ما", tag="a", css={"href": "#about"}),
                    text("گالری", tag="a", css={"href": "#gallery"}),
                    text("تماس", tag="a", css={"href": "#contact"}),
                ]),
                text("رزرو نوبت", "taha-button", tag="a",
                     css={"href": "#contact"}),
            ])
        ])
    ])

    hero = section("taha-hero", [
        node("div", "taha-container", children=[
            text("TAHA MEN'S GROOMING", "taha-eyebrow"),
            text("استایل متفاوت،<br>شخصیت ماندگار", tag="h1"),
            text(
                "در آرایشگاه مردانه طاها، جزئیات اهمیت دارند. "
                "تجربه‌ای حرفه‌ای از اصلاح، پیرایش و آراستگی را تجربه کنید."
            ),
            text("رزرو نوبت", "taha-button", tag="a",
                 css={"href": "#contact"}),
        ])
    ])

    intro = section("taha-container", [
        node("div", "taha-intro", children=[
            node("div", "taha-intro-item", children=[
                text("۱۰+", tag="strong"),
                text("سال تجربه حرفه‌ای", tag="span"),
            ]),
            node("div", "taha-intro-item", children=[
                text("۱۰۰۰+", tag="strong"),
                text("مشتری راضی", tag="span"),
            ]),
            node("div", "taha-intro-item", children=[
                text("۱۰۰٪", tag="strong"),
                text("توجه به جزئیات", tag="span"),
            ]),
        ])
    ])

    service_items = [
        ("✂", "اصلاح و کوتاهی مو",
         "کوتاهی حرفه‌ای متناسب با فرم چهره و سلیقه شما."),
        ("◈", "اصلاح و فرم‌دهی ریش",
         "طراحی و مرتب‌سازی ریش با دقت و ظرافت."),
        ("✧", "پاکسازی و مراقبت پوست",
         "تجربه‌ای آرامش‌بخش برای مراقبت و شادابی پوست."),
        ("◇", "استایل و پیرایش",
         "تکمیل ظاهر شما با توجه به آخرین سبک‌های روز."),
    ]

    services = section("taha-section", [
        node("div", "taha-container", children=[
            node("div", "taha-section-heading", children=[
                text("خدمات ما", tag="h2"),
                text("برای آراستگی شما، بهترین‌ها را آماده کرده‌ایم."),
            ]),
            node("div", "taha-services", children=[
                node("article", "taha-service", children=[
                    text(icon, "taha-service-icon"),
                    text(title, tag="h3"),
                    text(description, tag="p"),
                ])
                for icon, title, description in service_items
            ])
        ])
    ])

    about = section("taha-section", [
        node("div", "taha-container taha-about", children=[
            node("div", "taha-about-visual", children=[
                text("TAHA")
            ]),
            node("div", "taha-about-copy", children=[
                text("درباره آرایشگاه طاها", tag="h2"),
                text(
                    "ما باور داریم آراستگی فقط یک ظاهر نیست؛ "
                    "بخشی از شخصیت و اعتمادبه‌نفس شماست. "
                    "در طاها تلاش می‌کنیم با محیطی حرفه‌ای، "
                    "ابزارهای مناسب و توجه به سلیقه هر فرد، "
                    "تجربه‌ای متفاوت خلق کنیم.",
                    tag="p"
                ),
                text("بیشتر با ما آشنا شوید", "taha-button", tag="a",
                     css={"href": "#contact"}),
            ])
        ])
    ])

    gallery = section("taha-section", [
        node("div", "taha-container", children=[
            node("div", "taha-section-heading", children=[
                text("گالری سبک و استایل", tag="h2"),
                text("نمونه‌ای از فضای حرفه‌ای و دنیای آراستگی طاها"),
            ]),
            node("div", "taha-gallery", children=[
                text("HAIR STYLE", "taha-gallery-item"),
                text("BEARD STYLE", "taha-gallery-item"),
                text("GROOMING", "taha-gallery-item"),
            ])
        ])
    ])

    cta = section("taha-section", [
        node("div", "taha-container", children=[
            node("div", "taha-cta", children=[
                text("وقتشه استایل خودت رو بسازی", tag="h2"),
                text("برای رزرو نوبت و دریافت اطلاعات بیشتر با ما تماس بگیرید."),
                text("تماس با ما", "taha-button", tag="a",
                     css={"href": "tel:00000000000"}),
            ])
        ])
    ])

    footer = section("taha-footer", [
        node("div", "taha-container", children=[
            text("آرایشگاه مردانه طاها"),
            text("آدرس: آدرس آرایشگاه را اینجا وارد کنید"),
            text("تلفن: ۰۹۱۲۱۲۳۴۵۶۷"),
            text("© تمامی حقوق برای آرایشگاه طاها محفوظ است."),
        ])
    ])

    page = {
        "headerItems": [header],
        "bodyItems": [
            hero,
            intro,
            services,
            section("taha-section", [
                node("div", "taha-container taha-about", children=[
                    about
                ])
            ]),
            gallery,
            cta,
        ],
        "footerItems": [footer],
        "config": {
            "title": "خانه",
            "description": "صفحه اصلی آرایشگاه مردانه طاها"
        }
    }

    return {
        "config": {
            "title": "آرایشگاه مردانه طاها",
            "description": "طراحی سایت آرایشگاه مردانه طاها",
            "size": "A4",
            "orientation": "Portrait",
            "direction": "rtl"
        },
        "data": [page],
        "styles": [
            {
                "name": "default",
                "data": global_css
            }
        ],
        "cssVariables": [
            {"name": "--taha-background", "value": c["background"]},
            {"name": "--taha-surface", "value": c["surface"]},
            {"name": "--taha-brand", "value": c["brand"]},
            {"name": "--taha-text", "value": c["text"]},
            {"name": "--taha-muted", "value": c["muted"]},
            {"name": "--taha-border", "value": c["border"]},
        ]
    }


def save_json(filename, data):
    path = OUTPUT_DIR / filename

    with path.open("w", encoding="utf-8") as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2
        )

    print(f"Created: {path}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    dark_design = build_design("dark")
    light_design = build_design("light")

    save_json("taha-barbershop-dark.json", dark_design)
    save_json("taha-barbershop-light.json", light_design)

    print("\nDone!")
    print(f"Output directory: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
