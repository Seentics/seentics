import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import {
  BoardView, CollectionPager, FilterToolbar, CollectionTable, GroupedRows, LayoutSwitch, useLayoutPreference,
} from '@/components/ui/collection';

type Person = { id: string; name: string; status: 'new' | 'won' };
const people: Person[] = [
  { id: 'a', name: 'Ava', status: 'new' },
  { id: 'b', name: 'Ben', status: 'won' },
  { id: 'c', name: 'Cy', status: 'new' },
];
const key = (p: Person) => p.id;

describe('LayoutSwitch', () => {
  it('offers the given layouts, marks the current one, and hides with only one', () => {
    const onChange = vi.fn();
    const { rerender } = render(<LayoutSwitch layouts={['list', 'board']} value="list" onChange={onChange} labels={{ board: 'Pipeline' }} />);
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Pipeline' }));
    expect(onChange).toHaveBeenCalledWith('board');

    rerender(<LayoutSwitch layouts={['table']} value="table" onChange={onChange} />);
    expect(screen.queryByRole('group', { name: 'Layout' })).toBeNull();
  });
});

describe('useLayoutPreference', () => {
  beforeEach(() => window.localStorage.clear());

  it('remembers the choice per page, and ignores a stored layout the page does not offer', () => {
    const { result } = renderHook(() => useLayoutPreference('people', ['list', 'table'] as const, 'list'));
    act(() => result.current[1]('table'));
    expect(window.localStorage.getItem('seentics:layout:v2:people')).toBe('table');

    const again = renderHook(() => useLayoutPreference('people', ['list', 'table'] as const, 'list'));
    expect(again.result.current[0]).toBe('table');

    window.localStorage.setItem('seentics:layout:v2:pages', 'board');
    const other = renderHook(() => useLayoutPreference('pages', ['list', 'table'] as const, 'list'));
    expect(other.result.current[0]).toBe('list');
  });
});

describe('GroupedRows', () => {
  it('puts items under their groups, skips empty ones, and folds a group', () => {
    render(
      <GroupedRows
        items={people}
        getKey={key}
        groups={[{ id: 'won', label: 'Won' }, { id: 'lost', label: 'Lost' }, { id: 'new', label: 'New', count: 12 }]}
        groupOf={(p) => p.status}
        renderRow={(p) => <span>{p.name}</span>}
      />,
    );
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Won', 'New']);
    // The server's count wins over the rows on this page.
    expect(within(screen.getByRole('region', { name: 'New' })).getByText('12')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /New/ }));
    expect(screen.queryByText('Ava')).toBeNull();
    expect(screen.getByText('Ben')).toBeTruthy();
  });
});

describe('CollectionTable', () => {
  it('draws the columns, opens a row, and selects rows without opening them', () => {
    const onOpen = vi.fn();
    const onChange = vi.fn();
    render(
      <CollectionTable
        label="People"
        items={people}
        getKey={key}
        columns={[{ id: 'name', header: 'Name', cell: (p) => p.name, sorted: true }, { id: 'status', header: 'Status', cell: (p) => p.status }]}
        onOpen={onOpen}
        selection={{ selected: new Set(['a']), onChange, labelOf: (id) => `person ${id}` }}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe('descending');
    fireEvent.click(screen.getByText('Ben'));
    expect(onOpen).toHaveBeenCalledWith(people[1]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select person c' }));
    expect(onChange).toHaveBeenCalledWith(['c'], true);
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b', 'c'], true);
  });
});

describe('BoardView', () => {
  it('lays cards out in their columns and moves one on drop', () => {
    const onMove = vi.fn();
    render(
      <BoardView
        items={people}
        getKey={key}
        columns={[{ id: 'new', label: 'New' }, { id: 'won', label: 'Won' }]}
        columnOf={(p) => p.status}
        renderCard={(p) => <span>{p.name}</span>}
        onMove={onMove}
      />,
    );
    const won = screen.getByRole('region', { name: 'Won' });
    expect(within(screen.getByRole('region', { name: 'New' })).getAllByRole('listitem')).toHaveLength(2);

    const data = new Map<string, string>();
    const dataTransfer = { setData: (t: string, v: string) => data.set(t, v), getData: (t: string) => data.get(t) ?? '', effectAllowed: '' };
    fireEvent.dragStart(screen.getByText('Ava').closest('li')!, { dataTransfer });
    fireEvent.drop(won, { dataTransfer });
    expect(onMove).toHaveBeenCalledWith(people[0], 'won');

    // Dropping back into its own column is not a move.
    fireEvent.dragStart(screen.getByText('Ben').closest('li')!, { dataTransfer });
    fireEvent.drop(won, { dataTransfer });
    expect(onMove).toHaveBeenCalledTimes(1);
  });
});

describe('CollectionPager', () => {
  it('says which rows are shown and stops at the ends', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CollectionPager page={0} pageSize={50} total={120} onChange={onChange} />);
    expect(screen.getByText('1–50 of 120')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onChange).toHaveBeenCalledWith(1);

    rerender(<CollectionPager page={0} pageSize={50} total={30} onChange={onChange} />);
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
  });
});

describe('FilterToolbar', () => {
  const field = (id: string, value: string, onChange = vi.fn()) => ({
    id, label: id === 'status' ? 'Status' : 'Tag', value, onChange,
    options: [{ value: 'customer', label: 'Customer' }, { value: 'vip', label: 'vip' }],
  });

  it('shows applied filters as chips that remove themselves, and offers the rest', () => {
    const onStatus = vi.fn();
    const onSearch = vi.fn();
    render(
      <FilterToolbar
        sort={{ value: 'recent', onChange: vi.fn(), options: [{ value: 'recent', label: 'Recent activity' }] }}
        filters={[field('status', 'customer', onStatus), field('tag', '')]}
        search={{ value: '', onChange: onSearch, label: 'Search people' }}
        count="3 people"
      >
        <button type="button">Right side</button>
      </FilterToolbar>,
    );
    expect(screen.getByRole('button', { name: /Sorted by\s*Recent activity/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change Status: Customer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add filter/ })).toBeTruthy();
    expect(screen.getByText('3 people')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Right side' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Status is Customer' }));
    expect(onStatus).toHaveBeenCalledWith('');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search people' }), { target: { value: 'ava' } });
    expect(onSearch).toHaveBeenCalledWith('ava');
  });

  it('has no chips or "Add filter" while nothing is applied', () => {
    render(<FilterToolbar filters={[field('status', ''), field('tag', '')]} />);
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add filter/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove filter/ })).toBeNull();
  });
});
