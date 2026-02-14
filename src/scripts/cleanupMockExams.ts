import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanup() {
    try {
        console.log("Cleaning up MockExam data...");

        // Delete answers first due to foreign keys
        await prisma.mockExamAnswerA1.deleteMany();
        await prisma.mockExamAnswerA2.deleteMany();
        await prisma.mockExamAnswerB1.deleteMany();

        // Delete MockExam sessions
        await prisma.mockExam.deleteMany();

        // Delete sections
        await prisma.mockExamSectionA1.deleteMany();
        await prisma.mockExamSectionA2.deleteMany();
        await prisma.mockExamSectionB1.deleteMany();

        console.log("Cleanup complete.");
    } catch (err) {
        console.error("Cleanup failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();
