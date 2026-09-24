import { Router, type IRouter } from "express";
import { nhlProvider } from "../providers/nhl";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// POST /api/admin/sync - Trigger NHL data synchronization
router.post("/sync", async (_req, res) => {
  try {
    logger.info("Starting manual NHL data sync");
    const report = await nhlProvider.sync();
    logger.info("NHL data sync completed", { report });
    
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
    logger.error("NHL data sync failed", { error });
    res.status(500).json({ 
      error: "Sync failed", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

export default router;
