import request from "supertest";
import { createApp, mockPrisma, resetAllMocks } from "./testUtils";

describe("Auth routes", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test("POST /user/login creates user and favourite list", async () => {
    const app = createApp();

    const prismaUser = {
      id: 1,
      favourite_list: 42,
      source_lang: "EN",
      target_lang: "FR",
    };

    mockPrisma.user.upsert.mockResolvedValue({ ...prismaUser, favourite_list: null });
    mockPrisma.vocabList.upsert.mockResolvedValue({ list_id: 42 });
    mockPrisma.user.update.mockResolvedValue(prismaUser);
    mockPrisma.user.findUnique.mockResolvedValue(prismaUser);

    const response = await request(app).post("/user/login").send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      user: {
        source_lang: "EN",
        target_lang: "FR",
      },
    });
    expect(mockPrisma.user.upsert).toHaveBeenCalled();
    expect(mockPrisma.vocabList.upsert).toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  test("GET /user/profile returns user profile data", async () => {
    const app = createApp();

    const userData = {
      uid: "test-user",
      email: "test@example.com",
      emailVerified: true,
      source_lang: "EN",
      target_lang: "FR",
    };

    mockPrisma.user.findUnique.mockResolvedValue(userData);

    const response = await request(app).get("/user/profile");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      uid: "test-user",
      email: "test@example.com",
      emailVerified: true,
      source_lang: "EN",
      target_lang: "FR",
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { uid: "test-user" },
      select: {
        uid: true,
        email: true,
        emailVerified: true,
        source_lang: true,
        target_lang: true,
      },
    });
  });

  test("GET /user/profile returns 404 when user not found", async () => {
    const app = createApp();

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app).get("/user/profile");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "User not found" });
  });
});
