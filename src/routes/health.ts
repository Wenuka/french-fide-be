import type { Request, Response } from "express";
import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 */
// This route is mounted at /health in app.ts
router.get("/", (_, res) => {
  res.status(200).json({ status: "ok" });
});

export default router;
