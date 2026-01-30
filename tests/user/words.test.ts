import request from "supertest";
import {
  createApp,
  mockPrisma,
  mockedHelpers,
  resetAllMocks,
} from "./testUtils";

describe("User word routes", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  const expectWordsPayload = (body: any, expectedWords: any[]) => {
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.words)).toBe(true);
    expect(body.words).toHaveLength(expectedWords.length);
    expect(body.words).toEqual(expectedWords.map((word) => expect.objectContaining(word)));
  };

  const primeWordMocks = () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, uid: "test-user" });

    mockedHelpers.fetchVocabMetadataForIds.mockResolvedValue(
      new Map([
        [1, { referenceKind: "DEFAULT", referenceId: 5, customVocabId: null }],
        [2, { referenceKind: "CUSTOM", referenceId: null, customVocabId: 77 }],
      ])
    );

    return [
      {
        vocabId: 1,
        referenceKind: "DEFAULT",
        referenceId: 5,
        customVocabId: null,
      },
      {
        vocabId: 2,
        referenceKind: "CUSTOM",
        referenceId: null,
        customVocabId: 77,
      },
    ];
  };

  test("POST /user/words returns vocab scoped to the requested lists", async () => {
    const app = createApp();

    const expectedWords = primeWordMocks();

    mockPrisma.vocabList.findMany.mockResolvedValue([{ list_id: 10 }, { list_id: 99 }]);

    mockPrisma.vocabListItem.findMany.mockResolvedValue([
      { vocab_id: 1, list_id: 10 },
      { vocab_id: 2, list_id: 99 },
    ]);

    const response = await request(app).post("/user/words").send({ listIds: [10, 99] });

    expect(response.status).toBe(200);
    expectWordsPayload(response.body, expectedWords);
  });

  test("POST /user/words validates listIds payload type", async () => {
    const app = createApp();

    const response = await request(app).post("/user/words").send({ listIds: "not-an-array" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/listIds/i);
  });

  test("POST /user/words rejects list IDs that are not owned by the user", async () => {
    const app = createApp();

    primeWordMocks();
    mockPrisma.vocabList.findMany.mockResolvedValue([{ list_id: 10 }]);

    mockPrisma.vocabListItem.findMany.mockResolvedValue([{ vocab_id: 1, list_id: 10 }]);

    const response = await request(app).post("/user/words").send({ listIds: [10, 25] });

    expect(response.status).toBe(404);
    expect(response.body.missingListIds).toEqual([25]);
  });

  test("POST /user/words returns every vocab entry when listIds are omitted", async () => {
    const app = createApp();

    const expectedWords = primeWordMocks();
    mockPrisma.vocab.findMany.mockResolvedValue([{ vocab_id: 1 }, { vocab_id: 2 }]);

    const response = await request(app).post("/user/words").send({});

    expect(response.status).toBe(200);
    expectWordsPayload(response.body, expectedWords);
  });

  test("GET /user/custom-words retrieves custom vocab entries", async () => {
    const app = createApp();

    mockPrisma.user.findUnique.mockResolvedValue({ favourite_list: 45 });
    mockPrisma.vocab.findMany.mockResolvedValue([
      {
        vocab_id: 701,
        custom_vocab_id: 9001,
        customVocab: {
          custom_vocab_id: 9001,
          source_lang: "EN",
          target_lang: "FR",
        },
      },
    ]);

    mockedHelpers.fetchVocabMetadataForIds.mockResolvedValue(
      new Map([[701, { referenceKind: "CUSTOM", referenceId: null, customVocabId: 9001 }]])
    );

    mockPrisma.hiddenVocab.findMany.mockResolvedValue([]);
    mockPrisma.vocabListItem.findMany
      .mockResolvedValueOnce([{ vocab_id: 701 }])
      .mockResolvedValueOnce([
        {
          vocab_id: 701,
          list_id: 15,
          listRef: { list_name: "Revision" },
        },
      ]);
    mockPrisma.vocabList.findMany.mockResolvedValue([
      {
        list_id: 15,
        list_name: "Revision",
        items: [{ vocab_id: 701 }],
      },
    ]);

    const response = await request(app).get("/user/custom-words");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      customWords: [
        {
          vocabId: 701,
          customVocabId: 9001,
          referenceKind: "CUSTOM",
          referenceId: null,
          sourceLang: "EN",
          targetLang: "FR",
          sourceText: null,
          targetText: null,
          isHidden: false,
          isFavourite: true,
          listIds: [15],
          lists: [{ id: 15, name: "Revision" }],
        },
      ],
    });
  });

  test("POST /user/custom-words creates a custom vocab entry", async () => {
    const app = createApp();

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      source_lang: "EN",
      target_lang: "FR",
    });

    mockPrisma.customVocab.create.mockResolvedValue({
      custom_vocab_id: 999,
      uid: "test-user",
      source_lang: "EN",
      target_lang: "FR",
      source_text: "hello",
      target_text: "bonjour",
    });
    mockPrisma.vocab.create.mockResolvedValue({ vocab_id: 888 });

    const response = await request(app)
      .post("/user/custom-words")
      .send({
        sourceText: "hello",
        targetText: "bonjour",
        sourceLang: "en",
        targetLang: "fr",
        uuid: "abc-123",
      });

    expect(response.status).toBe(201);
    expect(mockPrisma.customVocab.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        source_text: "hello",
        target_text: "bonjour",
        source_lang: "EN",
        target_lang: "FR",
      }),
      select: {
        custom_vocab_id: true,
        source_lang: true,
        target_lang: true,
        source_text: true,
        target_text: true,
      },
    });
    expect(mockPrisma.vocab.create).toHaveBeenCalledWith({
      data: {
        reference_kind: "CUSTOM",
        custom_vocab_id: 999,
      },
    });
    expect(response.body).toEqual({
      ok: true,
      customWord: {
        customVocabId: 999,
        vocabId: 888,
        sourceText: "hello",
        targetText: "bonjour",
        sourceLang: "EN",
        targetLang: "FR",
      },
    });
  });

  test("POST /user/default-vocab bulk creates default entries", async () => {
    const app = createApp();

    mockPrisma.vocab.createMany.mockResolvedValue({ count: 2 });

    const response = await request(app)
      .post("/user/default-vocab")
      .send({ count: 2, startRefId: 10 });

    expect(response.status).toBe(200);
    expect(mockPrisma.vocab.createMany).toHaveBeenCalledWith({
      data: [
        { reference_kind: "DEFAULT", reference_id: 10 },
        { reference_kind: "DEFAULT", reference_id: 11 },
      ],
      skipDuplicates: true,
    });
    expect(response.body).toEqual({ ok: true, requested: 2, created: 2 });
  });
});
