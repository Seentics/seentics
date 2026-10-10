import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { sessionColumns } from '@/components/replays/session-columns';

const opts = { websiteId: 'w1', onPlay: vi.fn(), onDelete: vi.fn() };

describe('sessionColumns readOnly', () => {
  it('has no selection column when read-only, and has one otherwise', () => {
    expect(sessionColumns({ ...opts, readOnly: true }).some(c => c.id === '__select__')).toBe(false);
    expect(sessionColumns({ ...opts, readOnly: false }).some(c => c.id === '__select__')).toBe(true);
    expect(sessionColumns(opts).some(c => c.id === '__select__')).toBe(true);
  });

  const renderActions = (readOnly: boolean) => {
    const col: any = sessionColumns({ ...opts, readOnly }).find(c => c.id === 'actions');
    const row = { original: { session_id: 's1' } };
    return render(<div>{col.cell({ row })}</div>);
  };

  it('read-only shows Watch but no delete', () => {
    const onPlay = vi.fn();
    opts.onPlay = onPlay;
    renderActions(true);
    expect(screen.queryByTitle('Delete session')).toBeNull();
    fireEvent.click(screen.getByTitle('Watch replay'));
    expect(onPlay).toHaveBeenCalledWith('s1');
  });

  it('editable shows a delete action that deletes the row', () => {
    const onDelete = vi.fn();
    opts.onDelete = onDelete;
    renderActions(false);
    fireEvent.click(screen.getByTitle('Delete session'));
    expect(onDelete).toHaveBeenCalledWith('s1');
  });
});
