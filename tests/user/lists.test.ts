import request from "supertest";
import {
  createApp,
  mockPrisma,
  mockedHelpers,
  resetAllMocks,
} from "./testUtils";
import { FAVOURITES_LIST_NAME } from "../../src/routes/user/helpers";

describe("User list routes", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test("POST /user/createList creates a list with resolved vocab ids", async () => {
    const app = createApp();

    mockedHelpers.resolveWordReferenceToVocabId
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(12);

    mockPrisma.vocabList.create.mockResolvedValue({ list_id: 5, list_name: "My list" });
    mockPrisma.vocabListItem.createMany.mockResolvedValue({ count: 2 });

    const response = await request(app)
      .post("/user/createList")
      .send({
        listName: "My list",
        words: [
          { wordRefId: 11, wordRefKind: "DEFAULT" },
          { wordRefId: 12, wordRefKind: "CUSTOM" },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ok: true,
      list: { id: 5, name: "My list" },
      vocabIds: [11, 12],
    });
    expect(mockPrisma.vocabList.create).toHaveBeenCalled();
    expect(mockPrisma.vocabListItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) })
    );
  });

  test("GET /user/lists returns lists with mapped items", async () => {
    const app = createApp();

    const listItems = [
      {
        id: 1,
        list_id: 7,
        vocab_id: 101,
        list_name: "Core",
        importance: 0,
        timesGreen: 0,
        timesRed: 0,
        vocab_status: "unknown",
      },
    ];

    mockPrisma.vocabList.findMany.mockResolvedValue([
      { list_id: 7, list_name: "Core", items: listItems },
    ]);

    mockedHelpers.fetchVocabMetadataForIds.mockResolvedValue(
      new Map([[101, { referenceKind: "DEFAULT", referenceId: 55, customVocabId: null }]])
    );

    const response = await request(app).get("/user/lists");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      hasGeneratedDefaultLists: false,
      lists: [
        {
          id: 7,
          name: "Core",
          words: [
            {
              itemId: 1,
              vocabId: 101,
              wordRefKind: "DEFAULT",
              wordRefId: 55,
              importance: 0,
              timesGreen: 0,
              timesRed: 0,
              vocabStatus: "unknown",
            },
          ],
        },
      ],
    });
    expect(mockPrisma.vocabList.findMany).toHaveBeenCalled();
  });

  test("POST /user/lists/:id/words adds vocab to list", async () => {
    const app = createApp();

    mockedHelpers.resolveVocabIdentifiersToIds.mockResolvedValue({
      vocabIds: [205],
      missingVocabIds: [],
      missingReferenceIds: [],
      missingCustomVocabIds: [],
    });

    mockPrisma.vocabList.findUnique.mockResolvedValue({
      list_id: 9,
      list_name: "Practice",
      uid: "test-user",
      userId: 1,
    });
    mockPrisma.vocabListItem.findMany.mockResolvedValue([]);
    mockPrisma.vocabListItem.createMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .post("/user/lists/9/words")
      .send({ words: [205] });

    expect(response.status).toBe(200);
    expect(response.body.added).toEqual([205]);
    expect(mockPrisma.vocabListItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) })
    );
  });

  test("PATCH /user/lists/:listId/items/:itemId updates list item status", async () => {
    const app = createApp();

    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, uid: "test-user" });

    mockPrisma.vocabListItem.findUnique.mockResolvedValue({
      id: 14,
      vocab_id: 300,
      list_id: 4,
      listRef: { uid: "test-user", list_id: 4, list_name: "Review", userId: 1 },
    });
    mockPrisma.vocabListItem.update.mockResolvedValue({
      id: 14,
      list_id: 4,
      vocab_id: 300,
      importance: 0.5,
      timesGreen: 3,
      timesRed: 1,
      vocab_status: "green",
    });
    mockedHelpers.fetchVocabMetadataForIds.mockResolvedValue(
      new Map([[300, { referenceKind: "DEFAULT", referenceId: 88, customVocabId: null }]])
    );
    mockedHelpers.buildVocabListItemResponse.mockImplementation(
      (item: any, metadataMap: Map<number, any>) => {
        const meta = metadataMap.get(item.vocab_id) ?? {};
        return {
          id: item.id,
          listId: item.list_id,
          vocabId: item.vocab_id,
          referenceKind: meta.referenceKind ?? null,
          referenceId: meta.referenceId ?? null,
          customVocabId: meta.customVocabId ?? null,
          listName: item.list_name ?? null,
          importance: item.importance ?? 0,
          timesGreen: item.timesGreen ?? 0,
          timesRed: item.timesRed ?? 0,
          vocabStatus: item.vocab_status ?? "unknown",
        };
      }
    );

    const response = await request(app)
      .patch("/user/lists/4/items/14")
      .send({ status: "green" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      item: expect.objectContaining({
        id: 14,
        listId: 4,
        vocabId: 300,
        referenceKind: "DEFAULT",
        referenceId: 88,
        customVocabId: null,
        listName: "Review",
        importance: 0.5,
        timesGreen: 3,
        timesRed: 1,
        vocabStatus: "green",
      }),
    });
    expect(mockPrisma.vocabListItem.update).toHaveBeenCalled();
  });

  test("DELETE /user/lists/:listId deletes list and its items when allowed", async () => {
    const app = createApp();

    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, favourite_list: 99 });
    mockPrisma.vocabList.findUnique.mockResolvedValue({
      list_id: 12,
      list_name: "Practice",
      userId: 1,
    });
    mockPrisma.vocabListItem.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.vocabList.delete.mockResolvedValue({ list_id: 12 });

    const response = await request(app).delete("/user/lists/12");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, deletedListId: 12 });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { uid: "test-user" },
      select: { id: true, favourite_list: true },
    });
    expect(mockPrisma.vocabListItem.deleteMany).toHaveBeenCalledWith({
      where: { list_id: 12 },
    });
    expect(mockPrisma.vocabList.delete).toHaveBeenCalledWith({
      where: { list_id: 12 },
    });
  });

  test("DELETE /user/lists/:listId rejects deletion of favourites list", async () => {
    const app = createApp();

    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, favourite_list: 7 });
    mockPrisma.vocabList.findUnique.mockResolvedValue({
      list_id: 7,
      list_name: FAVOURITES_LIST_NAME,
      userId: 1,
    });

    const response = await request(app).delete("/user/lists/7");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Cannot delete favourites list" });
    expect(mockPrisma.vocabListItem.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.vocabList.delete).not.toHaveBeenCalled();
  });
  test("POST /user/lists/:listId/items/bulk-progress updates multiple items", async () => {
    const app = createApp();

    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, uid: "test-user" });
    mockPrisma.vocabListItem.findMany.mockResolvedValue([
      { id: 101, listRef: { userId: 1, list_id: 5 } },
      { id: 102, listRef: { userId: 1, list_id: 5 } },
    ]);
    mockPrisma.vocabListItem.update.mockResolvedValue({});

    const response = await request(app)
      .post("/user/lists/5/items/bulk-progress")
      .send({
        updates: [
          { itemId: 101, status: "green", timesGreen: 5 },
          { itemId: 102, status: "red", timesRed: 2 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, updated: 2 });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { uid: "test-user" } });
    expect(mockPrisma.vocabListItem.findMany).toHaveBeenCalled();
    expect(mockPrisma.vocabListItem.update).toHaveBeenCalledTimes(2);
  });

  test("DELETE /user/lists/:listId/words removes words from list", async () => {
    const app = createApp();

    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, uid: "test-user" });

    mockedHelpers.resolveVocabIdentifiersToIds.mockResolvedValue({
      vocabIds: [205],
      missingVocabIds: [],
      missingReferenceIds: [],
      missingCustomVocabIds: [],
    });

    mockPrisma.vocabList.findUnique.mockResolvedValue({
      list_id: 9,
      list_name: "Practice",
      uid: "test-user",
      userId: 1,
    });
    mockPrisma.vocabListItem.deleteMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .delete("/user/lists/9/words")
      .send({ words: [205] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      list: { id: 9, name: "Practice" },
      removedCount: 1,
      removedVocabIds: [205],
    });
    expect(mockPrisma.vocabListItem.deleteMany).toHaveBeenCalledWith({
      where: {
        list_id: 9,
        vocab_id: { in: [205] },
      },
    });
  });
});
