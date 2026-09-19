import { poissonProbabilityAtLeast, weightedMean } from "./probability";

export type GoalModelInput = {
  seasonGoalsPerGame: number;
  recentGoalsPerGame: number;
  seasonShotsPerGame: number;
  recentShotsPerGame: number;
  opponentGoalsAllowedPerGame: number;
  powerPlayShare: number;
  expectedToiMinutes: number;
  homeAdjustment: number;
  restAdjustment: number;
};

export type GoalModelOutput = {
  expectedGoals: number;
  onePlus: number;
  twoPlus: number;
  threePlus: number;
  factors: string[];
};

export function runGoalModel(input: GoalModelInput): GoalModelOutput {
  const goalRate = weightedMean(input.recentGoalsPerGame, input.seasonGoalsPerGame);
  const shotRate = weightedMean(input.recentShotsPerGame, input.seasonShotsPerGame);
  const opponentAdjustment = Math.max(0.65, Math.min(1.35, input.opponentGoalsAllowedPerGame / 3));
  const roleAdjustment = Math.max(0.65, Math.min(1.35, input.powerPlayShare * 0.4 + input.expectedToiMinutes / 40));
  const expectedGoals = Math.max(
    0,
    goalRate * 0.45 +
      (shotRate * 0.08) * 0.35 +
      0.2 * opponentAdjustment * roleAdjustment +
      input.homeAdjustment +
      input.restAdjustment,
  );

  return {
    expectedGoals,
    onePlus: poissonProbabilityAtLeast(expectedGoals, 1),
    twoPlus: poissonProbabilityAtLeast(expectedGoals, 2),
    threePlus: poissonProbabilityAtLeast(expectedGoals, 3),
    factors: [
      `Weighted recent/season goal rate: ${goalRate.toFixed(2)}`,
      `Weighted recent/season shot rate: ${shotRate.toFixed(2)}`,
      `Opponent scoring environment adjustment: ${opponentAdjustment.toFixed(2)}`,
      `Usage and power-play adjustment: ${roleAdjustment.toFixed(2)}`,
    ],
  };
}