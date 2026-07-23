import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Target, Layers } from 'lucide-react';
import type { Game, GameRecord, Settings } from '../types';
import type { Lobby, LobbyPlayer, MultiplayerGameMode } from './client';
import { updateGameState, setPopupState, ownsPlayer, isMyTurn } from './client';
import type { PopupControls, PopupState } from '../Popups';
import { MilestonePopup, LevelUpPopup, TitleUnlockPopup, KillPopup, FrozenPopup, ShieldBlockedPopup } from '../Popups';
import { recordFromGame } from '../logic';

interface Props {
  lobby: Lobby;
  lobbyPlayers: LobbyPlayer[];
  game: Game;
  settings: Settings;
  isHost: boolean;
  popups: PopupControls;
  onGameUpdate: (game: Game) => void;
  onGameOver: (record: GameRecord) => void;
  renderBoard: (props: {
    game: Game;
    setGame: (g: Game | null) => void;
    isMyTurn: boolean;
    popups: PopupControls;
    gameMode: MultiplayerGameMode;
  }) => React.ReactNode;
  gameMode: MultiplayerGameMode;
}

function popupToBroadcast(type: keyof PopupState, value: any, game: Game): { type: string; playerId: string; data: any } | null {
  if (!value) return null;
  const currentPlayer = game.players[game.turn];
  const playerId = currentPlayer?.id || '';
  return { type, playerId, data: value };
}

export function MultiplayerGameView({
  lobby, lobbyPlayers, game, settings, isHost, popups,
  onGameUpdate, onGameOver, renderBoard, gameMode,
}: Props) {
  const [remotePopup, setRemotePopup] = useState<{ type: string; playerId: string; data: any } | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const recordedRef = useRef(false);

  useEffect(() => {
    if (game.finished && !recordedRef.current && isHost) {
      recordedRef.current = true;
      const record = recordFromGame(game);
      onGameOver(record);
    }
  }, [game.finished, isHost, game, onGameOver]);

  const setGame = useCallback((next: Game | null) => {
    if (!next) return;
    // Only the player whose turn it is can mutate the game state.
    if (!isMyTurn(lobbyPlayers, next)) return;
    onGameUpdate(next);
    if (isHost) {
      void updateGameState(lobby.id, next);
    }
  }, [isHost, lobby.id, onGameUpdate, lobbyPlayers]);

  const wrappedPopups: PopupControls = useMemo(() => {
    if (isHost) {
      const wrap = <K extends keyof PopupState>(key: K, setter: (v: PopupState[K]) => void) =>
        (v: PopupState[K]) => {
          setter(v);
          const broadcast = popupToBroadcast(key, v, gameRef.current);
          void setPopupState(lobby.id, broadcast);
        };
      return {
        setMilestone: wrap('milestone', popups.setMilestone),
        setLevelUp: wrap('levelUp', popups.setLevelUp),
        setTitleUnlock: wrap('titleUnlock', popups.setTitleUnlock),
        setKill: wrap('kill', popups.setKill),
        setFrozen: wrap('frozen', popups.setFrozen),
        setShieldBlocked: wrap('shieldBlocked', popups.setShieldBlocked),
      };
    }
    return {
      setMilestone: () => {},
      setLevelUp: () => {},
      setTitleUnlock: () => {},
      setKill: () => {},
      setFrozen: () => {},
      setShieldBlocked: () => {},
    };
  }, [isHost, popups, lobby.id]);

  useEffect(() => {
    setRemotePopup(lobby.popup_state || null);
  }, [lobby.popup_state]);

  const activePopup = isHost ? null : remotePopup;
  const canDismissPopup = activePopup ? ownsPlayer(lobbyPlayers, activePopup.playerId) : false;

  const dismissPopup = useCallback(() => {
    if (!canDismissPopup) return;
    setRemotePopup(null);
    if (isHost) {
      void setPopupState(lobby.id, null);
    }
  }, [canDismissPopup, isHost, lobby.id]);

  const myTurn = isMyTurn(lobbyPlayers, game);

  // Dynamically set the browser tab favicon to indicate which game mode the
  // host has selected for this lobby.
  useEffect(() => {
    const svg = gameMode === 'cards'
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1a1d24"/><rect x="6" y="4" width="14" height="20" rx="3" fill="#e8c55a" transform="rotate(-12 13 14)"/><rect x="12" y="8" width="14" height="20" rx="3" fill="#5b8def" transform="rotate(12 19 18)"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1a1d24"/><circle cx="16" cy="16" r="12" fill="none" stroke="#e8c55a" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#e8c55a"/><line x1="16" y1="4" x2="16" y2="28" stroke="#e8c55a" stroke-width="1.5"/><line x1="4" y1="16" x2="28" y2="16" stroke="#e8c55a" stroke-width="1.5"/></svg>';
    const url = 'data:image/svg+xml,' + encodeURIComponent(svg);
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    const prevHref = link.href;
    link.href = url;
    return () => { link!.href = prevHref; };
  }, [gameMode]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        borderRadius: 20, background: 'var(--bg-2)', border: '1px solid var(--border)',
        fontSize: 12, fontWeight: 700, color: 'var(--muted)', pointerEvents: 'none',
      }}>
        {gameMode === 'cards' ? <Layers size={14} /> : <Target size={14} />}
        {gameMode === 'cards' ? 'Card Mode' : 'Board Mode'}
      </div>
      {renderBoard({ game, setGame, isMyTurn: myTurn, popups: wrappedPopups, gameMode })}
      {!myTurn && !game.finished && gameMode !== 'cards' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.45)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{
            background: 'var(--bg-2)', borderRadius: 16, padding: '20px 28px',
            textAlign: 'center', border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Waiting for {game.players[game.turn]?.name || 'player'}…</div>
            <div className="muted small" style={{ marginTop: 4 }}>It's their turn on another device</div>
          </div>
        </div>
      )}
      {activePopup && activePopup.type === 'milestone' && (
        <MilestonePopup {...activePopup.data} onDone={dismissPopup} settings={settings} />
      )}
      {activePopup && activePopup.type === 'levelUp' && (
        <LevelUpPopup {...activePopup.data} onDone={dismissPopup} settings={settings} />
      )}
      {activePopup && activePopup.type === 'titleUnlock' && (
        <TitleUnlockPopup {...activePopup.data} onDone={dismissPopup} settings={settings} />
      )}
      {activePopup && activePopup.type === 'kill' && (
        <KillPopup {...activePopup.data} onDone={dismissPopup} settings={settings} />
      )}
      {activePopup && activePopup.type === 'frozen' && (
        <FrozenPopup {...activePopup.data} onDone={dismissPopup} settings={settings} />
      )}
      {activePopup && activePopup.type === 'shieldBlocked' && (
        <ShieldBlockedPopup {...activePopup.data} onDone={dismissPopup} settings={settings} />
      )}
    </div>
  );
}
