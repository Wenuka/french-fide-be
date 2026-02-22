import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding listening sections...');

    await prisma.a1SectionListening.upsert({
        where: { json_id: 'fr_paper1_a1_comprendre' },
        update: {},
        create: { json_id: 'fr_paper1_a1_comprendre', title: 'Compréhension orale - A1', language: 'FR' }
    });
    console.log('✓ A1 Listening seeded');

    await prisma.a2SectionListening.upsert({
        where: { json_id: 'fr_paper1_a2_comprendre' },
        update: {},
        create: { json_id: 'fr_paper1_a2_comprendre', title: 'Compréhension orale - A2', language: 'FR' }
    });
    console.log('✓ A2 Listening seeded');

    await prisma.b1SectionListening.upsert({
        where: { json_id: 'fr_paper1_b1_comprendre' },
        update: {},
        create: { json_id: 'fr_paper1_b1_comprendre', title: 'Compréhension orale - B1', language: 'FR' }
    });
    console.log('✓ B1 Listening seeded');

    console.log('Done!');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
