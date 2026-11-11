import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAUNCHER_KEY, Launcher, launcherShare, launcherTop } from './Launcher';

function fakeStorage(start: Record<string, unknown> = {}) {
  const store = { ...start };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (k: string) => (k in store ? { [k]: store[k] } : {})),
        set: vi.fn(async (o: Record<string, unknown>) => void Object.assign(store, o)),
      },
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
  });
  return store;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the launcher tab', () => {
  it('keeps inside the window', () => {
    expect(launcherTop(0.4, 1000)).toBe(400);
    expect(launcherTop(0, 1000)).toBe(8);
    expect(launcherTop(1, 1000)).toBe(1000 - 58 - 8);
    expect(launcherShare(250, 1000)).toBe(0.25);
    expect(launcherShare(-40, 1000)).toBe(0);
  });

  it('opens on a click', async () => {
    fakeStorage();
    const onOpen = vi.fn();
    render(<Launcher onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show the Wera panel' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('moves up and down when dragged, without opening, and keeps where it was put', async () => {
    const store = fakeStorage();
    const onOpen = vi.fn();
    window.innerHeight = 1000;
    render(<Launcher onOpen={onOpen} />);
    const tab = screen.getByRole('button', { name: 'Show the Wera panel' });
    expect(tab.parentElement!.style.top).toBe('400px');
    fireEvent.pointerDown(tab, { button: 0, clientY: 420 });
    fireEvent.pointerMove(tab, { clientY: 300 });
    fireEvent.pointerMove(tab, { clientY: 220 });
    expect(tab.parentElement!.style.top).toBe('200px');
    fireEvent.pointerUp(tab, { clientY: 220 });
    fireEvent.click(tab, { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    expect(tab.parentElement!.style.top).toBe('200px');
    expect(store[LAUNCHER_KEY]).toBe(0.2);
  });

  it('starts where the user put it last', async () => {
    fakeStorage({ [LAUNCHER_KEY]: 0.7 });
    window.innerHeight = 1000;
    render(<Launcher onOpen={() => {}} />);
    const tab = screen.getByRole('button', { name: 'Show the Wera panel' });
    await act(async () => {});
    expect(tab.parentElement!.style.top).toBe('700px');
  });

  it('moves with the arrow keys', async () => {
    const store = fakeStorage();
    window.innerHeight = 1000;
    render(<Launcher onOpen={() => {}} />);
    const tab = screen.getByRole('button', { name: 'Show the Wera panel' });
    fireEvent.keyDown(tab, { key: 'ArrowDown' });
    expect(tab.parentElement!.style.top).toBe('430px');
    fireEvent.keyDown(tab, { key: 'ArrowUp', shiftKey: true });
    expect(tab.parentElement!.style.top).toBe('330px');
    expect(store[LAUNCHER_KEY]).toBe(0.33);
  });
});

describe('hiding the launcher', () => {
  it('offers to hide it until the next visit, on this site, or everywhere', async () => {
    fakeStorage();
    const onHide = vi.fn();
    render(<Launcher onOpen={() => {}} onHide={onHide} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hide Wera' }));
    const items = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(items).toEqual(['Hide until next visit', 'Hide on this site', 'Hide on all sites']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hide on this site' }));
    expect(onHide).toHaveBeenCalledWith('site');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
