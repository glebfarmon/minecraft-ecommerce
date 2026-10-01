import { render, screen } from '@testing-library/react';

import HomePage from './page';

describe('HomePage', () => {
  it('renders the shop heading and the shared ui button', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Minecraft Shop' })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Browse servers' });
    expect(button).toHaveAttribute('data-slot', 'button');
  });
});
