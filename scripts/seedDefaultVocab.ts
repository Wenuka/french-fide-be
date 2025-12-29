import { PrismaClient, VocabReferenceKind } from "@prisma/client";
import words from "./data/default_vocab.json";

const prisma = new PrismaClient();

type DefaultWord = {
  reference_id: number;
};

async function main() {
  console.log(`Seeding ${words.length} default vocab words…`);

  await prisma.vocab.createMany({
    data: (words as DefaultWord[]).map((word) => ({
      reference_kind: VocabReferenceKind.DEFAULT,
      reference_id: word.reference_id,
    })),
    skipDuplicates: true,
  });

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Failed to seed default vocab:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
