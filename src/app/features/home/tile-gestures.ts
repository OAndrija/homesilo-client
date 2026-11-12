import { signal } from '@angular/core';
import { PlacedTile, TileId, TileSize, tileDefinition } from '../../core/models/dashboard-layout';

/** What the gestures need from the dashboard. */
export interface TileGestureHost {
  grid(): HTMLElement | null;
  tiles(): readonly PlacedTile[];
  moveTile(id: TileId, to: number, skipAnimation?: TileId): void;
  resizeTile(id: TileId, size: TileSize): void;
  restoreOrder(tiles: PlacedTile[]): void;
  /** Runs after the next render, before the browser paints. */
  afterRender(fn: () => void): void;
  announce(message: string): void;
}

/** How long a finger rests on a tile before it lifts (Android uses about this). */
const LONG_PRESS_MS = 300;
/** A mouse lifts a tile once it moves this far with the button down. */
const MOUSE_SLOP = 5;
/** A finger that moves this far before the long press is scrolling, not picking up. */
const TOUCH_SLOP = 10;
/** Before another swap, the pointer has to move this far, so swaps don't cascade. */
const SWAP_SLOP = 12;
/** Near the top or bottom edge, a held tile scrolls the page. */
const SCROLL_EDGE = 72;

interface Pointer {
  id: number;
  x: number;
  y: number;
  touch: boolean;
}

/**
 * Pointer gestures for editing the dashboard, for mouse, pen and touch alike:
 *
 * - Pick up: press and drag with a mouse, or hold a finger on a tile. The tile
 *   itself lifts and follows the pointer; the others make room as it passes.
 * - Drop: release. The tile settles into its new place. Escape puts it back.
 * - Resize: drag the corner grip; the tile snaps to the nearest size it allows.
 *   A tap on the grip steps to the next size.
 */
export class TileGestures {
  /** The tile being carried. */
  readonly lifted = signal<TileId | null>(null);
  /** The tile being resized, while its grip is dragged. */
  readonly resizing = signal<TileId | null>(null);

  private pointer: Pointer | null = null;
  private pending: { id: TileId; startX: number; startY: number; timer: number } | null = null;
  private drag: {
    id: TileId;
    grabX: number;
    grabY: number;
    startOrder: PlacedTile[];
    lastTarget: TileId | null;
    swappedAt: { x: number; y: number };
    scroller: HTMLElement;
  } | null = null;
  private resize: {
    id: TileId;
    startX: number;
    startY: number;
    moved: boolean;
  } | null = null;
  private frame = 0;

  constructor(private host: TileGestureHost) {}

  get active(): boolean {
    return !!(this.pending || this.drag || this.resize);
  }

  // ── Starting ─────────────────────────────────────────────────

  onTilePointerDown(id: TileId, event: PointerEvent): void {
    if (event.button !== 0 || this.active) return;
    // The remove button and resize grip handle their own presses.
    if ((event.target as Element).closest('button')) return;
    const touch = event.pointerType === 'touch';
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, touch };
    this.pending = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      timer: touch ? window.setTimeout(() => this.lift(), LONG_PRESS_MS) : 0,
    };
    if (!touch) {
      // No text selection; keep the keyboard on the tile that was pressed.
      event.preventDefault();
      (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    }
    this.listen();
  }

  onGripPointerDown(id: TileId, event: PointerEvent): void {
    if (event.button !== 0 || this.active) return;
    event.preventDefault();
    event.stopPropagation();
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      touch: event.pointerType === 'touch',
    };
    this.resize = { id, startX: event.clientX, startY: event.clientY, moved: false };
    this.listen();
    this.loop();
  }

  /** Escape: a carried tile goes back where it was. */
  cancel(): boolean {
    if (this.drag) {
      const { id, startOrder } = this.drag;
      this.host.restoreOrder(startOrder);
      this.host.afterRender(() => this.settle(id));
      this.host.announce(`${tileDefinition(id).title} put back.`);
      this.stop();
      return true;
    }
    if (this.pending || this.resize) {
      this.stop();
      return true;
    }
    return false;
  }

  /** Stops whatever is going on without animating (leaving edit mode, page closing). */
  dispose(): void {
    const id = this.drag?.id;
    this.stop();
    if (id) this.clearStyles(this.tile(id));
  }

  // ── Pointer tracking ─────────────────────────────────────────

  private listen(): void {
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    // Once a tile is lifted, a moving finger carries it instead of scrolling.
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
  }

  private unlisten(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('touchmove', this.onTouchMove);
  }

  private onMove = (event: PointerEvent): void => {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const pending = this.pending;
    if (pending && !this.drag) {
      const distance = Math.hypot(pointer.x - pending.startX, pointer.y - pending.startY);
      if (pointer.touch && distance > TOUCH_SLOP)
        this.stop(); // they're scrolling
      else if (!pointer.touch && distance > MOUSE_SLOP) this.lift();
    }
  };

  private onTouchMove = (event: TouchEvent): void => {
    if ((this.drag || this.resize) && event.cancelable) event.preventDefault();
  };

  private onUp = (event: PointerEvent): void => {
    if (this.pointer && event.pointerId !== this.pointer.id) return;
    if (this.drag) this.drop();
    else if (this.resize) this.endResize();
    else this.stop();
  };

  /** The browser took the pointer over (a scroll began); keep what was done so far. */
  private onCancel = (event: PointerEvent): void => {
    if (this.pointer && event.pointerId !== this.pointer.id) return;
    this.onUp(event);
  };

  // ── Carrying a tile ──────────────────────────────────────────

  private lift(): void {
    const pending = this.pending;
    const pointer = this.pointer;
    const el = pending && this.tile(pending.id);
    if (!pending || !pointer || !el) return this.stop();
    clearTimeout(pending.timer);
    this.pending = null;
    const rect = el.getBoundingClientRect();
    this.drag = {
      id: pending.id,
      grabX: pointer.x - rect.left,
      grabY: pointer.y - rect.top,
      startOrder: [...this.host.tiles()],
      lastTarget: null,
      swappedAt: { x: pointer.x, y: pointer.y },
      scroller: scrollParent(el),
    };
    // Whatever slide the tile was in the middle of, it now follows the pointer.
    el.getAnimations().forEach((a) => a.cancel());
    this.lifted.set(pending.id);
    if (pointer.touch) navigator.vibrate?.(12);
    this.position();
    this.host.announce(`${tileDefinition(pending.id).title} picked up. ${this.positionText()}`);
    this.loop();
  }

  /** Runs every frame while carrying or resizing: follow, scroll, swap. */
  private loop = (): void => {
    if (!this.drag && !this.resize) return;
    this.autoScroll();
    if (this.drag) {
      this.position();
      this.swapUnderPointer();
    } else {
      this.resizeToPointer();
    }
    this.frame = requestAnimationFrame(this.loop);
  };

  /** Keeps the lifted tile under the pointer, wherever its place in the grid is now. */
  private position(): void {
    const drag = this.drag;
    const grid = this.host.grid();
    const el = drag && this.tile(drag.id);
    if (!drag || !grid || !el || !this.pointer) return;
    const origin = grid.getBoundingClientRect();
    const x = this.pointer.x - drag.grabX - (origin.left + el.offsetLeft);
    const y = this.pointer.y - drag.grabY - (origin.top + el.offsetTop);
    el.style.translate = `${x}px ${y}px`;
    // The dashed outline shows where the tile will land.
    const slot = grid.querySelector<HTMLElement>('.drop-slot');
    if (slot) {
      slot.style.left = `${el.offsetLeft}px`;
      slot.style.top = `${el.offsetTop}px`;
      slot.style.width = `${el.offsetWidth}px`;
      slot.style.height = `${el.offsetHeight}px`;
    }
  }

  /**
   * Moves the lifted tile into the place of the tile under the pointer. Places
   * are read from the layout (offsets), not from the screen, so tiles that are
   * still sliding don't cause swaps.
   */
  private swapUnderPointer(): void {
    const drag = this.drag;
    const pointer = this.pointer;
    const grid = this.host.grid();
    if (!drag || !pointer || !grid) return;
    const origin = grid.getBoundingClientRect();
    const tiles = Array.from(grid.querySelectorAll<HTMLElement>('[data-tile]'));
    const inside = (el: HTMLElement) => {
      const left = origin.left + el.offsetLeft;
      const top = origin.top + el.offsetTop;
      return (
        pointer.x >= left &&
        pointer.x <= left + el.offsetWidth &&
        pointer.y >= top &&
        pointer.y <= top + el.offsetHeight
      );
    };

    const over = tiles.find((el) => el.dataset['tile'] !== drag.id && inside(el));
    const target = (over?.dataset['tile'] as TileId | undefined) ?? null;
    if (!target) {
      drag.lastTarget = null;
      // Below or after the last tile: to the end.
      const last = tiles[tiles.length - 1];
      if (!last || last.dataset['tile'] === drag.id || !this.movedSinceSwap()) return;
      const top = origin.top + last.offsetTop;
      const left = origin.left + last.offsetLeft;
      if (
        pointer.y > top + last.offsetHeight ||
        (pointer.y > top && pointer.x > left + last.offsetWidth)
      ) {
        this.swapTo(this.host.tiles().length - 1);
      }
      return;
    }
    // Still over the tile we just swapped with: a tile of another size can stay under the pointer.
    if (target === drag.lastTarget || !this.movedSinceSwap()) return;
    drag.lastTarget = target;
    this.swapTo(this.host.tiles().findIndex((t) => t.id === target));
  }

  private movedSinceSwap(): boolean {
    const drag = this.drag!;
    const pointer = this.pointer!;
    return Math.hypot(pointer.x - drag.swappedAt.x, pointer.y - drag.swappedAt.y) > SWAP_SLOP;
  }

  private swapTo(index: number): void {
    const drag = this.drag!;
    if (this.host.tiles()[index]?.id === drag.id) return;
    drag.swappedAt = { x: this.pointer!.x, y: this.pointer!.y };
    this.host.moveTile(drag.id, index, drag.id);
    // Its place moved; re-anchor it under the pointer before the frame is painted.
    this.host.afterRender(() => this.position());
  }

  private drop(): void {
    const id = this.drag!.id;
    this.host.announce(`${tileDefinition(id).title} dropped. ${this.positionText(id)}`);
    this.stop();
    this.settle(id);
  }

  /** Slides a dropped tile from where it was let go into its place. */
  private settle(id: TileId): void {
    const el = this.tile(id);
    if (!el) return;
    if (reducedMotion()) return this.clearStyles(el);
    el.style.transition = 'translate 0.24s cubic-bezier(0.2, 0, 0, 1)';
    el.style.translate = '0px 0px';
    const done = () => this.clearStyles(el);
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 320);
  }

  private clearStyles(el: HTMLElement | null): void {
    if (!el) return;
    el.style.removeProperty('translate');
    el.style.removeProperty('transition');
  }

  // ── Resizing ─────────────────────────────────────────────────

  private resizeToPointer(): void {
    const resize = this.resize;
    const pointer = this.pointer;
    const grid = this.host.grid();
    const el = resize && this.tile(resize.id);
    if (!resize || !pointer || !grid || !el) return;
    if (!resize.moved) {
      if (Math.hypot(pointer.x - resize.startX, pointer.y - resize.startY) < 4) return;
      resize.moved = true;
      this.resizing.set(resize.id);
    }

    const style = getComputedStyle(grid);
    const columns = style.gridTemplateColumns.split(' ').length;
    const gap = parseFloat(style.columnGap) || 0;
    const rowGap = parseFloat(style.rowGap) || 0;
    const origin = grid.getBoundingClientRect();
    const cell = (origin.width - gap * (columns - 1)) / columns;
    const row = (parseFloat(style.gridAutoRows.replace(/^minmax\(/, '')) || 150) + rowGap;
    // How many columns and rows the pointer asks for, counted from the tile's corner.
    const wantColumns = (pointer.x - (origin.left + el.offsetLeft) + gap / 2) / (cell + gap);
    const wantRows = (pointer.y - (origin.top + el.offsetTop) + rowGap / 2) / row;

    const current = this.host.tiles().find((t) => t.id === resize.id);
    if (!current) return;
    const size = nearestSize(
      tileDefinition(resize.id).sizes,
      current.size,
      wantColumns,
      wantRows,
      columns,
    );
    if (size !== current.size) this.host.resizeTile(resize.id, size);
  }

  private endResize(): void {
    const resize = this.resize!;
    if (!resize.moved) {
      // A tap on the grip steps to the next size, around to the smallest again.
      const sizes = tileDefinition(resize.id).sizes;
      const current = this.host.tiles().find((t) => t.id === resize.id)?.size;
      const next = sizes[(sizes.indexOf(current!) + 1) % sizes.length];
      this.host.resizeTile(resize.id, next);
    }
    this.stop();
  }

  // ── Shared ───────────────────────────────────────────────────

  private autoScroll(): void {
    const pointer = this.pointer;
    const el = this.drag ? this.tile(this.drag.id) : this.resize ? this.tile(this.resize.id) : null;
    if (!pointer || !el) return;
    const scroller = this.drag?.scroller ?? scrollParent(el);
    const bounds =
      scroller === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight }
        : scroller.getBoundingClientRect();
    const speed =
      pointer.y < bounds.top + SCROLL_EDGE
        ? -Math.ceil((bounds.top + SCROLL_EDGE - pointer.y) / 5)
        : pointer.y > bounds.bottom - SCROLL_EDGE
          ? Math.ceil((pointer.y - (bounds.bottom - SCROLL_EDGE)) / 5)
          : 0;
    if (speed !== 0) scroller.scrollBy(0, speed);
  }

  private stop(): void {
    if (this.pending) clearTimeout(this.pending.timer);
    cancelAnimationFrame(this.frame);
    this.unlisten();
    this.pending = null;
    this.drag = null;
    this.resize = null;
    this.pointer = null;
    this.lifted.set(null);
    this.resizing.set(null);
  }

  private tile(id: TileId): HTMLElement | null {
    return this.host.grid()?.querySelector<HTMLElement>(`[data-tile="${id}"]`) ?? null;
  }

  private positionText(id = this.drag?.id): string {
    const tiles = this.host.tiles();
    return `Position ${tiles.findIndex((t) => t.id === id) + 1} of ${tiles.length}.`;
  }
}

/**
 * The allowed size closest to the columns and rows the pointer asks for. The
 * current size wins near a boundary, so it doesn't flicker between two.
 */
export function nearestSize(
  sizes: readonly TileSize[],
  current: TileSize,
  wantColumns: number,
  wantRows: number,
  columns: number,
): TileSize {
  const score = (size: TileSize) => {
    const [c, r] = spans(size, columns);
    return Math.abs(c - wantColumns) + 0.8 * Math.abs(r - wantRows);
  };
  const best = [...sizes].sort((a, b) => score(a) - score(b))[0];
  return best !== current && score(best) < score(current) - 0.15 ? best : current;
}

/** Columns and rows a size covers in a grid with this many columns. */
export function spans(size: TileSize, columns: number): [number, number] {
  switch (size) {
    case 'small':
      return [1, 1];
    case 'medium':
      return [Math.min(2, columns), 1];
    case 'large':
      return [Math.min(2, columns), 2];
    case 'wide':
      return [columns, 1];
  }
}

export function reducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The element that scrolls the page around this one. */
export function scrollParent(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return document.scrollingElement as HTMLElement;
}
