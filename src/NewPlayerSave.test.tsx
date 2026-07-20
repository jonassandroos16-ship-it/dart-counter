import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';

// Regression: clicking "+ Add Player" creates a player with an empty name,
// then Save in the edit modal patches the name. The onClose handler used to
// check the stale `editing.name` snapshot (still '' after saveNew patched
// the player) and removed the just-saved player from the store — so the
// player vanished from the list and never reached the server on sync.
describe('Players — new player save flow', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('dc_games', '[]');
    localStorage.setItem('dc_settings', JSON.stringify({}));
  });

  it('saving a new player keeps it in the list and localStorage', () => {
    render(<App />);

    fireEvent.click(screen.getByText('Players'));
    fireEvent.click(screen.getByText('+ Add Player'));

    // Type a name in the basic tab's Name field
    const nameInput = screen.getByPlaceholderText('e.g. Jonas') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Jonas' } });

    // Click Save — this used to delete the player via the stale onClose check
    act(() => {
      fireEvent.click(screen.getByText('Save'));
    });

    // The player should still be in localStorage
    const stored = JSON.parse(localStorage.getItem('dc_players') || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('Jonas');

    // And visible in the rendered list
    expect(screen.getByText('Jonas')).toBeTruthy();
  });

  it('closing the modal without a name discards the empty player', () => {
    render(<App />);

    fireEvent.click(screen.getByText('Players'));
    fireEvent.click(screen.getByText('+ Add Player'));

    // Cancel without entering a name — the placeholder player should be removed
    act(() => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    const stored = JSON.parse(localStorage.getItem('dc_players') || '[]');
    expect(stored.length).toBe(0);
  });
});
