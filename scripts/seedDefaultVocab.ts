import { PrismaClient, VocabReferenceKind } from "@prisma/client";
import topics from "./data/main-vocab.json";

const prisma = new PrismaClient();

type VocabItem = {
  word: {
    fr: string;
    en: string;
    de: string;
  };
  level: string;
  vid: number;
};

type Topic = {
  id: number;
  topic: {
    fr: string;
    de: string;
  };
  essentialVocabulary: VocabItem[];
};

async function main() {
  // The JSON is a list of topics
  const allTopics = topics as Topic[];

  // Flatten to get all vocab items
  const allVocab = allTopics.flatMap((t) => t.essentialVocabulary);

  console.log(`Seeding ${allVocab.length} default vocab words from ${allTopics.length} topics…`);

  await prisma.vocab.createMany({
    data: allVocab.map((word) => ({
      reference_kind: VocabReferenceKind.DEFAULT,
      reference_id: word.vid,
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
