import { Router, type IRouter, type Response } from "express";
import {
  GetGamesQueryParams,
  GetPlayersQueryParams,
  GetPropsQueryParams,
  GetSnipesQueryParams,
} from "@workspace/api-zod";
import { getDataHealth, getNhlProvider } from "../providers/nhl";

const router: IRouter = Router();

function handleProviderError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Provider request failed";
  res.status(503).json({
    error: "Data provider unavailable",
    code: "DATA_PROVIDER_UNAVAILABLE",
    message,
  });
}

router.get("/dashboard/summary", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getDashboard());
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/games", async (req, res) => {
  try {
    const query = GetGamesQueryParams.parse({
      date: req.query.date ? new Date(String(req.query.date)) : undefined,
    });
    res.json(await getNhlProvider().getGames(query.date?.toISOString().slice(0, 10)));
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/games/today", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getGames(new Date().toISOString().slice(0, 10)));
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/games/future", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getFutureGames());
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/games/:gameId", async (req, res) => {
  try {
    const game = await getNhlProvider().getGame(req.params.gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found", code: "GAME_NOT_FOUND" });
      return;
    }
    res.json(game);
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/players", async (req, res) => {
  try {
    const query = GetPlayersQueryParams.parse(req.query);
    res.json(await getNhlProvider().getPlayers(query.search, query.team));
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/players/:playerId", async (req, res) => {
  try {
    const player = await getNhlProvider().getPlayer(req.params.playerId);
    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }
    res.json(player);
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/teams", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getTeams());
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/teams/:teamId", async (req, res) => {
  try {
    const team = await getNhlProvider().getTeam(req.params.teamId);
    if (!team) {
      res.status(404).json({ error: "Team not found", code: "TEAM_NOT_FOUND" });
      return;
    }
    res.json(team);
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/goalies", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getGoalies());
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/props", async (req, res) => {
  try {
    const query = GetPropsQueryParams.parse(req.query);
    res.json(await getNhlProvider().getProps(query.market));
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/props/:market", async (req, res) => {
  try {
    const query = GetPropsQueryParams.parse({ market: req.params.market });
    if (!query.market) {
      res.status(400).json({ error: "Market is required", code: "MARKET_REQUIRED" });
      return;
    }
    res.json(await getNhlProvider().getPropsByMarket(query.market));
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/odds", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getOdds());
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/matchups", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getMatchups());
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/matchups/:gameId", async (req, res) => {
  try {
    const matchup = await getNhlProvider().getMatchup(req.params.gameId);
    if (!matchup) {
      res.status(404).json({ error: "Matchup not found", code: "MATCHUP_NOT_FOUND" });
      return;
    }
    res.json(matchup);
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/snipes", async (req, res) => {
  try {
    const query = GetSnipesQueryParams.parse(req.query);
    res.json(await getNhlProvider().getSnipes(query.market));
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/audit", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getAudit());
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/model-performance", async (_req, res) => {
  try {
    res.json(await getNhlProvider().getPerformance());
  } catch (error) {
    handleProviderError(res, error);
  }
});

router.get("/admin/data-health", (_req, res) => {
  res.json(getDataHealth());
});

router.post("/admin/sync", async (_req, res) => {
  try {
    res.json(await getNhlProvider().sync());
  } catch (error) {
    handleProviderError(res, error);
  }
});

export default router;