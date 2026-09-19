import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nhlRouter from "./nhl";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nhlRouter);

export default router;
