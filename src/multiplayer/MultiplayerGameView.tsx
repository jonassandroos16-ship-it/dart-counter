import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Game, GameRecord, Settings } from '../types';
import type { Lobby, LobbyPlayer } from './client';
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
  }) => React.ReactNode;
}

function popupToBroadcast(type: keyof PopupState, value: any, game: Game): { type: string; playerId: string; data: any } | null {
  if (!value) return null;
  const currentPlayer = game.players[game.turn];
  const playerId = currentPlayer?.id || '';
  return { type, playerId, data: value };
}

export function MultiplayerGameView({
  lobby, lobbyPlayers, game, settings, isHost, popups,
  onGameUpdate, onGameOver, renderBoard,
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
    onGameUpdate(next);
    if (isHost) {
      void updateGameState(lobby.id, next);
    }
  }, [isHost, lobby.id, onGameUpdate]);

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

  return (
    <div style={{ position: 'relative' }}>
      {renderBoard({ game, setGame, isMyTurn: myTurn, popups: wrappedPopups })}
      {!myTurn && !game.finished && (
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
