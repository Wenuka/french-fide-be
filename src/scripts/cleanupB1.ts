
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupB1() {
    console.log('Cleaning up B1 sections and scenarios...');

    // Delete section instances first due to FK constraints
    const sections = await prisma.mockExamSectionB1.deleteMany({});
    console.log(`Deleted ${sections.count} MockExamSectionB1 records.`);

    // Delete scenario templates
    const scenarios = await prisma.scenarioB1.deleteMany({});
    console.log(`Deleted ${scenarios.count} ScenarioB1 records.`);

    console.log('B1 cleanup completed.');
}

cleanupB1()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
