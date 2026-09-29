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

// Add direct /odds route for compatibility with frontend
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
