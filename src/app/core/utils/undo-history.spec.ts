import { UndoHistory } from './undo-history';

describe('UndoHistory', () => {
  const history = () => new UndoHistory<string>('a', (x, y) => x === y, 3);

  it('undoes and redoes finished changes in order', () => {
    const h = history();
    h.record('b');
    h.record('c');
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe('b');
    expect(h.redo()).toBe('c');
    expect(h.redo()).toBeNull();
  });

  it('ignores records that change nothing', () => {
    const h = history();
    expect(h.record('a')).toBe(false);
    expect(h.canUndo()).toBe(false);
  });

  it('drops what could be redone once something new happens', () => {
    const h = history();
    h.record('b');
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.record('x');
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBe('a');
  });

  it('keeps only the most recent steps', () => {
    const h = history();
    ['b', 'c', 'd', 'e'].forEach((s) => h.record(s));
    expect(h.undo()).toBe('d');
    expect(h.undo()).toBe('c');
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBeNull();
  });

  it('starts over on reset', () => {
    const h = history();
    h.record('b');
    h.reset('z');
    expect(h.canUndo()).toBe(false);
    h.record('y');
    expect(h.undo()).toBe('z');
  });
});
