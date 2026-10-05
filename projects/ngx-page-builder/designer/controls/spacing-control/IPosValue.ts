// TODO: return {value:number,unit:'px' | 'rem' | 'em' | '%' | 'vw' | 'vh' | 'auto'}
export interface IPosValue {
  top?: number | 'auto';
  right?: number | 'auto';
  bottom?: number | 'auto';
  left?: number | 'auto';
}
