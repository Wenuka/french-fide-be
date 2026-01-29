import type { Request, Response } from "express";
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { prisma } from "../../lib/prisma";
import { Language as PrismaLanguage } from "@prisma/client";

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
            return PrismaLanguage.FR;
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
            return PrismaLanguage.FR;
    }
};

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

        // Check if user has custom vocab or has generated default lists
        const userProfile = await prisma.user.findUnique({
            where: { uid },
            select: { id: true, has_generated_default_lists: true }
        });

        if (!userProfile) {
            return res.status(404).json({ error: "User profile not found" });
        }

        const hasCustomVocab = await prisma.customVocab.findFirst({
            where: { userId: userProfile.id },
            select: { custom_vocab_id: true }
        });

        if (hasCustomVocab) {
            return res.status(400).json({
                error: "You cannot change the language as you have started practicing custom words. Please use a new account if you wish to practice a new language."
            });
        }

        if (userProfile?.has_generated_default_lists) {
            return res.status(400).json({
                error: "You cannot change the language as you have already generated the default lists. Please use a new account or reset your progress if you wish to change languages."
            });
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
