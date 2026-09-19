export type Confidence = "ELITE" | "STRONG" | "MODERATE" | "WATCH";

/**
 * Confidence is an explicit, documented label. It is not a claim of profitability
 * and should only be shown beside a stored sample size and model version.
 */
export function confidenceFromEdge(edge: number | null, sampleSize: number): Confidence {
  if (edge === null || sampleSize < 30) return "WATCH";
  if (edge >= 0.2 && sampleSize >= 250) return "ELITE";
  if (edge >= 0.1 && sampleSize >= 100) return "STRONG";
  if (edge >= 0.05 && sampleSize >= 30) return "MODERATE";
  return "WATCH";
}