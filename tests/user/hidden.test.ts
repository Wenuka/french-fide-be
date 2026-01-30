import request from "supertest";
import {
  createApp,
  mockPrisma,
  mockedHelpers,
  resetAllMocks,
} from "./testUtils";

describe("User hidden vocab routes", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test("POST /user/hidden hides vocab and returns no content", async () => {
    const app = createApp();

    mockedHelpers.resolveWordReferenceToVocabId.mockResolvedValue(610);
    mockPrisma.hiddenVocab.findMany.mockResolvedValue([]);
    mockPrisma.hiddenVocab.createMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .post("/user/hidden")
      .send({
        wordRefId: 200,
        wordRefKind: "DEFAULT",
      });

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(mockPrisma.hiddenVocab.createMany).toHaveBeenCalled();
  });

  test("GET /user/hidden returns identifier payloads", async () => {
    const app = createApp();

    const hiddenRows = [{ vocab_id: 610 }, { vocab_id: 501 }];
    mockPrisma.hiddenVocab.findMany.mockResolvedValue(hiddenRows);
    mockedHelpers.fetchVocabMetadataForIds.mockResolvedValue(
      new Map([
        [610, { referenceKind: "DEFAULT", referenceId: 200, customVocabId: null }],
        [501, { referenceKind: "CUSTOM", referenceId: null, customVocabId: 900 }],
      ])
    );
    const response = await request(app).get("/user/hidden");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      hidden: [
        {
          vocabId: 610,
          wordRefKind: "DEFAULT",
          wordRefId: 200,
        },
        {
          vocabId: 501,
          wordRefKind: "CUSTOM",
          wordRefId: 900,
        },
      ],
    });
  });

  test("DELETE /user/hidden removes vocab from hidden list", async () => {
    const app = createApp();

    mockedHelpers.resolveWordReferenceToVocabId.mockResolvedValueOnce(610);
    mockPrisma.hiddenVocab.deleteMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .delete("/user/hidden")
      .send({
        wordRefId: 200,
        wordRefKind: "DEFAULT",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, removed: 1 });
    expect(mockPrisma.hiddenVocab.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 1,
        vocab_id: { in: [610] },
      },
    });
  });
});
