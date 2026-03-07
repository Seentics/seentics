import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotFound from '@/app/not-found';
import GlobalError from '@/app/error';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('Not Found Page (404)', () => {
  it('should render 404 text', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('should have a link to dashboard', () => {
    render(<NotFound />);
    const dashboardLink = screen.getByText('Dashboard');
    expect(dashboardLink.closest('a')).toHaveAttribute('href', '/websites');
  });

  it('should have a link to home', () => {
    render(<NotFound />);
    const homeLink = screen.getByText('Home');
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');
  });
});

describe('Global Error Page', () => {
  it('should render error message', () => {
    const mockError = new Error('Test error') as Error & { digest?: string };
    const mockReset = vi.fn();

    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should call reset when try again is clicked', () => {
    const mockError = new Error('Test error') as Error & { digest?: string };
    const mockReset = vi.fn();

    render(<GlobalError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(mockReset).toHaveBeenCalledOnce();
  });

  it('should show error digest when available', () => {
    const mockError = Object.assign(new Error('Test'), { digest: 'abc123' });
    const mockReset = vi.fn();

    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText('Error ID: abc123')).toBeInTheDocument();
  });

  it('should have dashboard link', () => {
    const mockError = new Error('Test') as Error & { digest?: string };
    const mockReset = vi.fn();

    render(<GlobalError error={mockError} reset={mockReset} />);
    const link = screen.getByText('Dashboard');
    expect(link.closest('a')).toHaveAttribute('href', '/websites');
  });
});
