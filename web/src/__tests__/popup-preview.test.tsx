import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PopupPreview, stripOwnerCode } from '@/components/automations/popup/PopupPreview';
import { applyLayout, type PopupAction } from '@/lib/popup-config';

beforeEach(() => {
  vi.useFakeTimers();
  document.head.querySelector('#snc-styles')?.remove();
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const flush = () => act(() => { vi.advanceTimersByTime(200); });
const host = () => screen.getByTestId('popup-preview');

describe('stripOwnerCode', () => {
  it('removes custom HTML, CSS and JS and reports that it did', () => {
    const { safe, stripped } = stripOwnerCode({ type: 'show_modal', title: 'x', custom_html: '<img onerror=x>', custom_css: 'a{}', custom_js: 'alert(1)' });
    expect(safe).toEqual({ type: 'show_modal', title: 'x' });
    expect(stripped).toBe(true);
  });
  it('reports nothing stripped when there was no custom code', () => {
    expect(stripOwnerCode({ type: 'show_modal', custom_js: '  ' }).stripped).toBe(false);
  });
});

describe('PopupPreview', () => {
  it('renders the real spin wheel into its own container', async () => {
    const action = applyLayout({ type: 'show_modal', title: 'Spin!' } as PopupAction, 'spin_wheel');
    render(<PopupPreview action={action} />);
    await flush();
    expect(host().querySelectorAll('.snc-wheel-label').length).toBe(action.wheel!.segments.length);
    expect(host().classList.contains('snc-contained')).toBe(true);
    // Nothing leaks onto the page around the builder.
    expect(document.body.querySelector(':scope > .snc-overlay')).toBeNull();
  });

  it('never runs the owner’s custom code in the dashboard', async () => {
    (window as unknown as Record<string, unknown>).__ran = false;
    render(<PopupPreview action={{ type: 'show_modal', title: 'x', custom_js: 'window.__ran = true', custom_html: '<img src=x onerror="window.__ran=true">' }} />);
    await flush();
    expect((window as unknown as Record<string, unknown>).__ran).toBe(false);
    expect(host().querySelector('.snc-modal h2')?.textContent).toBe('x');
    expect(screen.getByText(/not previewed/)).toBeTruthy();
  });

  it('follows edits and renders a bar for a banner', async () => {
    const { rerender } = render(<PopupPreview action={{ type: 'show_modal', title: 'First' }} />);
    await flush();
    expect(host().querySelector('h2')?.textContent).toBe('First');
    rerender(<PopupPreview action={{ type: 'show_modal', title: 'Second' }} />);
    await flush();
    expect(host().querySelector('h2')?.textContent).toBe('Second');
    expect(host().querySelectorAll('.snc-overlay')).toHaveLength(1);

    rerender(<PopupPreview action={{ type: 'show_banner', message: 'Flash sale' }} />);
    await flush();
    expect(host().querySelector('.snc-banner')?.textContent).toContain('Flash sale');
    expect(host().querySelector('.snc-overlay')).toBeNull();
  });

  it('switches between desktop and mobile widths and does not navigate on link clicks', async () => {
    render(<PopupPreview action={{ type: 'show_modal', title: 'x', button_text: 'Go', button_url: 'https://example.com' }} />);
    await flush();
    fireEvent.click(screen.getByLabelText('Mobile preview'));
    await flush();
    expect(screen.getByLabelText('Mobile preview').getAttribute('aria-pressed')).toBe('true');
    const link = host().querySelector('a.snc-modal-btn') as HTMLAnchorElement;
    expect(fireEvent.click(link)).toBe(false); // default prevented
  });
});
