
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupExams() {
    console.log('Starting full mock exam table cleanup...');

    // 1. Delete Answers first (due to FK to MockExam)
    const ansA1 = await prisma.mockExamAnswerA1.deleteMany({});
    const ansA2 = await prisma.mockExamAnswerA2.deleteMany({});
    const ansB1 = await prisma.mockExamAnswerB1.deleteMany({});
    console.log(`Deleted answers: A1(${ansA1.count}), A2(${ansA2.count}), B1(${ansB1.count})`);

    // 2. Delete Mock Exam sessions
    const exams = await prisma.mockExam.deleteMany({});
    console.log(`Deleted ${exams.count} MockExam records.`);

    // 3. Delete Section instances (these are created per exam session)
    const secA1 = await prisma.mockExamSectionA1.deleteMany({});
    const secA2 = await prisma.mockExamSectionA2.deleteMany({});
    const secB1 = await prisma.mockExamSectionB1.deleteMany({});
    console.log(`Deleted section instances: A1(${secA1.count}), A2(${secA2.count}), B1(${secB1.count})`);

    console.log('Cleanup completed successfully.');
}

cleanupExams()
    .catch((e) => {
        console.error('Cleanup failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
