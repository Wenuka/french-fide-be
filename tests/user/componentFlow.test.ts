import request from "supertest";
import {
  createApp,
  mockPrisma,
  mockedHelpers,
  resetAllMocks,
} from "./testUtils";

const actualHelpers = jest.requireActual("../../src/routes/user/helpers");

interface UserRow {
  id: number;
  uid: string;
  email?: string | null;
  emailVerified?: boolean;
  favourite_list: number | null;
}

interface ListRow {
  list_id: number;
  uid: string;
  list_name: string;
}

interface ListItemRow {
  id: number;
  list_id: number;
  vocab_id: number;
  list_name: string | null;
  importance: number;
  timesGreen: number;
  timesRed: number;
  vocab_status: string;
}

interface VocabRow {
  vocab_id: number;
  reference_kind: "DEFAULT" | "CUSTOM";
  reference_id: number | null;
  custom_vocab_id: number | null;
}

interface CustomVocabRow {
  custom_vocab_id: number;
  uid: string;
  source_lang: string;
  target_lang: string;
}

interface MockDb {
  userIdCounter: number;
  listIdCounter: number;
  listItemIdCounter: number;
  usersByUid: Map<string, UserRow>;
  usersById: Map<number, UserRow>;
  listsById: Map<number, ListRow>;
  listByUidName: Map<string, number>;
  listItemsById: Map<number, ListItemRow>;
  hiddenPairs: Set<string>;
  vocab: Map<number, VocabRow>;
  customVocabs: Map<number, CustomVocabRow>;
}

const createMockDb = (): MockDb => ({
  userIdCounter: 1,
  listIdCounter: 1,
  listItemIdCounter: 1,
  usersByUid: new Map<string, UserRow>(),
  usersById: new Map<number, UserRow>(),
  listsById: new Map<number, ListRow>(),
  listByUidName: new Map<string, number>(),
  listItemsById: new Map<number, ListItemRow>(),
  hiddenPairs: new Set<string>(),
  vocab: new Map<number, VocabRow>([
    [501, { vocab_id: 501, reference_kind: "CUSTOM", reference_id: null, custom_vocab_id: 900 }],
    [610, { vocab_id: 610, reference_kind: "DEFAULT", reference_id: 200, custom_vocab_id: null }],
  ]),
  customVocabs: new Map<number, CustomVocabRow>([
    [900, { custom_vocab_id: 900, uid: "test-user", source_lang: "EN", target_lang: "FR" }],
  ]),
});

const makeListItem = (db: MockDb, data: Partial<ListItemRow> & { list_id: number; vocab_id: number; list_name?: string | null }): ListItemRow => {
  const row: ListItemRow = {
    id: db.listItemIdCounter++,
    list_id: data.list_id,
    vocab_id: data.vocab_id,
    list_name: data.list_name ?? null,
    importance: data.importance ?? 0,
    timesGreen: data.timesGreen ?? 0,
    timesRed: data.timesRed ?? 0,
    vocab_status: data.vocab_status ?? "unknown",
  };
  db.listItemsById.set(row.id, row);
  return row;
};

const applyVocabSelect = (db: MockDb, row: VocabRow, select: any) => {
  const result: any = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) continue;
    if (key === "customVocab") {
      const cv = row.custom_vocab_id ? db.customVocabs.get(row.custom_vocab_id) ?? null : null;
      if (value && typeof value === "object" && "select" in (value as any)) {
        const selection = (value as any).select;
        if (!cv) {
          result.customVocab = null;
        } else if (selection && typeof selection === "object") {
          const nested: any = {};
          for (const [nestedKey, nestedVal] of Object.entries(selection as Record<string, unknown>)) {
            if (nestedVal) nested[nestedKey] = (cv as any)[nestedKey];
          }
          result.customVocab = nested;
        } else {
          result.customVocab = cv;
        }
      } else {
        result.customVocab = cv;
      }
    } else {
      result[key] = (row as any)[key];
    }
  }
  return result;
};

const matchNumberFilter = (value: number, filter: any): boolean => {
  if (typeof filter === "number") return value === filter;
  if (filter && typeof filter === "object" && Array.isArray(filter.in)) {
    return filter.in.includes(value);
  }
  return false;
};

const configurePrismaMocks = (db: MockDb) => {
  const getListKey = (uid: string, listName: string) => `${uid}:${listName}`;

  mockPrisma.user.upsert.mockImplementation(async ({ where, create, update }: any) => {
    const uid = where.uid;
    let row = db.usersByUid.get(uid);
    if (!row) {
      row = {
        id: db.userIdCounter++,
        uid,
        email: create?.email ?? null,
        emailVerified: create?.emailVerified ?? false,
        favourite_list: null,
      };
      db.usersByUid.set(uid, row);
      db.usersById.set(row.id, row);
    } else if (update) {
      if (Object.prototype.hasOwnProperty.call(update, "email")) {
        row.email = update.email ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(update, "emailVerified")) {
        row.emailVerified = update.emailVerified;
      }
    }
    return { ...row };
  });

  mockPrisma.user.update.mockImplementation(async ({ where, data }: any) => {
    const id = where.id;
    const row = db.usersById.get(id);
    if (!row) throw new Error("User not found");
    if (Object.prototype.hasOwnProperty.call(data, "favourite_list")) {
      row.favourite_list = data.favourite_list ?? null;
    }
    return { ...row };
  });

  mockPrisma.user.findUnique.mockImplementation(async ({ where, select }: any) => {
    let row: UserRow | undefined;
    if (where?.uid !== undefined) {
      row = db.usersByUid.get(where.uid);
    } else if (where?.id !== undefined) {
      row = db.usersById.get(where.id);
    }
    if (!row) return null;
    if (!select) return { ...row };
    const result: any = {};
    if (select.favourite_list) result.favourite_list = row.favourite_list ?? null;
    if (select.favouriteList) {
      const list = row.favourite_list ? db.listsById.get(row.favourite_list) ?? null : null;
      if (!list) {
        result.favouriteList = null;
      } else if (select.favouriteList.select) {
        const payload: any = {};
        const listSelect = select.favouriteList.select;
        if (listSelect.list_id) payload.list_id = list.list_id;
        if (listSelect.list_name) payload.list_name = list.list_name;
        result.favouriteList = payload;
      } else {
        result.favouriteList = { list_id: list.list_id, list_name: list.list_name };
      }
    }
    if (select.uid) result.uid = row.uid;
    if (select.email) result.email = row.email ?? null;
    if (select.emailVerified) result.emailVerified = row.emailVerified ?? false;
    return result;
  });

  mockPrisma.vocabList.upsert.mockImplementation(async ({ where, create }: any) => {
    const key = getListKey(where.uid_list_name.uid, where.uid_list_name.list_name);
    const existingId = db.listByUidName.get(key);
    if (existingId) {
      const list = db.listsById.get(existingId)!;
      return { ...list };
    }
    const row: ListRow = {
      list_id: db.listIdCounter++,
      uid: create.uid,
      list_name: create.list_name,
    };
    db.listsById.set(row.list_id, row);
    db.listByUidName.set(key, row.list_id);
    return { ...row };
  });

  mockPrisma.vocabList.create.mockImplementation(async ({ data }: any) => {
    const row: ListRow = {
      list_id: db.listIdCounter++,
      uid: data.uid,
      list_name: data.list_name,
    };
    db.listsById.set(row.list_id, row);
    db.listByUidName.set(getListKey(row.uid, row.list_name), row.list_id);
    return { ...row };
  });

  mockPrisma.vocabList.findMany.mockImplementation(async ({ where, include, orderBy }: any = {}) => {
    let rows = Array.from(db.listsById.values());
    if (where?.uid !== undefined) {
      rows = rows.filter((list) => list.uid === where.uid);
    }
    if (orderBy?.list_id === "asc") {
      rows.sort((a, b) => a.list_id - b.list_id);
    }
    return rows.map((list) => {
      const base: any = { ...list };
      if (include?.items) {
        let items = Array.from(db.listItemsById.values()).filter((item) => item.list_id === list.list_id);
        const itemOrder = include.items.orderBy;
        if (itemOrder?.id === "asc") items.sort((a, b) => a.id - b.id);
        base.items = items.map((item) => ({ ...item }));
      }
      return base;
    });
  });

  mockPrisma.vocabList.findUnique.mockImplementation(async ({ where, select }: any) => {
    const list = db.listsById.get(where.list_id);
    if (!list) return null;
    if (!select) return { ...list };
    const result: any = {};
    for (const [key, value] of Object.entries(select)) {
      if (!value) continue;
      if (key === "list_id" || key === "list_name" || key === "uid") {
        result[key] = (list as any)[key];
      }
    }
    return result;
  });

  mockPrisma.vocabListItem.createMany.mockImplementation(async ({ data, skipDuplicates }: any) => {
    let count = 0;
    for (const entry of data as any[]) {
      const exists = Array.from(db.listItemsById.values()).some(
        (item) => item.list_id === entry.list_id && item.vocab_id === entry.vocab_id
      );
      if (exists && skipDuplicates) continue;
      if (exists && !skipDuplicates) continue;
      makeListItem(db, entry);
      count += 1;
    }
    return { count };
  });

  mockPrisma.vocabListItem.upsert.mockImplementation(async ({ where, create, update }: any) => {
    // Try to find an existing item by composite key
    let item: ListItemRow | undefined;
    if (where?.list_id_vocab_id) {
      item = Array.from(db.listItemsById.values()).find(
        (entry) =>
          entry.list_id === where.list_id_vocab_id.list_id &&
          entry.vocab_id === where.list_id_vocab_id.vocab_id
      );
    }
    if (!item) {
      // Create new
      return { ...makeListItem(db, create) };
    }
    // Update existing
    Object.assign(item, update);
    return { ...item };
  });

  const matchListItem = (item: ListItemRow, where: any): boolean => {
    if (!where) return true;
    if (where.list_id !== undefined) {
      if (typeof where.list_id === "number" && item.list_id !== where.list_id) return false;
      if (where.list_id?.in && !where.list_id.in.includes(item.list_id)) return false;
    }
    if (where.vocab_id !== undefined) {
      if (typeof where.vocab_id === "number" && item.vocab_id !== where.vocab_id) return false;
      if (where.vocab_id?.in && !where.vocab_id.in.includes(item.vocab_id)) return false;
    }
    if (where.listRef?.uid !== undefined) {
      const list = db.listsById.get(item.list_id);
      if (!list || list.uid !== where.listRef.uid) return false;
    }
    if (where.vocab) {
      const vocabRow = db.vocab.get(item.vocab_id);
      if (!vocabRow) return false;
      if (
        where.vocab.reference_kind !== undefined &&
        vocabRow.reference_kind !== where.vocab.reference_kind
      ) {
        return false;
      }
      if (
        where.vocab.reference_id !== undefined &&
        !matchNumberFilter(vocabRow.reference_id ?? -1, where.vocab.reference_id)
      ) {
        return false;
      }
      if (
        where.vocab.custom_vocab_id !== undefined &&
        !matchNumberFilter(vocabRow.custom_vocab_id ?? -1, where.vocab.custom_vocab_id)
      ) {
        return false;
      }
    }
    return true;
  };

  mockPrisma.vocabListItem.findMany.mockImplementation(async ({ where, select, orderBy }: any = {}) => {
    let items = Array.from(db.listItemsById.values());
    if (where) items = items.filter((item) => matchListItem(item, where));
    if (orderBy?.id === "asc") items.sort((a, b) => a.id - b.id);
    if (!select) return items.map((item) => ({ ...item }));
    return items.map((item) => {
      const result: any = {};
      for (const [key, value] of Object.entries(select)) {
        if (!value) continue;
        if (key === "list_id") result.list_id = item.list_id;
        else if (key === "vocab_id") result.vocab_id = item.vocab_id;
        else if (key === "id") result.id = item.id;
        else if (key === "list_name") result.list_name = item.list_name;
        else if (key === "importance") result.importance = item.importance;
        else if (key === "timesGreen") result.timesGreen = item.timesGreen;
        else if (key === "timesRed") result.timesRed = item.timesRed;
        else if (key === "vocab_status") result.vocab_status = item.vocab_status;
      }
      return result;
    });
  });

  mockPrisma.vocabListItem.findFirst.mockImplementation(async ({ where, select }: any = {}) => {
    const items = Array.from(db.listItemsById.values()).filter((item) => matchListItem(item, where));
    const found = items[0];
    if (!found) return null;
    if (!select) return { ...found };
    const result: any = {};
    for (const [key, value] of Object.entries(select)) {
      if (!value) continue;
      if (key === "list_id") result.list_id = found.list_id;
      else if (key === "vocab_id") result.vocab_id = found.vocab_id;
      else if (key === "id") result.id = found.id;
      else if (key === "list_name") result.list_name = found.list_name;
      else if (key === "importance") result.importance = found.importance;
      else if (key === "timesGreen") result.timesGreen = found.timesGreen;
      else if (key === "timesRed") result.timesRed = found.timesRed;
      else if (key === "vocab_status") result.vocab_status = found.vocab_status;
    }
    return result;
  });

  mockPrisma.vocabListItem.create.mockImplementation(async ({ data }: any) => {
    return { ...makeListItem(db, data) };
  });

  mockPrisma.vocabListItem.findUnique.mockImplementation(async ({ where, include }: any) => {
    let item: ListItemRow | undefined;
    if (where?.id !== undefined) {
      item = db.listItemsById.get(where.id);
    } else if (where?.list_id_vocab_id) {
      item = Array.from(db.listItemsById.values()).find(
        (entry) =>
          entry.list_id === where.list_id_vocab_id.list_id &&
          entry.vocab_id === where.list_id_vocab_id.vocab_id
      );
    }
    if (!item) return null;
    const result: any = { ...item };
    if (include?.listRef) {
      const list = db.listsById.get(item.list_id);
      const select = include.listRef.select ?? {};
      if (!list) {
        result.listRef = null;
      } else {
        const payload: any = {};
        if (select.uid) payload.uid = list.uid;
        if (select.list_id) payload.list_id = list.list_id;
        if (select.list_name) payload.list_name = list.list_name;
        result.listRef = payload;
      }
    }
    return result;
  });

  mockPrisma.vocabListItem.update.mockImplementation(async ({ where, data }: any) => {
    const item = db.listItemsById.get(where.id);
    if (!item) throw new Error("List item not found");
    Object.assign(item, data);
    return { ...item };
  });

  mockPrisma.vocab.findMany.mockImplementation(async ({ where, select, orderBy }: any = {}) => {
    let rows = Array.from(db.vocab.values());
    if (where) {
      rows = rows.filter((row) => {
        if (where.vocab_id !== undefined && !matchNumberFilter(row.vocab_id, where.vocab_id)) return false;
        if (where.reference_kind !== undefined && row.reference_kind !== where.reference_kind) return false;
        if (where.reference_id !== undefined && !matchNumberFilter(row.reference_id ?? -1, where.reference_id)) return false;
        if (where.custom_vocab_id !== undefined && !matchNumberFilter(row.custom_vocab_id ?? -1, where.custom_vocab_id))
          return false;
        if (where.customVocab?.uid !== undefined) {
          const cv = row.custom_vocab_id ? db.customVocabs.get(row.custom_vocab_id) ?? null : null;
          if (!cv || cv.uid !== where.customVocab.uid) return false;
        }
        return true;
      });
    }
    if (orderBy?.vocab_id === "asc") rows.sort((a, b) => a.vocab_id - b.vocab_id);
    if (!select) {
      return rows.map((row) => ({ ...row }));
    }
    return rows.map((row) => applyVocabSelect(db, row, select));
  });

  mockPrisma.vocab.findFirst.mockImplementation(async ({ where, select }: any = {}) => {
    const rows = await mockPrisma.vocab.findMany({ where, select });
    return rows[0] ?? null;
  });

  mockPrisma.hiddenVocab.findMany.mockImplementation(async ({ where, select }: any = {}) => {
    const rows = Array.from(db.hiddenPairs).map((key) => {
      const [uid, vocabStr] = key.split(":");
      return { uid, vocab_id: Number(vocabStr) };
    });
    const filtered = rows.filter((row) => {
      if (!where) return true;
      if (where.uid !== undefined && row.uid !== where.uid) return false;
      if (where.vocab_id !== undefined && !matchNumberFilter(row.vocab_id, where.vocab_id)) return false;
      return true;
    });
    if (!select) return filtered.map((row) => ({ ...row }));
    return filtered.map((row) => {
      const result: any = {};
      if (select.uid) result.uid = row.uid;
      if (select.vocab_id) result.vocab_id = row.vocab_id;
      return result;
    });
  });

  mockPrisma.hiddenVocab.createMany.mockImplementation(async ({ data }: any) => {
    let count = 0;
    for (const entry of data as any[]) {
      const key = `${entry.uid}:${entry.vocab_id}`;
      if (!db.hiddenPairs.has(key)) {
        db.hiddenPairs.add(key);
        count += 1;
      }
    }
    return { count };
  });
};

describe("User routes component flow", () => {
  let db: MockDb;

  beforeEach(() => {
    resetAllMocks();
    db = createMockDb();
    configurePrismaMocks(db);

    mockedHelpers.resolveVocabIdentifiersToIds.mockImplementation(
      actualHelpers.resolveVocabIdentifiersToIds
    );
    mockedHelpers.fetchVocabMetadataForIds.mockImplementation(
      actualHelpers.fetchVocabMetadataForIds
    );
    mockedHelpers.buildVocabListItemResponse.mockImplementation(
      actualHelpers.buildVocabListItemResponse
    );
    mockedHelpers.buildVocabMetadataPayload.mockImplementation(
      actualHelpers.buildVocabMetadataPayload
    );
    mockedHelpers.resolveWordReferenceToVocabId.mockImplementation(
      actualHelpers.resolveWordReferenceToVocabId
    );
    mockedHelpers.extractUidFromRequest.mockImplementation(
      actualHelpers.extractUidFromRequest
    );
  });

  test("handles a typical user flow with mock data", async () => {
    const app = createApp();

    // Login creates the user and favourite list.
    const loginRes = await request(app).post("/user/login").send({});
    expect(loginRes.status).toBe(200);

    // Create a custom list with two vocab identifiers.
    const createListRes = await request(app)
      .post("/user/createList")
      .send({
        listName: "Deck A",
        words: [
          { wordRefId: 200, wordRefKind: "DEFAULT" },
          { wordRefId: 900, wordRefKind: "CUSTOM" },
        ],
      });
    expect(createListRes.status).toBe(201);

    // Add both words to favourites and hide the default vocab entry.
    const favResOne = await request(app)
      .post("/user/favourites")
      .send({
        wordRefId: 900,
        wordRefKind: "CUSTOM",
      });
    expect(favResOne.status).toBe(201);
    const favResTwo = await request(app)
      .post("/user/favourites")
      .send({
        wordRefId: 200,
        wordRefKind: "DEFAULT",
      });
    expect(favResTwo.status).toBe(201);
    const hideRes = await request(app)
      .post("/user/hidden")
      .send({
        wordRefId: 200,
        wordRefKind: "DEFAULT",
      });
    expect(hideRes.status).toBe(204);

    const hiddenRes = await request(app).get("/user/hidden");
    expect(hiddenRes.status).toBe(200);
    expect(hiddenRes.body.hidden).toEqual([
      expect.objectContaining({
        vocabId: 610,
        wordRefKind: "DEFAULT",
        wordRefId: 200,
      }),
    ]);

    // Lists endpoint should include both user lists with their items populated.
    const listsRes = await request(app).get("/user/lists");
    expect(listsRes.status).toBe(200);
    expect(listsRes.body.lists).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Deck A",
          words: expect.arrayContaining([
            expect.objectContaining({ vocabId: 501, wordRefKind: "CUSTOM", wordRefId: 900 }),
            expect.objectContaining({ vocabId: 610, wordRefKind: "DEFAULT", wordRefId: 200 }),
          ]),
        }),
        expect.objectContaining({
          name: actualHelpers.FAVOURITES_LIST_NAME,
          words: expect.arrayContaining([
            expect.objectContaining({ vocabId: 501, wordRefKind: "CUSTOM", wordRefId: 900 }),
            expect.objectContaining({ vocabId: 610, wordRefKind: "DEFAULT", wordRefId: 200 }),
          ]),
        }),
      ])
    );
    
    // Custom words endpoint exposes custom vocab metadata and favourite flag.
    const customRes = await request(app).get("/user/custom-words");
    expect(customRes.status).toBe(200);
    expect(customRes.body.customWords).toEqual([
      expect.objectContaining({
        vocabId: 501,
        customVocabId: 900,
        sourceLang: "EN",
        targetLang: "FR",
        isFavourite: true,
        isHidden: false,
      }),
    ]);
  });
});
