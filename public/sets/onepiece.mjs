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
 * A fifth field is absent for a third reason: `raffleRange` appears in the
 * prototype's own Game sheet and in #21's table, but not in `## Input:
 * Settings` of #46 and not in the SetupLink key register of #48. It belongs to
 * the WinnerRaffle and arrives with Spec 2; until then it is no Settings field
 * and therefore no sheet entry.
 *
 * The values are transcribed from the resolution comments of #21 (Game and
 * weekend, with the full sheet as a table) and #25 (release). Both say in so
 * many words that they are written down there so the next session reads them
 * back instead of computing them from plan numbers — the drift that made #20
 * and #21's body come out wrong.
 *
 * `TOURNAMENT_TYPES` is a list, not an object: its order is meaningful (ADR
 * 0003) and is not a surface sort. Each entry carries only its deviation from
 * `GAME` — the first entry is the starting choice and carries nothing besides
 * its title, so its values are the Game's.
 */

export const GAME = {
  players: 32,
  boosterRate: 3,
  envelopeSize: 9,
  envelopeYield: 1,
  displaySize: 24,
  participationBooster: 2,
  participationPack: 1,
  judgeBooster: 0,
  judgeWinner: 0,
  rankFloor: 2,
  depthStep: 'top8',
  curve: 'mild',
  combinedHandout: false,
};

export const TOURNAMENT_TYPES = [
  { id: 'weekly', title: 'Weekly' },
  { id: 'weekend', title: 'Weekend', participationBooster: 1, curve: 'steep' },
  {
    id: 'release',
    title: 'Release',
    boosterRate: 9,
    participationBooster: 6,
    envelopeSize: 32,
    envelopeYield: 2,
    depthStep: 'all',
    curve: 'gentle',
  },
];
