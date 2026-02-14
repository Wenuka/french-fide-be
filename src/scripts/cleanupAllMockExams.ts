import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupAllMockExams() {
    try {
        console.log('Deleting all mock exam data...');

        // Delete in order due to foreign key constraints
        const deletedA1 = await prisma.mockExamAnswerA1.deleteMany({});
        console.log(`Deleted ${deletedA1.count} A1 answers`);

        const deletedA2 = await prisma.mockExamAnswerA2.deleteMany({});
        console.log(`Deleted ${deletedA2.count} A2 answers`);

        const deletedB1 = await prisma.mockExamAnswerB1.deleteMany({});
        console.log(`Deleted ${deletedB1.count} B1 answers`);

        const deletedExams = await prisma.mockExam.deleteMany({});
        console.log(`Deleted ${deletedExams.count} mock exams`);

        const deletedSectionsA1 = await prisma.mockExamSectionA1.deleteMany({});
        console.log(`Deleted ${deletedSectionsA1.count} A1 sections`);

        const deletedSectionsA2 = await prisma.mockExamSectionA2.deleteMany({});
        console.log(`Deleted ${deletedSectionsA2.count} A2 sections`);

        const deletedSectionsB1 = await prisma.mockExamSectionB1.deleteMany({});
        console.log(`Deleted ${deletedSectionsB1.count} B1 sections`);

        console.log('✅ All mock exam data cleared successfully!');
    } catch (error) {
        console.error('Error cleaning up mock exams:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

cleanupAllMockExams();
