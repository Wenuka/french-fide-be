import type { Request, Response } from "express";
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { prisma } from "../../lib/prisma";
import {
  buildVocabListItemResponse,
  extractUidFromRequest,
  fetchVocabMetadataForIds,
  FAVOURITES_LIST_NAME,
  resolveWordReferenceToVocabId,
  validateWordRefPayload,
} from "./helpers";

const router = Router();

/**
 * @swagger
 * /user/favourites:
 *   post:
 *     summary: Add a vocab item to the authenticated user's favourites list
 *     description: Copies a vocab entry from one of the user's lists into the favourites list based on its reference identifier.
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
 *       200:
 *         description: Item already exists in favourites
 *       201:
 *         description: Item added to favourites
 *       400:
 *         description: Invalid input or token payload
 *       403:
 *         description: Item does not belong to the authenticated user
 *       404:
 *         description: List or vocab not found
 *       500:
 *         description: Internal server error
 */
router.post("/favourites", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const validation = validateWordRefPayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json({ error: validation.error });
    }
    const { refId, refKind } = validation;

    const targetVocabId = await resolveWordReferenceToVocabId(
      uid,
      refId,
      refKind
    );

    if (!targetVocabId) {
      return res.status(404).json({
        error: "Word not found for the specified identifier",
      });
    }

    const userRecord = await prisma.user.findUnique({
      where: { uid },
      select: {
        favourite_list: true,
        favouriteList: {
          select: {
            list_id: true,
            list_name: true,
          },
        },
      },
    });

    if (!userRecord || !userRecord.favourite_list || !userRecord.favouriteList) {
      return res.status(404).json({ error: "Favourites list not found" });
    }

    const favouriteListId = userRecord.favourite_list;
    const favouriteListName = userRecord.favouriteList.list_name ?? FAVOURITES_LIST_NAME;

    const metadataMap = await fetchVocabMetadataForIds([targetVocabId]);
    const createdItem = await prisma.vocabListItem.upsert({
      where: {
        list_id_vocab_id: {
          list_id: favouriteListId,
          vocab_id: targetVocabId,
        },
      },
      create: {
        list_id: favouriteListId,
        vocab_id: targetVocabId,
        list_name: favouriteListName,
      },
      update: {
        list_name: favouriteListName,
      },
    });

    res.status(201).json({
      ok: true,
      favouriteListItem: buildVocabListItemResponse(createdItem, metadataMap),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/favourites:
 *   delete:
 *     summary: Remove a vocab item from the authenticated user's favourites list
 *     description: Removes a vocab entry from favourites based on its reference identifier.
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
 *         description: Item removed from favourites
 *       400:
 *         description: Invalid input or token payload
 *       404:
 *         description: Item not found in favourites
 *       500:
 *         description: Internal server error
 */
router.delete("/favourites", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const validation = validateWordRefPayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json({ error: validation.error });
    }
    const { refId, refKind } = validation;

    const targetVocabId = await resolveWordReferenceToVocabId(
      uid,
      refId,
      refKind
    );

    if (!targetVocabId) {
      return res.status(404).json({
        error: "Word not found for the specified identifier",
      });
    }

    const userRecord = await prisma.user.findUnique({
      where: { uid },
      select: {
        favourite_list: true,
      },
    });

    if (!userRecord || !userRecord.favourite_list) {
      return res.status(404).json({ error: "Favourites list not found" });
    }

    const deletion = await prisma.vocabListItem.deleteMany({
      where: {
        list_id: userRecord.favourite_list,
        vocab_id: targetVocabId,
      },
    });

    if (deletion.count === 0) {
      return res.status(404).json({ error: "Item not found in favourites" });
    }

    res.json({ ok: true, removed: deletion.count });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

export default router;
