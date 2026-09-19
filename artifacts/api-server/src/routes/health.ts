import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { databaseConfigured, pool } from "@workspace/db";
import { getDataHealth } from "../providers/nhl";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let databaseStatus: "connected" | "not configured" | "error" = databaseConfigured ? "error" : "not configured";
  let databaseMessage: string | null = databaseConfigured ? null : "DATABASE_URL is not configured";

  if (databaseConfigured) {
    try {
      await pool.query("select 1");
      databaseStatus = "connected";
      databaseMessage = null;
    } catch (error) {
      databaseMessage = error instanceof Error ? error.message : "Database health query failed";
    }
  }

  const dataHealth = getDataHealth();
  const providerStatus = dataHealth.connection === "error" ? "error" : "connected";
  const configurationProblems = [
    ...(!databaseConfigured ? ["DATABASE_URL is not configured"] : []),
    ...(process.env.ODDS_API_KEY ? [] : ["ODDS_API_KEY is not configured; sportsbook odds will be unavailable"]),
  ];
  const status = databaseStatus === "connected" && providerStatus === "connected" ? "ok" : "degraded";
  const data = HealthCheckResponse.parse({
    status,
    application: "ok",
    database: { status: databaseStatus, message: databaseMessage },
    provider: {
      status: providerStatus,
      name: dataHealth.provider,
      lastSuccessfulSync: dataHealth.lastSuccessfulSync,
      lastAttemptedSync: dataHealth.lastAttemptedSync,
    },
    currentDataTimestamp: dataHealth.lastSuccessfulSync,
    configurationProblems,
  });
  res.json(data);
});

export default router;
