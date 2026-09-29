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

// Add players and other missing routes
router.get("/players", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const search = req.query.search as string | undefined;
    const team = req.query.team as string | undefined;
    const players = await provider.getPlayers(search, team);
    res.json(players);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Players request failed";
    res.status(503).json({
      error: "Players unavailable",
      code: "PLAYERS_UNAVAILABLE",
      message,
    });
  }
});

router.get("/props", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const market = req.query.market as string | undefined;
    const props = await provider.getProps(market);
    res.json(props);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Props request failed";
    res.status(503).json({
      error: "Props unavailable",
      code: "PROPS_UNAVAILABLE",
      message,
    });
  }
});

router.get("/props/:market", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const market = req.params.market as string;
    const props = await provider.getPropsByMarket(market);
    res.json(props);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Props by market request failed";
    res.status(503).json({
      error: "Props by market unavailable",
      code: "PROPS_BY_MARKET_UNAVAILABLE",
      message,
    });
  }
});

router.get("/matchups", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const matchups = await provider.getMatchups();
    res.json(matchups);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Matchups request failed";
    res.status(503).json({
      error: "Matchups unavailable",
      code: "MATCHUPS_UNAVAILABLE",
      message,
    });
  }
});

router.get("/goalies", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const goalies = await provider.getGoalies();
    res.json(goalies);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Goalies request failed";
    res.status(503).json({
      error: "Goalies unavailable",
      code: "GOALIES_UNAVAILABLE",
      message,
    });
  }
});

router.get("/teams", async (req, res) => {
  try {
    const provider = getNhlProvider();
    const teams = await provider.getTeams();
    res.json(teams);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Teams request failed";
    res.status(503).json({
      error: "Teams unavailable",
      code: "TEAMS_UNAVAILABLE",
      message,
    });
  }
});

export default router;
