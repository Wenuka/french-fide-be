import type { Request, Response } from "express";
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { prisma } from "../../lib/prisma";
import { extractUidFromRequest, fetchVocabMetadataForIds, resolveWordReferenceToVocabId, validateWordRefPayload } from "./helpers";

const router = Router();

/**
 * @swagger
 * /user/hidden:
 *   post:
 *     summary: Hide vocab items for the authenticated user
 *     description: Adds vocab items to the user's hidden vocab list so they no longer appear in study lists.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wordRefId
 *               - wordRefKind
 *             properties:
 *               wordRefId:
 *                 type: integer
 *                 description: Identifier of the vocab (reference_id for DEFAULT, custom_vocab_id for CUSTOM).
 *               wordRefKind:
 *                 type: string
 *                 enum: [DEFAULT, CUSTOM]
 *                 description: Kind of reference supplied for `wordRefId`.
 *     responses:
 *       204:
 *         description: Hidden vocab updated successfully
 *       400:
 *         description: Invalid input or token payload
 *       500:
 *         description: Internal server error
 */
router.post("/hidden", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const validation = validateWordRefPayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json({ error: validation.error });
    }
    const { refId, refKind } = validation;

    const vocabId = await resolveWordReferenceToVocabId(
      uid,
      refId,
      refKind
    );

    if (!vocabId) {
      return res.status(404).json({
        error: "Word not found for the specified identifier",
      });
    }

    await prisma.hiddenVocab.createMany({
      data: [{ uid, vocab_id: vocabId }],
      skipDuplicates: true,
    });

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/hidden:
 *   delete:
 *     summary: Unhide vocab items for the authenticated user
 *     description: Removes vocab items from the user's hidden list based on reference identifiers.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wordRefId
 *               - wordRefKind
 *             properties:
 *               wordRefId:
 *                 type: integer
 *               wordRefKind:
 *                 type: string
 *                 enum: [DEFAULT, CUSTOM]
 *     responses:
 *       200:
 *         description: Hidden vocab removed successfully
 *       400:
 *         description: Invalid input or token payload
 *       500:
 *         description: Internal server error
 */
router.delete("/hidden", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const validation = validateWordRefPayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json({ error: validation.error });
    }
    const { refId, refKind } = validation;

    const vocabId = await resolveWordReferenceToVocabId(
      uid,
      refId,
      refKind
    );

    if (!vocabId) {
      return res.status(404).json({
        error: "Word not found for the specified identifier",
      });
    }

    const deletion = await prisma.hiddenVocab.deleteMany({
      where: {
        uid,
        vocab_id: { in: [vocabId] },
      },
    });

    res.json({ ok: true, removed: deletion.count });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/hidden:
 *   get:
 *     summary: Retrieve hidden vocab identifiers for the authenticated user
 *     description: Returns the vocab entries hidden by the user with their reference identifiers.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hidden vocab retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 hidden:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       vocabId:
 *                         type: integer
 *                       wordRefKind:
 *                         type: string
 *                         nullable: true
 *                       wordRefId:
 *                         type: integer
 *                         nullable: true
 *       400:
 *         description: Invalid token payload
 *       500:
 *         description: Internal server error
 */
router.get("/hidden", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const hiddenRows = await prisma.hiddenVocab.findMany({
      where: { uid },
      select: { vocab_id: true },
      orderBy: { vocab_id: "asc" },
    });

    if (hiddenRows.length === 0) {
      return res.json({ ok: true, hidden: [] });
    }

    const vocabIds = hiddenRows.map((row) => row.vocab_id);
    const metadataMap = await fetchVocabMetadataForIds(vocabIds);
    const hidden = hiddenRows.map((row) => {
      const meta = metadataMap.get(row.vocab_id);
      const referenceKind = meta?.referenceKind ?? null;
      let referenceId: number | null = null;
      if (referenceKind === "DEFAULT") {
        referenceId = meta?.referenceId ?? null;
      } else if (referenceKind === "CUSTOM") {
        referenceId = meta?.customVocabId ?? null;
      }

      return {
        vocabId: row.vocab_id,
        wordRefKind: referenceKind,
        wordRefId: referenceId,
      };
    });

    res.json({
      ok: true,
      hidden,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

export default router;
