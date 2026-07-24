import { useEffect, useState } from 'react';
import type { CampaignBattleState, CampaignProgress, CoopPowerUpId } from './types';
import {
  startBattle, addDart, undoDart, setTarget, resolvePlayerVisit,
  activateCoopPowerUp,
  levelRewardPowerUp, getCoopClass,
} from './engine';
import { getChapter } from './campaignLevels';
import type { Player, Settings } from '../types';
import type { CardDef } from '../cards/types';
import { resolveCardDef } from '../cards/deck';
import { CardHand } from '../cards/CardHand';
import { initCardPlayState } from '../cards/deck';
import { Sound } from '../sound';
import type { MusicEngine } from '../music';
import { bumpCoopStat } from './coopStats';
import { DartOverlay } from './DartOverlay';
import { FrozenOverlay } from './FrozenOverlay';
import { Modal } from '../Popups';
import { getEnemyDef } from './engine/enemies';
import { EnemyList } from './shared/EnemyList';
import { PlayerChips } from './shared/PlayerChips';
import { PartyHpBar } from './shared/PartyHpBar';
import { DartKeypad } from './shared/DartKeypad';
import { PlayerTurnInfo } from './shared/PlayerTurnInfo';
import { useCardBattle } from './shared/useCardBattle';

// (CampaignBattle component body continues below — see full file for the rest)
