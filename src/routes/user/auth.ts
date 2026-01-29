import type { Request, Response } from "express";
import { Router } from "express";
import type { User } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth";
import { prisma } from "../../lib/prisma";
import { FAVOURITES_LIST_NAME, extractUidFromRequest } from "./helpers";

const router = Router();

/**
 * @swagger
 * /user/login:
 *   post:
 *     summary: Login or register a user
 *     description: Authenticates a user and creates/updates their profile. Optionally sets language preferences.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sourceLang:
 *                 type: string
 *                 enum: [EN, FR, DE]
 *                 description: The user's learning language (optional)
 *               targetLang:
 *                 type: string
 *                 enum: [EN, FR, DE]
 *                 description: The user's known language (optional)
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
 *                 user:
 *                   type: object
 *                   properties:
 *                     source_lang:
 *                       type: string
 *                     target_lang:
 *                       type: string
 *       400:
 *         description: Invalid token or missing required fields
 *       500:
 *         description: Internal server error
 */
router.post("/login", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const user = req.user as any;
    const email: string | undefined = user?.email ?? undefined;
    const emailVerified: boolean = Boolean(user?.email_verified);

    const { sourceLang, targetLang, communicateImportantUpdates } = req.body ?? {};

    // Validate languages if provided
    const allowedLangs = new Set(["EN", "FR", "DE"]);
    let validatedSourceLang: any = undefined;
    let validatedTargetLang: any = undefined;

    if (sourceLang && typeof sourceLang === "string") {
      const upper = sourceLang.trim().toUpperCase();
      if (allowedLangs.has(upper)) validatedSourceLang = upper;
    }

    if (targetLang && typeof targetLang === "string") {
      const upper = targetLang.trim().toUpperCase();
      if (allowedLangs.has(upper)) validatedTargetLang = upper;
    }

    type LoginUserRecord = Pick<User, "id" | "favourite_list" | "source_lang" | "target_lang">;
    let userRecord: LoginUserRecord | null = null;

    const commsUpdateVal = typeof communicateImportantUpdates === 'boolean' ? communicateImportantUpdates : undefined;

    await prisma.$transaction(async (tx) => {
      // 1. Upsert user:
      //    - Create: Set languages if provided
      //    - Update: DO NOT update languages (immutable), only email/verified status
      //    - Update: Update communicate_important_updates if provided (allows user to toggle later via this endpoint if needed, or just on signup)
      const dbUser = await tx.user.upsert({
        where: { uid },
        create: {
          uid,
          email,
          emailVerified,
          source_lang: validatedSourceLang,
          target_lang: validatedTargetLang,
          communicate_important_updates: commsUpdateVal, // If undefined, uses default (true)
        },
        update: {
          email,
          emailVerified,
          communicate_important_updates: commsUpdateVal,
        },
        select: {
          id: true,
          favourite_list: true,
          source_lang: true,
          target_lang: true,
        },
      });

      userRecord = dbUser;

      // 2. Conditional Update:
      //    If the user exists but has NO language set (e.g. created via AuthContext sync before SignUp call),
      //    AND we have valid languages in this request, then set them now.
      //    This is the ONLY time we allow "updating" the language (from null to set).
      if (!dbUser.source_lang && validatedSourceLang) {
        userRecord = await tx.user.update({
          where: { id: dbUser.id },
          data: {
            source_lang: validatedSourceLang,
            target_lang: validatedTargetLang,
          },
          select: {
            id: true,
            favourite_list: true,
            source_lang: true,
            target_lang: true,
          },
        });
      }

      const favouriteList = await tx.vocabList.upsert({
        where: {
          userId_list_name: {
            userId: dbUser.id,
            list_name: FAVOURITES_LIST_NAME,
          },
        },
        update: {
          userId: dbUser.id,
        },
        create: {
          userId: dbUser.id,
          list_name: FAVOURITES_LIST_NAME,
        },
        select: {
          list_id: true,
        },
      });

      if (userRecord.favourite_list !== favouriteList.list_id) {
        userRecord = await tx.user.update({
          where: { id: userRecord.id },
          data: { favourite_list: favouriteList.list_id },
          select: {
            id: true,
            favourite_list: true,
            source_lang: true,
            target_lang: true,
          },
        });
      }
    });

    if (!userRecord) {
      userRecord = await prisma.user.findUnique({
        where: { uid },
        select: {
          id: true,
          favourite_list: true,
          source_lang: true,
          target_lang: true,
        },
      });
    }

    if (!userRecord) {
      return res.status(500).json({ error: "Failed to retrieve user record" });
    }

    res.json({
      ok: true,
      user: {
        source_lang: userRecord.source_lang,
        target_lang: userRecord.target_lang,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieves the authenticated user's profile information
 *     tags:
 *       - Authentication
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
 *                 uid:
 *                   type: string
 *                 email:
 *                   type: string
 *                 emailVerified:
 *                   type: boolean
 *                 source_lang:
 *                   type: string
 *                   enum: [EN, FR, DE]
 *                 target_lang:
 *                   type: string
 *                   enum: [EN, FR, DE]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Invalid token payload (uid missing)" });

    const user = await prisma.user.findUnique({
      where: { uid },
      select: {
        id: true,
        uid: true,
        email: true,
        emailVerified: true,
        source_lang: true,
        target_lang: true,
        has_generated_default_lists: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const hasCustomVocab = await prisma.customVocab.findFirst({
      where: { userId: user.id },
      select: { custom_vocab_id: true }
    });

    res.json({
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      source_lang: user.source_lang,
      target_lang: user.target_lang,
      hasGeneratedDefaultLists: user.has_generated_default_lists,
      hasCustomVocab: !!hasCustomVocab,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/delete:
 *   delete:
 *     summary: Anonymize user account
 *     description: Anonymizes the user's data in the database. The actual Firebase user should be deleted by the client.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User anonymized successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete("/delete", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Invalid token payload (uid missing)" });

    await prisma.$transaction(async (tx) => {
      // Check if user exists first
      const user = await tx.user.findUnique({ where: { uid } });
      if (!user) {
        throw new Error("User not found");
      }

      const randomId = crypto.randomUUID();
      const newEmail = `del_${randomId}@d.m`;

      // We only update the email to anonymize PII.
      // We keep the UID as is (hashed/random string) but since Auth user is deleted, it is effectively orphaned.
      // This avoids the need for complex FK updates or Schema changes.
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: newEmail,
          emailVerified: false,
          communicate_important_updates: false,
        },
      });
    });

    res.json({ ok: true, message: "User anonymized successfully" });
  } catch (err: any) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

export default router;
