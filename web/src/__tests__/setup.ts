import '@testing-library/jest-dom';

/**
 * Browser APIs jsdom does not implement, stubbed for the components that need them.
 *
 * ReactFlow measures its container on mount, so without `ResizeObserver` the automation
 * canvas throws before it renders a single node. The stub does not need to report sizes
 * — nothing under test asserts on layout geometry, which is the renderer's job and is
 * covered by the layout unit tests instead.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

if (!('DOMMatrixReadOnly' in globalThis)) {
  // ReactFlow reads the canvas transform through this; an identity matrix is enough.
  (globalThis as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
    constructor(_transform?: string) {}
  };
}
