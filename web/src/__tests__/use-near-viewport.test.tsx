import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useNearViewport } from '@/hooks/use-near-viewport';

let observed: Element[] = [];
let trigger: (() => void) | null = null;

beforeEach(() => {
  observed = [];
  trigger = null;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
    observe(el: Element) { observed.push(el); trigger = () => this.cb([{ isIntersecting: true }]); }
    disconnect() {}
  });
});
afterEach(() => vi.unstubAllGlobals());

function Harness({ onNear }: { onNear: (near: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
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
});
