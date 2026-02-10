export class Spacing {
  top = new PosValue();
  right = new PosValue();
  bottom = new PosValue();
  left = new PosValue();
}

export class PosValue {
  value?: number | 'auto';
  unit: 'px' | 'rem' | 'em' | '%' | 'vw' | 'vh' | 'auto' = 'px';
}
