import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nhlRouter from "./nhl";
import discordAuthRouter from "./discord-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nhlRouter);
router.use("/auth/discord", discordAuthRouter);

export default router;
