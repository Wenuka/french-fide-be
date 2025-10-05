import type { Request, Response } from "express";
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * @swagger
 * /user/login:
 *   post:
 *     summary: Login or register a user
 *     description: Authenticates a user and creates/updates their profile
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid token or missing required fields
 *       500:
 *         description: Internal server error
 */
// The base path is already /user from index.ts, so we just use /login here
router.post("/login", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const uid: string = user.user_id || user.uid || user.sub;
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const email: string | undefined = user.email ?? undefined;
    const emailVerified: boolean = Boolean(user.email_verified);

    await prisma.user.upsert({
      where: { uid },
      create: {
        uid,
        email,
        emailVerified,
      },
      update: {
        email,
        emailVerified,
      },
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

export default router;
