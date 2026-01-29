import type { Request, Response } from "express";
import { Router } from "express";
import { Language, VocabReferenceKind } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth";
import { prisma } from "../../lib/prisma";
import {
  extractUidFromRequest,
  fetchVocabMetadataForIds,
  parsePositiveInteger,
} from "./helpers";

const router = Router();

/**
 * @swagger
 * /user/default-vocab:
 *   post:
 *     summary: Bulk add default vocab entries
 *     description: Creates default vocab entries with sequential reference IDs.
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
 *               count:
 *                 type: integer
 *                 description: Number of default entries to insert.
 *               startRefId:
 *                 type: integer
 *                 description: Starting reference ID (defaults to 1).
 *     responses:
 *       200:
 *         description: Default vocab inserted.
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal server error
 */
router.post("/default-vocab", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const count = parsePositiveInteger(req.body?.count);
    if (count === null) {
      return res.status(400).json({ error: "`count` must be a positive integer" });
    }

    const startRef = parsePositiveInteger(req.body?.startRefId ?? req.body?.start_ref_id ?? 1);
    if (startRef === null) {
      return res.status(400).json({ error: "`startRefId` must be a positive integer" });
    }

    const data = Array.from({ length: count }, (_, idx) => ({
      reference_kind: VocabReferenceKind.DEFAULT,
      reference_id: startRef + idx,
    }));

    const result = await prisma.vocab.createMany({
      data,
      skipDuplicates: true,
    });

    res.json({
      ok: true,
      requested: count,
      created: result.count ?? data.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

const buildWordPayloads = (
  vocabIds: number[],
  metadataMap: Map<number, any>,
  listMembership: Map<number, Set<number>>,
  hiddenSet: Set<number>,
  favouriteSet: Set<number>,
  listNameMap: Map<number, string>
) => {
  return vocabIds
    .map((vocabId) => {
      const meta = metadataMap.get(vocabId);
      if (!meta) return null;
      const listIdsForWord = listMembership.get(vocabId);
      const listIds = listIdsForWord ? Array.from(listIdsForWord).sort((a, b) => a - b) : [];
      const lists =
        listIdsForWord
          ? Array.from(listIdsForWord)
            .map((listId) => ({
              id: listId,
              name: listNameMap.get(listId) ?? null,
            }))
            .filter((entry) => Boolean(entry.name))
          : [];

      return {
        vocabId,
        referenceKind: meta.referenceKind,
        referenceId: meta.referenceId,
        customVocabId: meta.customVocabId,
        sourceText: meta.sourceText ?? null,
        targetText: meta.targetText ?? null,
        isHidden: hiddenSet.has(vocabId),
        isFavourite: favouriteSet.has(vocabId),
        listIds,
        lists,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
};

/**
 * @swagger
 * /user/words:
 *   post:
 *     summary: Retrieve vocab words with user-specific flags
 *     description: Returns vocab words along with favourite/hidden flags and list membership for the authenticated user. Optionally filter by list IDs.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               listIds:
 *                 type: array
 *                 description: Optional list IDs owned by the user to filter vocab. Omit or send null/empty array to fetch every word.
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Words fetched successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User profile not found
 *       500:
 *         description: Internal server error
 */
router.post("/words", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    // 1. Parse Inputs
    const requestBody = typeof req.body === "object" && req.body !== null ? req.body : {};
    const rawListIds = (requestBody as any).listIds;

    let targetListIds: number[] | null = null;
    if (Array.isArray(rawListIds)) {
      targetListIds = [];
      for (const rawId of rawListIds) {
        const parsed = parsePositiveInteger(rawId);
        if (parsed === null) {
          return res.status(400).json({ error: "`listIds` must contain only positive integers" });
        }
        targetListIds.push(parsed);
      }
      targetListIds = Array.from(new Set(targetListIds));
    } else if (rawListIds !== undefined && rawListIds !== null) {
      return res.status(400).json({ error: "`listIds` must be an array of positive integers" });
    }

    const userRecord = await prisma.user.findUnique({
      where: { uid },
      select: { favourite_list: true },
    });

    if (!userRecord) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const favouriteListId = userRecord.favourite_list ?? null;
    const listMembership = new Map<number, Set<number>>();
    const addMembership = (vocabId: number, listId: number) => {
      if (!listMembership.has(vocabId)) listMembership.set(vocabId, new Set());
      listMembership.get(vocabId)!.add(listId);
    };

    let vocabIds: number[] = [];

    // 2. Determine Scope (Filtered vs All)
    if (targetListIds && targetListIds.length > 0) {
      // Verify ownership of requested lists
      const ownedListsRaw = await prisma.vocabList.findMany({
        where: {
          uid,
          list_id: { in: targetListIds },
        },
        select: { list_id: true },
      });
      const ownedLists = Array.isArray(ownedListsRaw) ? ownedListsRaw : [];

      const ownedListIds = new Set(ownedLists.map((l) => l.list_id));
      if (ownedListIds.size !== targetListIds.length) {
        const missing = targetListIds.filter((id) => !ownedListIds.has(id));
        return res.status(404).json({
          error: "One or more list IDs are not owned by the authenticated user",
          missingListIds: missing,
        });
      }

      // Fetch items for these lists
      const listItemsRaw = await prisma.vocabListItem.findMany({
        where: { list_id: { in: targetListIds } },
        select: { vocab_id: true, list_id: true },
      });
      const listItems = Array.isArray(listItemsRaw) ? listItemsRaw : [];

      for (const item of listItems) {
        addMembership(item.vocab_id, item.list_id);
        vocabIds.push(item.vocab_id);
      }
    } else {
      // Fetch ALL vocab IDs (default + custom)
      const allVocabRaw = await prisma.vocab.findMany({
        select: { vocab_id: true },
      });
      const allVocab = Array.isArray(allVocabRaw) ? allVocabRaw : [];
      vocabIds = allVocab.map((v) => v.vocab_id);

      // Fetch ALL list memberships for this user
      const allListItemsRaw = await prisma.vocabListItem.findMany({
        where: { listRef: { uid } },
        select: { vocab_id: true, list_id: true },
      });
      const allListItems = Array.isArray(allListItemsRaw) ? allListItemsRaw : [];

      for (const item of allListItems) {
        addMembership(item.vocab_id, item.list_id);
      }
    }

    if (vocabIds.length === 0) {
      return res.json({ ok: true, words: [] });
    }

    const uniqueVocabIds = Array.from(new Set(vocabIds)).sort((a, b) => a - b);

    // 3. Fetch Metadata & User State
    const [metadataMap, hiddenRowsRaw, favouriteRowsRaw, userListsRaw] = await Promise.all([
      fetchVocabMetadataForIds(uniqueVocabIds),
      prisma.hiddenVocab.findMany({
        where: {
          uid,
          vocab_id: { in: uniqueVocabIds },
        },
        select: { vocab_id: true },
      }),
      favouriteListId
        ? prisma.vocabListItem.findMany({
          where: {
            list_id: favouriteListId,
            vocab_id: { in: uniqueVocabIds },
          },
          select: { vocab_id: true },
        })
        : Promise.resolve([]),
      prisma.vocabList.findMany({
        where: { uid },
        select: { list_id: true, list_name: true },
      }),
    ]);

    const hiddenRows = Array.isArray(hiddenRowsRaw) ? hiddenRowsRaw : [];
    const favouriteRows = Array.isArray(favouriteRowsRaw) ? favouriteRowsRaw : [];
    const userLists = Array.isArray(userListsRaw) ? userListsRaw : [];

    const hiddenSet = new Set(hiddenRows.map((r) => r.vocab_id));
    const favouriteSet = new Set(favouriteRows.map((r) => r.vocab_id));
    const listNameMap = new Map(userLists.map((l) => [l.list_id, l.list_name]));

    // 4. Build Response
    const words = buildWordPayloads(
      uniqueVocabIds,
      metadataMap,
      listMembership,
      hiddenSet,
      favouriteSet,
      listNameMap
    );

    res.json({
      ok: true,
      words,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/custom-words:
 *   post:
 *     summary: Create a custom vocab word
 *     description: Creates a new custom vocabulary word for the user.
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
 *               - sourceText
 *               - targetText
 *               - sourceLang
 *               - targetLang
 *             properties:
 *               sourceText:
 *                 type: string
 *               targetText:
 *                 type: string
 *               sourceLang:
 *                 type: string
 *                 enum: [EN, FR, DE]
 *               targetLang:
 *                 type: string
 *                 enum: [EN, FR, DE]
 *     responses:
 *       201:
 *         description: Custom word created successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal server error
 */
router.post("/custom-words", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const {
      sourceText,
      targetText,
      sourceLang,
      targetLang,
    } = req.body ?? {};

    if (typeof sourceText !== "string" || sourceText.trim().length === 0) {
      return res.status(400).json({ error: "`sourceText` must be a non-empty string" });
    }
    if (typeof targetText !== "string" || targetText.trim().length === 0) {
      return res.status(400).json({ error: "`targetText` must be a non-empty string" });
    }

    // Fetch user's default languages
    // Fetch user's default languages
    const userRecord = await prisma.user.findUnique({
      where: { uid },
      select: {
        id: true,
        source_lang: true,
        target_lang: true,
      },
    });

    if (!userRecord) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const allowedLangs = new Set(["EN", "FR", "DE"]);

    let finalSourceLang = userRecord.source_lang;
    let finalTargetLang = userRecord.target_lang;

    if (sourceLang) {
      const normalized = sourceLang.trim().toUpperCase();
      if (!allowedLangs.has(normalized)) {
        return res.status(400).json({ error: "`sourceLang` must be one of EN, FR, DE" });
      }
      finalSourceLang = normalized as Language;
    }

    if (targetLang) {
      const normalized = targetLang.trim().toUpperCase();
      if (!allowedLangs.has(normalized)) {
        return res.status(400).json({ error: "`targetLang` must be one of EN, FR, DE" });
      }
      finalTargetLang = normalized as Language;
    }

    const customEntry = await prisma.customVocab.create({
      data: {
        uid,
        userId: userRecord.id,
        source_lang: finalSourceLang,
        target_lang: finalTargetLang,
        source_text: sourceText.trim(),
        target_text: targetText.trim(),
      },
      select: {
        custom_vocab_id: true,
        source_lang: true,
        target_lang: true,
        source_text: true,
        target_text: true,
      },
    });

    const vocab = await prisma.vocab.create({
      data: {
        reference_kind: "CUSTOM",
        custom_vocab_id: customEntry.custom_vocab_id,
      },
    });

    res.status(201).json({
      ok: true,
      customWord: {
        customVocabId: customEntry.custom_vocab_id,
        vocabId: vocab.vocab_id,
        sourceText: customEntry.source_text,
        targetText: customEntry.target_text,
        sourceLang: customEntry.source_lang,
        targetLang: customEntry.target_lang,
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(400).json({ error: "uuid must be unique per custom word" });
    }
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

/**
 * @swagger
 * /user/custom-words:
 *   get:
 *     summary: Get all custom vocab words
 *     description: Retrieves all custom vocabulary words created by the user.
 *     tags:
 *       - Vocabulary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Custom words retrieved successfully
 *       400:
 *         description: Invalid token payload
 *       404:
 *         description: User profile not found
 *       500:
 *         description: Internal server error
 */
router.get("/custom-words", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = extractUidFromRequest(req);
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const userRecord = await prisma.user.findUnique({
      where: { uid },
      select: {
        favourite_list: true,
      },
    });

    if (!userRecord) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const favouriteListId = userRecord.favourite_list ?? null;

    const customVocabRows = await prisma.vocab.findMany({
      where: {
        reference_kind: "CUSTOM",
        customVocab: { uid },
      },
      select: {
        vocab_id: true,
        custom_vocab_id: true,
        customVocab: {
          select: {
            custom_vocab_id: true,
            source_lang: true,
            target_lang: true,
            source_text: true,
            target_text: true,
          },
        },
      },
      orderBy: { vocab_id: "asc" },
    });

    if (customVocabRows.length === 0) {
      return res.json({ ok: true, customWords: [] });
    }

    const vocabIds = customVocabRows.map((row) => row.vocab_id);
    const metadataMap = await fetchVocabMetadataForIds(vocabIds);

    const [hiddenRows, favouriteRows, listMembershipRows] = await Promise.all([
      prisma.hiddenVocab.findMany({
        where: {
          uid,
          vocab_id: { in: vocabIds },
        },
        select: { vocab_id: true },
      }),
      favouriteListId
        ? prisma.vocabListItem.findMany({
          where: {
            list_id: favouriteListId,
            vocab_id: { in: vocabIds },
          },
          select: { vocab_id: true },
        })
        : Promise.resolve<{ vocab_id: number }[]>([]),
      prisma.vocabListItem.findMany({
        where: {
          vocab_id: { in: vocabIds },
          listRef: { uid },
        },
        select: {
          vocab_id: true,
          list_id: true,
          listRef: {
            select: { list_name: true },
          },
        },
      }),
    ]);

    const hiddenSet = new Set(hiddenRows.map((row) => row.vocab_id));
    const favouriteSet = new Set(favouriteRows.map((row) => row.vocab_id));

    const listIdSet = new Map<number, Set<number>>();
    const listDetailMap = new Map<number, { id: number; name: string }[]>();

    listMembershipRows.forEach((row) => {
      if (!listIdSet.has(row.vocab_id)) listIdSet.set(row.vocab_id, new Set());
      listIdSet.get(row.vocab_id)!.add(row.list_id);

      const listName = row.listRef?.list_name ?? null;
      if (listName) {
        if (!listDetailMap.has(row.vocab_id)) listDetailMap.set(row.vocab_id, []);
        listDetailMap.get(row.vocab_id)!.push({ id: row.list_id, name: listName });
      }
    });

    const customWords = customVocabRows
      .map((row) => {
        const meta = metadataMap.get(row.vocab_id);
        if (!meta) return null;

        const customEntry = row.customVocab;
        const customVocabId = row.custom_vocab_id ?? customEntry?.custom_vocab_id ?? null;
        if (customVocabId === null) return null;

        const listIds = listIdSet.has(row.vocab_id)
          ? Array.from(listIdSet.get(row.vocab_id)!).sort((a, b) => a - b)
          : [];

        const lists = listDetailMap.has(row.vocab_id)
          ? Array.from(
            new Map(
              listDetailMap.get(row.vocab_id)!.map((entry) => [entry.id, entry.name])
            ).entries()
          )
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name))
          : [];

        return {
          vocabId: row.vocab_id,
          customVocabId,
          referenceKind: meta.referenceKind,
          referenceId: meta.referenceId,
          sourceLang: customEntry?.source_lang ?? null,
          targetLang: customEntry?.target_lang ?? null,
          sourceText: customEntry?.source_text ?? null,
          targetText: customEntry?.target_text ?? null,
          isHidden: hiddenSet.has(row.vocab_id),
          isFavourite: favouriteSet.has(row.vocab_id),
          listIds,
          lists,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    res.json({
      ok: true,
      customWords,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

export default router;
