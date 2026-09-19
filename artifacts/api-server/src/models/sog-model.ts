import { poissonProbabilityAtLeast, weightedMean } from "./probability";

export type SogModelInput = {
  seasonSogPerGame: number;
  lastFiveSogPerGame: number;
  lastTenSogPerGame: number;
  opponentSogAllowed: number;
  teamShotGeneration: number;
  expectedToiMinutes: number;
  ppToiMinutes: number;
  paceAdjustment: number;
};

export type SogModelOutput = {
  projectedSog: number;
  threePlus: number;
  fourPlus: number;
  fivePlus: number;
  sixPlus: number;
};

export function runSogModel(input: SogModelInput): SogModelOutput {
  const recent = weightedMean(input.lastFiveSogPerGame, input.lastTenSogPerGame, 0.55);
  const playerRate = weightedMean(recent, input.seasonSogPerGame, 0.6);
  const defenseAdjustment = Math.max(0.7, Math.min(1.3, input.opponentSogAllowed / 31));
  const roleAdjustment = Math.max(0.7, Math.min(1.35, input.expectedToiMinutes / 18 + input.ppToiMinutes / 12));
  const projectedSog = Math.max(
    0,
    playerRate * defenseAdjustment * roleAdjustment * Math.max(0.75, input.paceAdjustment) +
      input.teamShotGeneration * 0.02,
  );

  return {
    projectedSog,
    threePlus: poissonProbabilityAtLeast(projectedSog, 3),
    fourPlus: poissonProbabilityAtLeast(projectedSog, 4),
    fivePlus: poissonProbabilityAtLeast(projectedSog, 5),
    sixPlus: poissonProbabilityAtLeast(projectedSog, 6),
  };
}