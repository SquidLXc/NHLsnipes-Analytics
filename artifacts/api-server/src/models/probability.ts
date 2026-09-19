export function poissonProbabilityAtLeast(lambda: number, threshold: number): number {
  if (!Number.isFinite(lambda) || lambda < 0 || !Number.isInteger(threshold) || threshold < 0) {
    throw new Error("Invalid Poisson input");
  }

  let cumulative = 0;
  let probabilityMass = Math.exp(-lambda);
  for (let outcome = 0; outcome < threshold; outcome += 1) {
    cumulative += probabilityMass;
    probabilityMass *= lambda / (outcome + 1);
  }

  return Math.max(0, Math.min(1, 1 - cumulative));
}

export function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function weightedMean(recent: number, season: number, recentWeight = 0.35): number {
  return recent * recentWeight + season * (1 - recentWeight);
}