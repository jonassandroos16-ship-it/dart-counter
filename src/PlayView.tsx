import { useEffect, useState } from 'react';
import type { Game, GameRecord, Player, Settings } from './types';
import { createGame } from './logic';
import { Sound } from './sound';
import type { MusicEngine } from './music';
import type { PopupControls } from './Popups';
import { SetupView } from './play/SetupView';
import { ModeSelectView } from './play/ModeSelectView';
import { Showdown } from './play/Showdown';
import { X01Board } from './play/boards/X01Board';
import { AtcBoard } from './play/boards/AtcBoard';
import { KillerBoard } from './play/boards/KillerBoard';
import { HighScoreBoard } from './play/boards/HighScoreBoard';
import { BattleBoard } from './play/boards/BattleBoard';
import { CardBoard } from './play/boards/CardBoard';
import { ChapterSelect } from './campaign/ChapterSelect';
import { CampaignMap } from './campaign/CampaignMap';
import { CampaignBattle } from './campaign/CampaignBattle';
import { CoopSetupView } from './campaign/CoopSetupView';
import { useCampaignProgress } from './campaign/progress';
import { getCoopPowerUp, coopXpForBattle, defaultCoopProgress, recordLevelClearForPlayer, reconcileCoopPassivesForPlayer } from './campaign/engine';
import { levelFromXP } from './logic';
import { cardsForLevelUp, addCard, defaultPlayerCards } from './cards/deck';
import { getChapter, isChapterComplete } from './campaign/campaignLevels';
import type { CoopPowerUpId, CampaignBattleState, CampaignChapter } from './campaign/types';
import { DartliteSetup } from './dartlite/DartliteSetup';
import { DartliteBattle } from './dartlite/DartliteBattle';
import {
  startRun, beginRound, resolveBattle,
  type DartliteRun,
} from './dartlite/engine';
import { DartliteGameOver } from './dartlite/DartliteGameOver';

interface Props {
  players: Player[];
  games: GameRecord[];
  settings: Settings;
  activeGame: Game | null;
  setActiveGame: (updater: any) => void;
  setGames: (updater: any) => void;
  setPlayers: (updater: any) => void;
