import dotenv from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

const FAVOURITES_LIST_NAME = "Favourites";

async function ensureFavouriteListForUser(uid: string, userId: number) {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const favouriteList = await tx.vocabList.upsert({
      where: {
        uid_list_name: {
          uid,
          list_name: FAVOURITES_LIST_NAME,
        },
      },
      update: {},
      create: {
        uid,
        list_name: FAVOURITES_LIST_NAME,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { favourite_list: favouriteList.list_id },
    });
  });
}

async function main() {
  const users = await prisma.user.findMany({
    where: { favourite_list: null },
    select: { id: true, uid: true },
  });

  if (users.length === 0) {
    console.log("All users already have a favourite list. Nothing to do.");
    return;
  }

  for (const user of users) {
    await ensureFavouriteListForUser(user.uid, user.id);
    console.log(`Created favourite list for user ${user.uid}`);
  }
}

main()
  .catch((err) => {
    console.error("Failed to backfill favourite lists:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
