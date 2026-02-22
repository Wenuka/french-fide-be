import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupAllMockData() {
    const databaseUrl = process.env.DATABASE_URL || '';
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Safety Check: Ensure we are not in production
    if (nodeEnv === 'production') {
        console.error('❌ SAFETY ERROR: Cannot run cleanup in production environment!');
        process.exit(1);
    }

    // Additional check for the specific dev DB string if needed, 
    // but NODE_ENV is the standard. Let's add an explicit confirmation for the Neon DB provided.
    if (!databaseUrl.includes('neon.tech') && !databaseUrl.includes('localhost')) {
        console.error('❌ SAFETY ERROR: DATABASE_URL does not appear to be a dev database (Neon or localhost).');
        process.exit(1);
    }

    try {
        console.log('--- Starting Comprehensive Mock Data Cleanup ---');

        // 1. Delete Answer Records (Leaf nodes in FK tree)
        console.log('Deleting Mock Exam Answers...');
        const [delSpeakingA1, delListeningA1, delSpeakingA2, delListeningA2, delSpeakingB1, delListeningB1] = await Promise.all([
            prisma.a1SectionSpeakingAnswer.deleteMany({}),
            prisma.a1SectionListeningAnswer.deleteMany({}),
            prisma.a2SectionSpeakingAnswer.deleteMany({}),
            prisma.a2SectionListeningAnswer.deleteMany({}),
            prisma.b1SectionSpeakingAnswer.deleteMany({}),
            prisma.b1SectionListeningAnswer.deleteMany({}),
        ]);
        console.log(`- Deleted Answers: SpeakingA1(${delSpeakingA1.count}), ListeningA1(${delListeningA1.count}), SpeakingA2(${delSpeakingA2.count}), ListeningA2(${delListeningA2.count}), SpeakingB1(${delSpeakingB1.count}), ListeningB1(${delListeningB1.count})`);

        // 2. Delete Mock Exam Sessions
        console.log('Deleting Mock Exam Sessions...');
        const delExams = await prisma.mockExam.deleteMany({});
        console.log(`- Deleted Mock Exams: ${delExams.count}`);

        // 3. Delete Scenario Templates
        console.log('Deleting Section Templates...');
        const [delSpeakingA1Scen, delListeningA1Scen, delSpeakingA2Scen, delListeningA2Scen, delSpeakingB1Scen, delListeningB1Scen] = await Promise.all([
            prisma.a1SectionSpeaking.deleteMany({}),
            prisma.a1SectionListening.deleteMany({}),
            prisma.a2SectionSpeaking.deleteMany({}),
            prisma.a2SectionListening.deleteMany({}),
            prisma.b1SectionSpeaking.deleteMany({}),
            prisma.b1SectionListening.deleteMany({}),
        ]);
        console.log(`- Deleted Sections: SpeakingA1(${delSpeakingA1Scen.count}), ListeningA1(${delListeningA1Scen.count}), SpeakingA2(${delSpeakingA2Scen.count}), ListeningA2(${delListeningA2Scen.count}), SpeakingB1(${delSpeakingB1Scen.count}), ListeningB1(${delListeningB1Scen.count})`);

        console.log('--- ✅ All mock related tables cleared successfully! ---');
        console.log('NOTE: To restore scenario templates, run: npx ts-node src/scripts/seedScenarios.ts');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupAllMockData();
