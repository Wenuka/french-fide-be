import request from "supertest";
import {
  createApp,
  mockPrisma,
  mockedHelpers,
  resetAllMocks,
} from "./testUtils";

describe("User favourites routes", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test("POST /user/favourites adds vocab to favourites list", async () => {
    const app = createApp();

    mockedHelpers.resolveWordReferenceToVocabId.mockResolvedValue(501);
    mockPrisma.user.findUnique.mockResolvedValue({
      favourite_list: 21,
      favouriteList: { list_id: 21, list_name: "Favourites" },
    });
    mockPrisma.vocabListItem.upsert.mockResolvedValue({
      id: 77,
      list_id: 21,
      vocab_id: 501,
      list_name: "Favourites",
      importance: 0,
      timesGreen: 0,
      timesRed: 0,
      vocab_status: "unknown",
    });
    mockedHelpers.fetchVocabMetadataForIds.mockResolvedValue(
      new Map([[501, { referenceKind: "CUSTOM", referenceId: null, customVocabId: 900 }]])
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
      .post("/user/favourites")
      .send({
        wordRefId: 900,
        wordRefKind: "CUSTOM",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ok: true,
      favouriteListItem: expect.objectContaining({
        id: 77,
        listId: 21,
        vocabId: 501,
        referenceKind: "CUSTOM",
        referenceId: null,
        customVocabId: 900,
        listName: "Favourites",
        importance: 0,
        timesGreen: 0,
        timesRed: 0,
        vocabStatus: "unknown",
      }),
    });
    expect(mockPrisma.vocabListItem.upsert).toHaveBeenCalledWith({
      where: {
        list_id_vocab_id: {
          list_id: 21,
          vocab_id: 501,
        },
      },
      create: {
        list_id: 21,
        vocab_id: 501,
        list_name: "Favourites",
      },
      update: {
        list_name: "Favourites",
      },
    });
  });

  test("DELETE /user/favourites removes vocab from favourites list", async () => {
    const app = createApp();

    mockedHelpers.resolveWordReferenceToVocabId.mockResolvedValue(501);
    mockPrisma.user.findUnique.mockResolvedValue({
      favourite_list: 21,
    });
    mockPrisma.vocabListItem.deleteMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .delete("/user/favourites")
      .send({
        wordRefId: 900,
        wordRefKind: "CUSTOM",
      });

    expect(response.status).toBe(200);
    expect(mockPrisma.vocabListItem.deleteMany).toHaveBeenCalledWith({
      where: {
        list_id: 21,
        vocab_id: 501,
      },
    });
    expect(response.body).toEqual({ ok: true, removed: 1 });
  });
});
