import { Router, type IRouter } from "express";
import { getNhlProvider, getDataHealth } from "../providers/nhl";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// POST /api/admin/sync - Trigger NHL data synchronization
router.post("/sync", async (_req, res) => {
  try {
    logger.info("Starting manual NHL data sync");
    const nhlProvider = getNhlProvider();
    const report = await nhlProvider.sync();
    logger.info({ report }, "NHL data sync completed");
    
    res.status(200).json({
      teamsImported: report.teamsImported,
      gamesImported: report.gamesImported,
      playersImported: report.playersImported,
      playerStatsImported: report.playerStatsImported,
      goalieStatsImported: report.goalieStatsImported,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
    });
  } catch (error) {
    logger.error({ error }, "NHL data sync failed");
    res.status(500).json({ 
      error: "Sync failed", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

// GET /api/admin/data-health - Get current data health status
router.get("/data-health", (_req, res) => {
  res.json(getDataHealth());
});

export default router;
