
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
    try {
        const countA2 = await prisma.scenarioA2.count();
        const countA1 = await prisma.scenarioA1.count();
        const countB1 = await prisma.scenarioB1.count();

        console.log(`Scenario Counts: A2=${countA2}, A1=${countA1}, B1=${countB1}`);

        if (countA2 === 0) {
            console.error("ERROR: No A2 scenarios found! Seeding likely failed.");
        } else {
            console.log("Data verification passed.");
        }
    } catch (e) {
        console.error("Error connecting to DB or running query:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
