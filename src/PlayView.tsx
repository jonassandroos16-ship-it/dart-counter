import { useEffect, useMemo, useState } from 'react';
import type { Game, GamePlayer, GameRecord, Player, Settings } from './types';
import { MODES, ATC_TARGETS, atcLabel, BUILTIN_TITLES, buildTitleCheck, getTitleInfo, SCORE_POPUPS, MILESTONES, TEAM_COLORS, TEAM_NAMES, showdownBgFor } from './constants';
