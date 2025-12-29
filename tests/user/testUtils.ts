import express from "express";

const mockPrisma: any = {};

const resetPrismaMocks = () => {
  mockPrisma.$transaction = jest.fn(async (arg: any) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg(mockPrisma);
  });
  mockPrisma.user = {
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  };
  mockPrisma.vocabList = {
    upsert: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  };
  mockPrisma.vocabListItem = {
    upsert: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  };
  mockPrisma.hiddenVocab = {
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  mockPrisma.vocab = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  };
  mockPrisma.customVocab = {
    create: jest.fn(),
  };
};

resetPrismaMocks();

jest.mock("../../src/middleware/requireAuth", () => ({
  requireAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    (req as any).user = {
      uid: "test-user",
      user_id: "test-user",
      email: "test@example.com",
      email_verified: true,
    };
    next();
  },
}));

jest.mock("../../src/lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("../../src/routes/user/helpers", () => {
  const actual = jest.requireActual("../../src/routes/user/helpers");
  return {
    ...actual,
    resolveVocabIdentifiersToIds: jest.fn(),
    fetchVocabMetadataForIds: jest.fn(),
    buildVocabListItemResponse: jest.fn(),
    buildVocabMetadataPayload: jest.fn(),
    extractUidFromRequest: jest.fn(),
    resolveWordReferenceToVocabId: jest.fn(),
  };
});

import userRouter from "../../src/routes/user";
import * as helpers from "../../src/routes/user/helpers";

const mockedHelpers = helpers as jest.Mocked<typeof helpers>;

const resetAllMocks = () => {
  resetPrismaMocks();
  mockedHelpers.extractUidFromRequest.mockReset();
  mockedHelpers.extractUidFromRequest.mockReturnValue("test-user");
  mockedHelpers.resolveVocabIdentifiersToIds.mockReset();
  mockedHelpers.fetchVocabMetadataForIds.mockReset();
  mockedHelpers.buildVocabListItemResponse.mockReset();
  mockedHelpers.buildVocabMetadataPayload.mockReset();
  mockedHelpers.resolveWordReferenceToVocabId.mockReset();
};

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/user", userRouter);
  return app;
};

export {
  createApp,
  mockPrisma,
  mockedHelpers,
  resetAllMocks,
};
