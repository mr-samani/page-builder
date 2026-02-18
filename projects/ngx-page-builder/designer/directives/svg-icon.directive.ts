import {
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  Inject,
  Input,
  OnChanges,
  OnInit,
  Renderer2,
  SimpleChanges,
} from '@angular/core';

const SvgCache = new Map<string, string>(); // Cache for performance

@Directive({
  selector: 'svg[Icon]',
})
export class SvgIconDirective implements OnInit {
  @Input() Icon!: string;

  private doc = inject(DOCUMENT);
  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  async ngOnInit() {
    if (!this.Icon) return;
    const svgEl: SVGElement = this.el.nativeElement;

    // پاک کردن محتوای قبلی
    while (svgEl.firstChild) {
      this.renderer.removeChild(svgEl, svgEl.firstChild);
    }

    try {
      let svgContent: string;
      if (this.Icon.startsWith('<svg')) {
        svgContent = this.Icon;
      } else {
        svgContent = await this.loadSvg(this.Icon);
      }

      // تبدیل string → Element
      const temp = this.doc.createElement('div');
      temp.innerHTML = svgContent.trim();

      const innerSvg = temp.querySelector('svg');
      if (!innerSvg) return;

      // کپی کردن attribute های داخلی
      for (const attr of Array.from(innerSvg.attributes)) {
        this.renderer.setAttribute(svgEl, attr.name, attr.value);
      }

      // انتقال children
      while (innerSvg.firstChild) {
        this.renderer.appendChild(svgEl, innerSvg.firstChild);
      }
    } catch (err) {
      console.error('SVG Load Error:', err);
    }
  }

  private async loadSvg(url: string): Promise<string> {
    if (SvgCache.has(url)) return SvgCache.get(url)!;

    const res = await fetch(url);
    const text = await res.text();

    SvgCache.set(url, text);
    return text;
  }
}
