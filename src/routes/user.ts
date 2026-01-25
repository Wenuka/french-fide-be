import { Router } from "express";
import authRouter from "./user/auth";
import profileRouter from "./user/profile";
import favouritesRouter from "./user/favourites";
import hiddenRouter from "./user/hidden";
import listsRouter from "./user/lists";
import wordsRouter from "./user/words";

const router = Router();

router.use(authRouter);
router.use(profileRouter);
router.use(listsRouter);
router.use(favouritesRouter);
router.use(hiddenRouter);
router.use(wordsRouter);

export default router;
