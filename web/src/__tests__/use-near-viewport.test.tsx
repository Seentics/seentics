import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { StrictMode, useRef, useState } from 'react';
import { useNearViewport } from '@/hooks/use-near-viewport';

let observed: Element[] = [];
let trigger: (() => void) | null = null;

beforeEach(() => {
  observed = [];
  trigger = null;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
    private live = true;
    observe(el: Element) { observed.push(el); trigger = () => { if (this.live) this.cb([{ isIntersecting: true }]); }; }
    disconnect() { this.live = false; }
  });
});
afterEach(() => vi.unstubAllGlobals());

function Harness({ onNear, startMounted = false }: { onNear: (near: boolean) => void; startMounted?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(startMounted);
  const near = useNearViewport(ref);
  onNear(near);
  return (
    <>
      <button onClick={() => setMounted(true)}>mount</button>
      {mounted && <div ref={ref} data-testid="target" />}
    </>
  );
}

describe('useNearViewport', () => {
  it('starts watching an element that mounts after the first render', () => {
    let near = false;
    const { getByText } = render(<Harness onNear={(n) => { near = n; }} />);
    expect(observed).toHaveLength(0);
    act(() => { getByText('mount').click(); });
    expect(observed).toHaveLength(1);
    act(() => { trigger?.(); });
    expect(near).toBe(true);
  });

  // React unmounts and remounts effects in Strict Mode (and on Fast Refresh). The cleanup
  // disconnected the observer but kept the element recorded, so the remount skipped
  // re-attaching and nothing ever fired: an embed's lower sections never loaded.
  it('still fires after React remounts its effects', () => {
    let near = false;
    // Mounted from the first render, as the overview's section is: that is when the remount happens.
    render(<StrictMode><Harness startMounted onNear={(n) => { near = n; }} /></StrictMode>);
    act(() => { trigger?.(); });
    expect(near).toBe(true);
  });
});
