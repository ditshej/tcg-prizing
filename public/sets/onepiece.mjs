/**
 * The DefaultSet sheets for One Piece: data, never logic (ADR 0003). A sheet
 * entry is a constant or the choice of a named rule from the core — a
 * DistributionCurve step, a RaffleRange step — never a formula of its own.
 *
 * `GAME` is the complete sheet: every presettable Settings field from #46
 * (`## Input: Settings`) has a value here, the expected player count
 * included. It never presets anything that names a Rank — `displays` and the
 * `manual` share of the WinnerPackAllocation always start neutral, so they
 * have no place on any sheet, Game or TournamentType. The four trailing
 * sliders (`tournamentPacks`, `depth`, `ranked`, `winnerPacks`) are absent for
 * the same reason from the other side: their starting value is a calculation
 * the core makes, not sheet data.
 *
 * `TOURNAMENT_TYPES` is a list, not an object: its order is meaningful (ADR
 * 0003) and is not a surface sort. Each entry carries only its deviation from
 * `GAME` — the first entry is the starting choice and carries nothing besides
 * its title, so its values are the Game's.
 */

export const GAME = {
  players: 8,
  boosterRate: 2,
  envelopeSize: 24,
  envelopeYield: 1,
  displaySize: 24,
  participationBooster: 1,
  participationPack: 0,
  judgeBooster: 0,
  judgeWinner: 0,
  rankFloor: 2,
  depthStep: 'top8',
  curve: 'steep',
  combinedHandout: false,
};

export const TOURNAMENT_TYPES = [
  { id: 'weekly', title: 'Weekly' },
  { id: 'weekend', title: 'Weekend', players: 32, boosterRate: 3 },
  {
    id: 'release',
    title: 'Release',
    players: 64,
    boosterRate: 4,
    envelopeSize: 36,
    envelopeYield: 2,
    depthStep: 'all',
    curve: 'mild',
    combinedHandout: true,
  },
];
