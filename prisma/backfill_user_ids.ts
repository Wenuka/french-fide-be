
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting backfill of user_ids...');

    // 1. Get all users mapping
    const users = await prisma.user.findMany({
        select: { id: true, uid: true },
    });

    const userMap = new Map<string, number>();
    users.forEach(u => userMap.set(u.uid, u.id));

    console.log(`Found ${users.length} users.`);

    // 2. Update CustomVocab
    const customVocabs = await prisma.customVocab.findMany({
        where: { userId: null }
    });
    console.log(`Found ${customVocabs.length} CustomVocabs to update.`);

    for (const item of customVocabs) {
        const userId = userMap.get(item.uid);
        if (userId) {
            await prisma.customVocab.update({
                where: { custom_vocab_id: item.custom_vocab_id },
                data: { userId },
            });
        }
    }

    // 3. Update VocabList
    const vocabLists = await prisma.vocabList.findMany({
        where: { userId: null }
    });
    console.log(`Found ${vocabLists.length} VocabLists to update.`);

    for (const item of vocabLists) {
        const userId = userMap.get(item.uid);
        if (userId) {
            await prisma.vocabList.update({
                where: { list_id: item.list_id },
                data: { userId },
            });
        }
    }

    // 4. Update HiddenVocab
    const hiddenVocabs = await prisma.hiddenVocab.findMany({
        where: { userId: null }
    });
    console.log(`Found ${hiddenVocabs.length} HiddenVocabs to update.`);

    for (const item of hiddenVocabs) {
        const userId = userMap.get(item.uid);
        if (userId) {
            await prisma.hiddenVocab.update({
                where: { uid_vocab_id: { uid: item.uid, vocab_id: item.vocab_id } },
                data: { userId },
            });
        }
    }

    console.log('Backfill completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
