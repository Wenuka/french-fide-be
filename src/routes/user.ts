import type { Request, Response } from "express";
import { Router } from "express";
import { Language as PrismaLanguage } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";

const router = Router();

const normalizeTargetLang = (value: unknown): PrismaLanguage | null => {
  if (typeof value !== "string") {
    return null;
  }
  const lower = value.trim().toLowerCase();
  switch (lower) {
    case "fr":
      return PrismaLanguage.FR;
    case "de":
      return PrismaLanguage.DE;
    default:
      return null;
  }
};

const respondableLanguage = (language: PrismaLanguage | null | undefined): string | null => {
  if (!language) {
    return null;
  }
  switch (language) {
    case PrismaLanguage.FR:
      return "fr";
    case PrismaLanguage.DE:
      return "de";
    default:
      return null;
  }
};

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
    const normalizedTargetLang = normalizeTargetLang(req.body?.target_lang);

    await prisma.user.upsert({
      where: { uid },
      create: {
        uid,
        email,
        emailVerified,
        ...(normalizedTargetLang ? { target_lang: normalizedTargetLang } : {}),
      },
      update: {
        email,
        emailVerified,
        ...(normalizedTargetLang ? { target_lang: normalizedTargetLang } : {}),
      },
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     description: Returns the profile data for the authenticated user
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 target_lang:
 *                   type: string
 *                   nullable: true
 *                   example: "fr"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const uid: string = user.user_id || user.uid || user.sub;
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const dbUser = await prisma.user.findUnique({
      where: { uid },
      select: { target_lang: true },
    });

    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ target_lang: respondableLanguage(dbUser.target_lang) });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/profile:
 *   put:
 *     summary: Update the authenticated user's target language
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               target_lang:
 *                 type: string
 *                 enum: [fr, de]
 *                 example: fr
 *     responses:
 *       200:
 *         description: Target language updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 target_lang:
 *                   type: string
 *                   example: fr
 *       400:
 *         description: Invalid target language
 *       401:
 *         description: Unauthorized
 */
router.put("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const uid: string = user.user_id || user.uid || user.sub;
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const normalizedTargetLang = normalizeTargetLang(req.body?.target_lang);

    if (!normalizedTargetLang) {
      console.warn("Attempted to update target_lang with invalid value:", req.body?.target_lang);
      return res.status(400).json({ error: "Invalid target_lang" });
    }

    const email: string | undefined = user.email ?? undefined;
    const emailVerified: boolean = Boolean(user.email_verified);

    const updatedUser = await prisma.user.upsert({
      where: { uid },
      create: {
        uid,
        email,
        emailVerified,
        target_lang: normalizedTargetLang,
      },
      update: {
        email,
        emailVerified,
        target_lang: normalizedTargetLang,
      },
      select: { target_lang: true },
    });

    res.json({ target_lang: respondableLanguage(updatedUser.target_lang) });
  } catch (err: any) {
    console.error("Failed to update target language:", err);
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

export default router;
