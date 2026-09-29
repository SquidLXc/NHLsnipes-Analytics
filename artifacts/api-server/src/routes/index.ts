import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nhlRouter from "./nhl";
import discordAuthRouter from "./discord-auth";
import adminRouter from "./admin";
import { getNhlProvider } from "../providers/nhl";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/nhl", nhlRouter);
router.use("/auth/discord", discordAuthRouter);
router.use("/admin", adminRouter);

// Add direct routes for frontend compatibility (frontend calls without /nhl prefix)
router.get("/dashboard/summary", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const dashboard = await provider.getDashboard();
    res.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dashboard request failed";
    res.status(503).json({
      error: "Dashboard unavailable",
      code: "DASHBOARD_UNAVAILABLE",
      message,
    });
  }
});

router.get("/games/today", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const games = await provider.getGames(new Date().toISOString().slice(0, 10));
    res.json(games);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Games request failed";
    res.status(503).json({
      error: "Games unavailable",
      code: "GAMES_UNAVAILABLE",
      message,
    });
  }
});

router.get("/games/future", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const games = await provider.getFutureGames();
    res.json(games);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Future games request failed";
    res.status(503).json({
      error: "Future games unavailable",
      code: "FUTURE_GAMES_UNAVAILABLE",
      message,
    });
  }
});

router.get("/live-alerts", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const alerts = await provider.getLiveAlerts();
    res.json(alerts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live alerts request failed";
    res.status(503).json({
      error: "Live alerts unavailable",
      code: "LIVE_ALERTS_UNAVAILABLE",
      message,
    });
  }
});

router.get("/snipes", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const snipes = await provider.getSnipes();
    res.json(snipes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Snipes request failed";
    res.status(503).json({
      error: "Snipes unavailable",
      code: "SNIPESS_UNAVAILABLE",
      message,
    });
  }
});

router.get("/odds", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const odds = await provider.getOdds();
    res.json(odds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Odds provider request failed";
    res.status(503).json({
      error: "Odds provider unavailable",
      code: "ODDS_PROVIDER_UNAVAILABLE",
      message,
    });
  }
});

export default router;
