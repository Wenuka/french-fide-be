import type { Request } from "express";
import { prisma } from "../../lib/prisma";

export const FAVOURITES_LIST_NAME = "Favourites";

export type WordIdentifier =
  | number
  | string
  | {
    vocabId?: number | string;
    referenceId?: number | string;
    customVocabId?: number | string;
  };

export const parsePositiveInteger = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
};

export type NormalizedWordRefKind = "DEFAULT" | "CUSTOM";

type WordRefValidationSuccess = {
  ok: true;
  refId: number;
  refKind: NormalizedWordRefKind;
};

type WordRefValidationError = {
  ok: false;
  status: number;
  error: string;
};

export type WordRefValidationResult = WordRefValidationSuccess | WordRefValidationError;

export const validateWordRefPayload = (payload: unknown): WordRefValidationResult => {
  const body = (payload ?? {}) as any;
  const { wordRefId, wordRefKind } = body;

  const parsedRefId = parsePositiveInteger(wordRefId);
  if (parsedRefId === null) {
    return { ok: false, status: 400, error: "`wordRefId` must be a positive integer" };
  }

  if (typeof wordRefKind !== "string" || wordRefKind.trim().length === 0) {
    return { ok: false, status: 400, error: "`wordRefKind` must be a non-empty string" };
  }

  const normalizedKind = wordRefKind.trim().toUpperCase();
  if (normalizedKind !== "DEFAULT" && normalizedKind !== "CUSTOM") {
    return {
      ok: false,
      status: 400,
      error: "`wordRefKind` must be either `DEFAULT` or `CUSTOM`",
    };
  }

  return {
    ok: true,
    refId: parsedRefId,
    refKind: normalizedKind as NormalizedWordRefKind,
  };
};

type ResolveResult = {
  vocabIds: number[];
  missingVocabIds: number[];
  missingReferenceIds: number[];
  missingCustomVocabIds: number[];
  errorMessage?: string;
};

type GroupedIdentifiers = {
  directIds: Set<number>;
  referenceIds: Set<number>;
  customIds: Set<number>;
  error?: string;
};

const groupIdentifiers = (words: WordIdentifier[]): GroupedIdentifiers => {
  const directIds = new Set<number>();
  const referenceIds = new Set<number>();
  const customIds = new Set<number>();

  for (const rawWord of words) {
    // Handle direct numbers or numeric strings
    if (typeof rawWord === "number" || typeof rawWord === "string") {
      const parsed = parsePositiveInteger(rawWord);
      if (parsed === null) {
        return {
          directIds, referenceIds, customIds,
          error: "`words` must contain only positive integers or objects specifying vocab identifiers"
        };
      }
      directIds.add(parsed);
      continue;
    }

    // Handle objects
    if (rawWord && typeof rawWord === "object") {
      const candidate = rawWord as Record<string, unknown>;

      if (candidate.vocabId !== undefined) {
        const parsed = parsePositiveInteger(candidate.vocabId);
        if (parsed === null) return { directIds, referenceIds, customIds, error: "`vocabId` values must be positive integers" };
        directIds.add(parsed);
        continue;
      }

      if (candidate.referenceId !== undefined) {
        const parsed = parsePositiveInteger(candidate.referenceId);
        if (parsed === null) return { directIds, referenceIds, customIds, error: "`referenceId` values must be positive integers" };
        referenceIds.add(parsed);
        continue;
      }

      if (candidate.customVocabId !== undefined) {
        const parsed = parsePositiveInteger(candidate.customVocabId);
        if (parsed === null) return { directIds, referenceIds, customIds, error: "`customVocabId` values must be positive integers" };
        customIds.add(parsed);
        continue;
      }

      return {
        directIds, referenceIds, customIds,
        error: "Each word object must include `vocabId`, `referenceId`, or `customVocabId`"
      };
    }

    return {
      directIds, referenceIds, customIds,
      error: "`words` entries must be numbers, numeric strings, or objects describing vocab identifiers"
    };
  }

  return { directIds, referenceIds, customIds };
};

const fetchDirectVocabIds = async (ids: Set<number>) => {
  if (ids.size === 0) return { resolved: [], missing: [] };
  const existing = await prisma.vocab.findMany({
    where: { vocab_id: { in: Array.from(ids) } },
    select: { vocab_id: true },
  });
  const found = new Set(existing.map((row) => row.vocab_id));
  return {
    resolved: existing.map(row => row.vocab_id),
    missing: Array.from(ids).filter((id) => !found.has(id))
  };
};

const fetchReferenceVocabIds = async (ids: Set<number>) => {
  if (ids.size === 0) return { resolved: [], missing: [] };
  const existing = await prisma.vocab.findMany({
    where: {
      reference_kind: "DEFAULT",
      reference_id: { in: Array.from(ids) },
    },
    select: { vocab_id: true, reference_id: true },
  });
  const found = new Set(existing.map((row) => row.reference_id ?? -1));
  return {
    resolved: existing.map(row => row.vocab_id),
    missing: Array.from(ids).filter((id) => !found.has(id))
  };
};

const fetchCustomVocabIds = async (ids: Set<number>) => {
  if (ids.size === 0) return { resolved: [], missing: [] };
  const existing = await prisma.vocab.findMany({
    where: {
      reference_kind: "CUSTOM",
      custom_vocab_id: { in: Array.from(ids) },
    },
    select: { vocab_id: true, custom_vocab_id: true },
  });
  const found = new Set(existing.map((row) => row.custom_vocab_id ?? -1));
  return {
    resolved: existing.map(row => row.vocab_id),
    missing: Array.from(ids).filter((id) => !found.has(id))
  };
};

export const resolveVocabIdentifiersToIds = async (words: WordIdentifier[]): Promise<ResolveResult> => {
  const { directIds, referenceIds, customIds, error } = groupIdentifiers(words);

  if (error) {
    return {
      vocabIds: [],
      missingVocabIds: [],
      missingReferenceIds: [],
      missingCustomVocabIds: [],
      errorMessage: error,
    };
  }

  const [directResult, referenceResult, customResult] = await Promise.all([
    fetchDirectVocabIds(directIds),
    fetchReferenceVocabIds(referenceIds),
    fetchCustomVocabIds(customIds)
  ]);

  const resolvedIds = new Set<number>([
    ...directResult.resolved,
    ...referenceResult.resolved,
    ...customResult.resolved
  ]);

  return {
    vocabIds: Array.from(resolvedIds),
    missingVocabIds: directResult.missing,
    missingReferenceIds: referenceResult.missing,
    missingCustomVocabIds: customResult.missing,
  };
};

export type VocabMetadata = {
  referenceKind: string | null;
  referenceId: number | null;
  customVocabId: number | null;
  sourceText?: string | null;
  targetText?: string | null;
  sourceLang?: string | null;
  targetLang?: string | null;
};

export const fetchVocabMetadataForIds = async (vocabIds: number[]): Promise<Map<number, VocabMetadata>> => {
  if (vocabIds.length === 0) return new Map();

  const rows = await prisma.vocab.findMany({
    where: { vocab_id: { in: vocabIds } },
    select: {
      vocab_id: true,
      reference_kind: true,
      reference_id: true,
      custom_vocab_id: true,
      customVocab: {
        select: {
          source_text: true,
          target_text: true,
          source_lang: true,
          target_lang: true,
        },
      },
    },
  });

  const metadataMap = new Map<number, VocabMetadata>();
  for (const row of rows) {
    metadataMap.set(row.vocab_id, {
      referenceKind: row.reference_kind ?? null,
      referenceId: row.reference_id ?? null,
      customVocabId: row.custom_vocab_id ?? null,
      sourceText: row.customVocab?.source_text ?? null,
      targetText: row.customVocab?.target_text ?? null,
      sourceLang: row.customVocab?.source_lang ?? null,
      targetLang: row.customVocab?.target_lang ?? null,
    });
  }

  return metadataMap;
};

export const buildVocabMetadataPayload = (vocabId: number, metadataMap: Map<number, VocabMetadata>) => {
  const meta = metadataMap.get(vocabId);
  return {
    vocabId,
    referenceKind: meta?.referenceKind ?? null,
    referenceId: meta?.referenceId ?? null,
    customVocabId: meta?.customVocabId ?? null,
  };
};

export const resolveWordReferenceToVocabId = async (
  uid: string,
  refId: number,
  refKind: "DEFAULT" | "CUSTOM"
): Promise<number | null> => {
  if (refKind === "DEFAULT") {
    const row = await prisma.vocab.findFirst({
      where: {
        reference_kind: "DEFAULT",
        reference_id: refId,
      },
      select: { vocab_id: true },
    });
    return row?.vocab_id ?? null;
  }

  const row = await prisma.vocab.findFirst({
    where: {
      reference_kind: "CUSTOM",
      custom_vocab_id: refId,
      customVocab: {
        uid,
      },
    },
    select: { vocab_id: true },
  });

  return row?.vocab_id ?? null;
};

type VocabListItemLike = {
  id: number;
  list_id: number;
  vocab_id: number;
  list_name: string | null;
  importance: number;
  timesGreen: number;
  timesRed: number;
  vocab_status: string;
};

export const buildVocabListItemResponse = (
  item: VocabListItemLike,
  metadataMap: Map<number, VocabMetadata>
) => {
  const meta = metadataMap.get(item.vocab_id);
  return {
    id: item.id,
    listId: item.list_id,
    vocabId: item.vocab_id,
    referenceKind: meta?.referenceKind ?? null,
    referenceId: meta?.referenceId ?? null,
    customVocabId: meta?.customVocabId ?? null,
    listName: item.list_name,
    importance: item.importance,
    timesGreen: item.timesGreen,
    timesRed: item.timesRed,
    vocabStatus: item.vocab_status,
  };
};

export const extractUidFromRequest = (req: Request): string | null => {
  const user = req.user as any;
  const uid: string | undefined = user?.user_id || user?.uid || user?.sub;
  return uid ?? null;
};
