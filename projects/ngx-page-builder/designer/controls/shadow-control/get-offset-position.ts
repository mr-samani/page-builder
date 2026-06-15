export function getOffsetPosition(evt: MouseEvent | TouchEvent, parent: HTMLElement) {
  const position = {
    x: 0,
    y: 0,
  };

  if (evt instanceof MouseEvent) {
    position.x = evt.pageX;
    position.y = evt.pageY;
  } else if (evt.touches && evt.touches.length > 0) {
    position.x = evt.touches[0].pageX;
    position.y = evt.touches[0].pageY;
  }

  const parentRect = parent.getBoundingClientRect();

  const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
  const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

  position.x -= parentRect.left + scrollX;
  position.y -= parentRect.top + scrollY;

  return position;
}
