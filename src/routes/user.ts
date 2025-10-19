import type { Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";

const router = Router();
const FAVOURITES_LIST_NAME = "Favourites";

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

    await prisma.$transaction(async (tx) => {
      const dbUser = await tx.user.upsert({
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

      const favouriteList = await tx.vocabList.upsert({
        where: {
          uid_list_name: {
            uid,
            list_name: FAVOURITES_LIST_NAME,
          },
        },
        update: {},
        create: {
          uid,
          list_name: FAVOURITES_LIST_NAME,
        },
      });

      if (dbUser.favourite_list !== favouriteList.list_id) {
        await tx.user.update({
          where: { id: dbUser.id },
          data: { favourite_list: favouriteList.list_id },
        });
      }
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

router.post("/createList", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const uid: string = user.user_id || user.uid || user.sub;
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });

    const { listName, words } = req.body ?? {};

    if (typeof listName !== "string" || listName.trim().length === 0) {
      return res.status(400).json({ error: "`listName` must be a non-empty string" });
    }

    const trimmedName = listName.trim();

    let wordIds: number[] = [];
    if (words !== undefined) {
      if (!Array.isArray(words)) {
        return res.status(400).json({ error: "`words` must be an array of vocab IDs" });
      }

      const parsedIds: number[] = [];
      for (const rawId of words) {
        const num = typeof rawId === "number" ? rawId : Number(rawId);
        if (!Number.isInteger(num) || num <= 0) {
          return res.status(400).json({ error: "`words` must contain only positive integer vocab IDs" });
        }
        parsedIds.push(num);
      }
      wordIds = Array.from(new Set(parsedIds));
    }

    if (wordIds.length > 0) {
      const existing = await prisma.vocab.findMany({
        where: { vocab_id: { in: wordIds } },
        select: { vocab_id: true },
      });
      const foundIds = new Set(existing.map((row) => row.vocab_id));
      const missing = wordIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        return res.status(400).json({
          error: "One or more vocab IDs do not exist",
          missing,
        });
      }
    }

    const createdList = await prisma.$transaction(async (tx) => {
      const list = await tx.vocabList.create({
        data: {
          uid,
          list_name: trimmedName,
        },
      });

      if (wordIds.length > 0) {
        await tx.vocabListItem.createMany({
          data: wordIds.map((vocabId) => ({
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

router.post("/lists/:listId/words", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const uid: string = user.user_id || user.uid || user.sub;
    if (!uid) return res.status(400).json({ error: "Invalid token payload (uid missing)" });
    const listIdParam = req.params.listId;
    const listId = Number(listIdParam);
    if (!Number.isInteger(listId) || listId <= 0) {
      return res.status(400).json({ error: "Invalid listId parameter" });
    }
    const { words } = req.body ?? {};
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: "`words` must be a non-empty array of vocab IDs" });
    }
    const wordIds: number[] = [];
    for (const rawId of words) {
      const num = typeof rawId === "number" ? rawId : Number(rawId);
      if (!Number.isInteger(num) || num <= 0) {
        return res.status(400).json({ error: "`words` must contain only positive integer vocab IDs" });
      }
      wordIds.push(num);
    }
    const uniqueWordIds = Array.from(new Set(wordIds));
    const list = await prisma.vocabList.findUnique({
      where: { list_id: listId },
      select: { list_id: true, list_name: true, uid: true },
    });
    if (!list || list.uid !== uid) {
      return res.status(404).json({ error: "List not found" });
    }
    const existingVocabs = await prisma.vocab.findMany({
      where: { vocab_id: { in: uniqueWordIds } },
      select: { vocab_id: true },
    });
    const existingIds = new Set(existingVocabs.map((row) => row.vocab_id));
    const missing = uniqueWordIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      return res.status(400).json({
        error: "One or more vocab IDs do not exist",
        missing,
      });
    }
    const existingListItems = await prisma.vocabListItem.findMany({
      where: {
        list_id: list.list_id,
        vocab_id: { in: uniqueWordIds },
      },
      select: { vocab_id: true },
    });
    const alreadyPresent = new Set(existingListItems.map((row) => row.vocab_id));
    const toInsert = uniqueWordIds.filter((id) => !alreadyPresent.has(id));
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
      skipped: uniqueWordIds.filter((id) => alreadyPresent.has(id)),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

export default router;
