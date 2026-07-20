import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';

// Test the full App flow: reconcile effect + spend on health
describe('App — spend on health with reconcile effect', () => {
  it('spending on Health is not reverted by the reconcile effect', () => {
    // Seed localStorage with a level-3 player who has 10 attribute points
    const players = [{
      id: 'p1', name: 'Test', color: '#22c55e',
      level: 3, xp: 250,
      attributes: { health: 300, armor: 0, power: 0, pointsAvailable: 10 },
    }];
    localStorage.setItem('dc_players', JSON.stringify(players));
    localStorage.setItem('dc_games', '[]');
    localStorage.setItem('dc_settings', JSON.stringify({}));

    const { unmount } = render(<App />);

    // Navigate to Players view
    fireEvent.click(screen.getByText('Players'));

    // Open the Edit modal for the player
    fireEvent.click(screen.getByText('Edit'));

    // Go to Stats tab (inside the modal tabbar)
    const tabbar = document.querySelector('.tabbar-scroll') || document.querySelector('.tabbar');
    const statsTab = Array.from(tabbar!.querySelectorAll('button')).find(b => (b.textContent || '').includes('Stats'))!;
    fireEvent.click(statsTab);

    // Find the Health spend button
    const healthBtn = screen.getByText('+ Spend 1 point on Health') as HTMLButtonElement;
    expect(healthBtn.disabled).toBe(false);

    // Click it
    act(() => {
      fireEvent.click(healthBtn);
    });

    // Read the stored players from localStorage
    const stored = JSON.parse(localStorage.getItem('dc_players') || '[]');
    expect(stored[0].attributes.health).toBe(325);
    expect(stored[0].attributes.pointsAvailable).toBe(9);

    unmount();
  });

  it('player with XP but no cached level field can spend on Health (the bug fix)', () => {
    // Player has 250 XP (level 3) but the cached `level` field is missing —
    // before the fix, AttributesTab used `player.level ?? 1` → 0 points → button disabled.
    const players = [{
      id: 'p1', name: 'Veteran', color: '#22c55e',
      xp: 250,
      attributes: { health: 300, armor: 0, power: 0, pointsAvailable: 10 },
    }];
    localStorage.setItem('dc_players', JSON.stringify(players));
    localStorage.setItem('dc_games', '[]');
    localStorage.setItem('dc_settings', JSON.stringify({}));

    const { unmount } = render(<App />);

    fireEvent.click(screen.getByText('Players'));
    fireEvent.click(screen.getByText('Edit'));
    const tabbar = document.querySelector('.tabbar-scroll') || document.querySelector('.tabbar');
    const statsTab = Array.from(tabbar!.querySelectorAll('button')).find(b => (b.textContent || '').includes('Stats'))!;
    fireEvent.click(statsTab);

    const healthBtn = screen.getByText('+ Spend 1 point on Health') as HTMLButtonElement;
    // With the fix, level is derived from XP (250 → level 3 → 10 points) → button enabled.
    expect(healthBtn.disabled).toBe(false);

    act(() => { fireEvent.click(healthBtn); });

    const stored = JSON.parse(localStorage.getItem('dc_players') || '[]');
    expect(stored[0].attributes.health).toBe(325);
    expect(stored[0].attributes.pointsAvailable).toBe(9);

    unmount();
  });
});
