import type { Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth";
import { prisma } from "../../lib/prisma";
import {
  buildVocabListItemResponse,
  extractUidFromRequest,
  fetchVocabMetadataForIds,
  FAVOURITES_LIST_NAME,
  parsePositiveInteger,
  resolveWordReferenceToVocabId,
  resolveVocabIdentifiersToIds,
  WordIdentifier,
} from "./helpers";

const router = Router();

/**
 * @swagger
 * /user/createList:
 *   post:
 *     summary: Create a new vocab list
 *     description: Creates a custom vocab list for the authenticated user; optionally attach existing vocab items by identifier.
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
 *             properties:
 *               listName:
 *                 type: string
 *               words:
 *                 type: array
 *                 description: Array of vocab reference objects to pre-populate the list.
 *                 items:
 *                   type: object
 *                   required:
 *                     - wordRefId
 *                     - wordRefKind
 *                   properties:
 *                     wordRefId:
 *                       type: integer
 *                     wordRefKind:
 *                       type: string
 *                       enum: [DEFAULT, CUSTOM]
 *     responses:
 *       201:
 *         description: List created successfully
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Duplicate list name
 *       500:
 *         description: Internal server error
 */
router.post("/createList", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const { listName, words } = req.body ?? {};

    if (typeof listName !== "string" || listName.trim().length === 0) {
      return res.status(400).json({ error: "`listName` must be a non-empty string" });
    }

    const trimmedName = listName.trim();

    let wordIds: number[] = [];
    if (words !== undefined) {
      if (!Array.isArray(words)) {
        return res.status(400).json({ error: "`words` must be an array" });
      }

      for (const raw of words) {
        const candidate = raw as any;
        const refId = parsePositiveInteger(candidate?.wordRefId);
        const refKindRaw =
          typeof candidate?.wordRefKind === "string"
            ? candidate.wordRefKind.trim().toUpperCase()
            : null;

        if (refId === null || !refKindRaw || (refKindRaw !== "DEFAULT" && refKindRaw !== "CUSTOM")) {
          return res.status(400).json({
            error: "Each word must supply `wordRefId` (positive integer) and `wordRefKind` (DEFAULT or CUSTOM)",
          });
        }

        const resolvedId = await resolveWordReferenceToVocabId(
          uid,
          refId,
          refKindRaw as "DEFAULT" | "CUSTOM"
        );
        if (resolvedId === null) {
          return res.status(404).json({
            error: `Word with identifier ${refId} (${refKindRaw}) not found for this user`,
          });
        }

        wordIds.push(resolvedId);
      }
    }

    wordIds = Array.from(new Set(wordIds)) as number[];

    const createdList = await prisma.$transaction(async (tx) => {
      const list = await tx.vocabList.create({
        data: {
          uid,
          list_name: trimmedName,
        },
      });

      if (wordIds.length > 0) {
        await tx.vocabListItem.createMany({
          data: wordIds.map((vocabId: number) => ({
            list_id: list.list_id,
            vocab_id: vocabId,
            list_name: trimmedName,
          })),
          skipDuplicates: true,
        });
      }

      return list;
    });

    res.status(201).json({
      ok: true,
      list: {
        id: createdList.list_id,
        name: createdList.list_name,
      },
      vocabIds: wordIds,
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "A list with that name already exists for this user" });
    }
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/lists:
 *   get:
 *     summary: Fetch all vocab lists for the authenticated user
 *     description: Returns every vocab list the user owns along with the vocab list items for each list.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lists fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 lists:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       words:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             vocabId:
 *                               type: integer
 *                             wordRefKind:
 *                               type: string
 *                               nullable: true
 *                             wordRefId:
 *                               type: integer
 *                               nullable: true
 *       400:
 *         description: Invalid token payload
 *       500:
 *         description: Internal server error
 */
router.get("/lists", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const lists = await prisma.vocabList.findMany({
      where: { uid },
      orderBy: { list_id: "asc" },
      include: {
        items: {
          orderBy: { id: "asc" },
        },
      },
    });

    const allVocabIds = new Set<number>();
    for (const list of lists) {
      for (const item of list.items) {
        allVocabIds.add(item.vocab_id);
      }
    }
    const metadataMap = await fetchVocabMetadataForIds(Array.from(allVocabIds));

    res.json({
      ok: true,
      lists: lists.map((list) => ({
        id: list.list_id,
        name: list.list_name,
        words: list.items.map((item) => {
          const meta = metadataMap.get(item.vocab_id);
          const wordRefKind = meta?.referenceKind ?? null;
          let wordRefId: number | null = null;
          if (wordRefKind === "DEFAULT") {
            wordRefId = meta?.referenceId ?? null;
          } else if (wordRefKind === "CUSTOM") {
            wordRefId = meta?.customVocabId ?? null;
          }

          return {
            itemId: item.id,
            vocabId: item.vocab_id,
            wordRefKind,
            wordRefId,
            importance: item.importance,
            timesGreen: item.timesGreen,
            timesRed: item.timesRed,
            vocabStatus: item.vocab_status,
          };
        }),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/lists/{listId}/words:
 *   post:
 *     summary: Add words to a specific list
 *     description: Adds a list of vocab identifiers to the specified list.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the list to add words to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - words
 *             properties:
 *               words:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - wordRefId
 *                     - wordRefKind
 *                   properties:
 *                     wordRefId:
 *                       type: integer
 *                     wordRefKind:
 *                       type: string
 *                       enum: [DEFAULT, CUSTOM]
 *     responses:
 *       200:
 *         description: Words added successfully
 *       400:
 *         description: Invalid input or listId
 *       404:
 *         description: List not found
 *       500:
 *         description: Internal server error
 */
router.post("/lists/:listId/words", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });
    const listIdParam = req.params.listId;
    const listId = Number(listIdParam);
    if (!Number.isInteger(listId) || listId <= 0) {
      return res.status(400).json({ error: "Invalid listId parameter" });
    }
    const { words } = req.body ?? {};
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: "`words` must be a non-empty array of vocab identifiers" });
    }
    const resolution = await resolveVocabIdentifiersToIds(words as WordIdentifier[]);
    if (resolution.errorMessage) {
      return res.status(400).json({ error: resolution.errorMessage });
    }
    const { vocabIds, missingVocabIds, missingReferenceIds, missingCustomVocabIds } = resolution;
    if (missingVocabIds.length || missingReferenceIds.length || missingCustomVocabIds.length) {
      return res.status(400).json({
        error: "One or more vocab identifiers could not be resolved",
        missing: {
          vocabIds: missingVocabIds,
          referenceIds: missingReferenceIds,
          customVocabIds: missingCustomVocabIds,
        },
      });
    }
    const uniqueWordIds = Array.from(new Set(vocabIds)) as number[];
    const list = await prisma.vocabList.findUnique({
      where: { list_id: listId },
      select: { list_id: true, list_name: true, uid: true },
    });
    if (!list || list.uid !== uid) {
      return res.status(404).json({ error: "List not found" });
    }
    const existingListItems = await prisma.vocabListItem.findMany({
      where: {
        list_id: list.list_id,
        vocab_id: { in: uniqueWordIds },
      },
      select: { vocab_id: true },
    });
    const alreadyPresent = new Set(existingListItems.map((row) => row.vocab_id));
    const toInsert = uniqueWordIds.filter((id: number) => !alreadyPresent.has(id));
    if (toInsert.length > 0) {
      await prisma.vocabListItem.createMany({
        data: toInsert.map((vocabId) => ({
          list_id: list.list_id,
          vocab_id: vocabId,
          list_name: list.list_name,
        })),
        skipDuplicates: true,
      });
    }
    res.status(200).json({
      ok: true,
      list: {
        id: list.list_id,
        name: list.list_name,
      },
      added: toInsert,
      skipped: uniqueWordIds.filter((id: number) => alreadyPresent.has(id)),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/lists/{listId}/words:
 *   delete:
 *     summary: Remove words from a specific list
 *     description: Removes a list of vocab identifiers from the specified list.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the list to remove words from
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - words
 *             properties:
 *               words:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - wordRefId
 *                     - wordRefKind
 *                   properties:
 *                     wordRefId:
 *                       type: integer
 *                     wordRefKind:
 *                       type: string
 *                       enum: [DEFAULT, CUSTOM]
 *     responses:
 *       200:
 *         description: Words removed successfully
 *       400:
 *         description: Invalid input or listId
 *       404:
 *         description: List not found
 *       500:
 *         description: Internal server error
 */
router.delete("/lists/:listId/words", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });
    const listIdParam = req.params.listId;
    const listId = Number(listIdParam);
    if (!Number.isInteger(listId) || listId <= 0) {
      return res.status(400).json({ error: "Invalid listId parameter" });
    }
    const { words } = req.body ?? {};
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: "`words` must be a non-empty array of vocab identifiers" });
    }
    const resolution = await resolveVocabIdentifiersToIds(words as WordIdentifier[]);
    if (resolution.errorMessage) {
      return res.status(400).json({ error: resolution.errorMessage });
    }
    const { vocabIds, missingVocabIds, missingReferenceIds, missingCustomVocabIds } = resolution;
    // We only care about resolving valid IDs to delete. If some are missing, we can just ignore them or report them.
    // But for consistency, let's error if they are invalid identifiers.
    if (missingVocabIds.length || missingReferenceIds.length || missingCustomVocabIds.length) {
      return res.status(400).json({
        error: "One or more vocab identifiers could not be resolved",
        missing: {
          vocabIds: missingVocabIds,
          referenceIds: missingReferenceIds,
          customVocabIds: missingCustomVocabIds,
        },
      });
    }
    const uniqueWordIds = Array.from(new Set(vocabIds)) as number[];
    const list = await prisma.vocabList.findUnique({
      where: { list_id: listId },
      select: { list_id: true, list_name: true, uid: true },
    });
    if (!list || list.uid !== uid) {
      return res.status(404).json({ error: "List not found" });
    }

    const deleted = await prisma.vocabListItem.deleteMany({
      where: {
        list_id: list.list_id,
        vocab_id: { in: uniqueWordIds },
      },
    });

    res.status(200).json({
      ok: true,
      list: {
        id: list.list_id,
        name: list.list_name,
      },
      removedCount: deleted.count,
      removedVocabIds: uniqueWordIds,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/lists/{listId}/items/{itemId}:
 *   patch:
 *     summary: Update a vocab list item
 *     description: Updates the status, importance, or progress stats of a specific vocab item in a list.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the list
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the item to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [unknown, green, red]
 *               timesGreen:
 *                 type: integer
 *                 minimum: 0
 *               timesRed:
 *                 type: integer
 *                 minimum: 0
 *               importance:
 *                 type: number
 *     responses:
 *       200:
 *         description: Item updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Item or list not found
 *       500:
 *         description: Internal server error
 */
router.patch("/lists/:listId/items/:itemId", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const listId = parsePositiveInteger(req.params.listId);
    const itemId = parsePositiveInteger(req.params.itemId);

    if (!listId) {
      return res.status(400).json({ error: "Invalid listId parameter" });
    }
    if (!itemId) {
      return res.status(400).json({ error: "Invalid itemId parameter" });
    }

    const { status, timesGreen, timesRed, importance } = req.body ?? {};
    const allowedStatuses = new Set(["unknown", "green", "red"]);
    const updatePayload: {
      vocab_status?: "unknown" | "green" | "red";
      timesGreen?: number;
      timesRed?: number;
      importance?: number;
    } = {};

    if (status !== undefined) {
      if (typeof status !== "string" || !allowedStatuses.has(status)) {
        return res.status(400).json({ error: "`status` must be one of: unknown, green, red" });
      }
      updatePayload.vocab_status = status as "unknown" | "green" | "red";
    }

    if (timesGreen !== undefined) {
      const parsedGreen = Number(timesGreen);
      if (!Number.isInteger(parsedGreen) || parsedGreen < 0) {
        return res.status(400).json({ error: "`timesGreen` must be a non-negative integer" });
      }
      updatePayload.timesGreen = parsedGreen;
    }

    if (timesRed !== undefined) {
      const parsedRed = Number(timesRed);
      if (!Number.isInteger(parsedRed) || parsedRed < 0) {
        return res.status(400).json({ error: "`timesRed` must be a non-negative integer" });
      }
      updatePayload.timesRed = parsedRed;
    }

    if (importance !== undefined) {
      const parsedImportance = Number(importance);
      if (!Number.isFinite(parsedImportance)) {
        return res.status(400).json({ error: "`importance` must be a finite number" });
      }
      updatePayload.importance = parsedImportance;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({
        error: "Request body must include at least one of: status, timesGreen, timesRed, importance",
      });
    }

    const vocabListItem = await prisma.vocabListItem.findUnique({
      where: { id: itemId },
      include: {
        listRef: {
          select: { uid: true, list_id: true, list_name: true },
        },
      },
    });

    if (!vocabListItem) {
      return res.status(404).json({ error: "Vocab list item not found" });
    }

    if (vocabListItem.listRef?.uid !== uid) {
      return res.status(403).json({ error: "You do not have access to this vocab list item" });
    }

    if (vocabListItem.listRef?.list_id !== listId) {
      return res.status(404).json({ error: "List not found or item does not belong to the specified list" });
    }

    const updatedItem = await prisma.vocabListItem.update({
      where: { id: itemId },
      data: updatePayload,
    });

    const metadataMap = await fetchVocabMetadataForIds([updatedItem.vocab_id]);

    res.json({
      ok: true,
      item: buildVocabListItemResponse(
        {
          id: updatedItem.id,
          list_id: updatedItem.list_id,
          vocab_id: updatedItem.vocab_id,
          list_name: vocabListItem.listRef?.list_name ?? null,
          importance: updatedItem.importance,
          timesGreen: updatedItem.timesGreen,
          timesRed: updatedItem.timesRed,
          vocab_status: updatedItem.vocab_status,
        },
        metadataMap
      ),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/lists/{listId}/items/bulk-progress:
 *   post:
 *     summary: Bulk update progress for list items
 *     description: Updates status and stats for multiple items in a list at once.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the list
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - itemId
 *                   properties:
 *                     itemId:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [unknown, green, red]
 *                     timesGreen:
 *                       type: integer
 *                     timesRed:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Items updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden
 *       404:
 *         description: List or items not found
 *       500:
 *         description: Internal server error
 */
router.post("/lists/:listId/items/bulk-progress", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const listId = parsePositiveInteger(req.params.listId);
    if (!listId) {
      return res.status(400).json({ error: "Invalid listId parameter" });
    }

    const updatesInput = Array.isArray(req.body?.updates) ? req.body.updates : null;
    if (!updatesInput || updatesInput.length === 0) {
      return res.status(400).json({ error: "`updates` must be a non-empty array" });
    }

    const allowedStatuses = new Set(["unknown", "green", "red"]);
    const normalizedUpdates: {
      itemId: number;
      data: { vocab_status?: "unknown" | "green" | "red"; timesGreen?: number; timesRed?: number };
    }[] = [];

    for (const raw of updatesInput) {
      const itemId = parsePositiveInteger(raw?.itemId);
      if (!itemId) {
        return res.status(400).json({ error: "Each update requires a valid itemId" });
      }

      const updatePayload: { vocab_status?: "unknown" | "green" | "red"; timesGreen?: number; timesRed?: number } = {};
      let hasField = false;

      if (raw?.status !== undefined) {
        if (typeof raw.status !== "string" || !allowedStatuses.has(raw.status)) {
          return res.status(400).json({ error: "`status` must be one of: unknown, green, red" });
        }
        updatePayload.vocab_status = raw.status as "unknown" | "green" | "red";
        hasField = true;
      }

      if (raw?.timesGreen !== undefined) {
        const parsedGreen = Number(raw.timesGreen);
        if (!Number.isInteger(parsedGreen) || parsedGreen < 0) {
          return res.status(400).json({ error: "`timesGreen` must be a non-negative integer" });
        }
        updatePayload.timesGreen = parsedGreen;
        hasField = true;
      }

      if (raw?.timesRed !== undefined) {
        const parsedRed = Number(raw.timesRed);
        if (!Number.isInteger(parsedRed) || parsedRed < 0) {
          return res.status(400).json({ error: "`timesRed` must be a non-negative integer" });
        }
        updatePayload.timesRed = parsedRed;
        hasField = true;
      }

      if (!hasField) {
        return res.status(400).json({
          error: "Each update must include at least one of: status, timesGreen, timesRed",
        });
      }

      normalizedUpdates.push({ itemId, data: updatePayload });
    }

    const targetItems = await prisma.vocabListItem.findMany({
      where: { id: { in: normalizedUpdates.map((entry) => entry.itemId) } },
      include: {
        listRef: {
          select: { uid: true, list_id: true },
        },
      },
    });

    if (targetItems.length !== normalizedUpdates.length) {
      return res.status(404).json({ error: "One or more vocab list items were not found" });
    }

    for (const item of targetItems) {
      if (item.listRef?.uid !== uid) {
        return res.status(403).json({ error: "You do not have access to one or more vocab list items" });
      }
      if (item.listRef?.list_id !== listId) {
        return res
          .status(404)
          .json({ error: "One or more items do not belong to the specified list" });
      }
    }

    await prisma.$transaction(
      normalizedUpdates.map(({ itemId, data }) =>
        prisma.vocabListItem.update({
          where: { id: itemId },
          data,
        })
      )
    );

    res.json({
      ok: true,
      updated: normalizedUpdates.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/lists/{listId}:
 *   delete:
 *     summary: Delete a vocab list
 *     description: Deletes a vocab list and all its items. Cannot delete the favourites list.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the list to delete
 *     responses:
 *       200:
 *         description: List deleted successfully
 *       400:
 *         description: Invalid listId or cannot delete favourites list
 *       404:
 *         description: List not found
 *       500:
 *         description: Internal server error
 */
router.delete("/lists/:listId", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const uid: string = user?.user_id || user?.uid || user?.sub;
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const listId = parsePositiveInteger(req.params.listId);
    if (!listId) {
      return res.status(400).json({ error: "Invalid listId parameter" });
    }

    const [userRecord, list] = await Promise.all([
      prisma.user.findUnique({
        where: { uid },
        select: { favourite_list: true },
      }),
      prisma.vocabList.findUnique({
        where: { list_id: listId },
        select: { list_id: true, list_name: true, uid: true },
      }),
    ]);

    if (!userRecord) {
      return res.status(404).json({ error: "User profile not found" });
    }

    if (!list || list.uid !== uid) {
      return res.status(404).json({ error: "List not found" });
    }

    if (userRecord.favourite_list === list.list_id || list.list_name === FAVOURITES_LIST_NAME) {
      return res.status(400).json({ error: "Cannot delete favourites list" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.vocabListItem.deleteMany({
        where: { list_id: list.list_id },
      });
      await tx.vocabList.delete({
        where: { list_id: list.list_id },
      });
    });

    res.status(200).json({
      ok: true,
      deletedListId: list.list_id,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

export default router;
