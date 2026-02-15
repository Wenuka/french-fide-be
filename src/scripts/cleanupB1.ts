
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupB1() {
    console.log('Cleaning up B1 scenarios...');

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
