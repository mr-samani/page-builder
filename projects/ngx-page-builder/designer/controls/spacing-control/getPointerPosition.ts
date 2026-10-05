export function getPointerPosition(evt: MouseEvent | TouchEvent): IPosition {
  if (evt instanceof MouseEvent) {
    return {
      x: evt.pageX,
      y: evt.pageY,
    };
  } else {
    const touch = evt.targetTouches[0] || evt.changedTouches[0];
    return {
      x: touch.pageX,
      y: touch.pageY,
    };
  }
}
export interface IPosition {
  x: number;
  y: number;
}
