import { Router, type IRouter } from "express";
import healthRouter from "./health";
import queuesRouter from "./queues";

const router: IRouter = Router();

router.use(healthRouter);
router.use(queuesRouter);

export default router;
