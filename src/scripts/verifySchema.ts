import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchema() {
    try {
        console.log('Checking MockExam table structure...');

        // We can't easily check table structure directly with Prisma Client, 
        // but we can try to create a record with the new fields.

        // 1. Get a user
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log('No user found to test with.');
            return;
        }

        console.log(`Testing with user ID: ${user.id}`);

        // 2. Get scenarios
        const scenariosA2 = await prisma.scenarioA2.findMany();
        const scenariosB1 = await prisma.scenarioB1.findMany();

        if (scenariosA2.length < 1 || scenariosB1.length < 2) {
            console.log('Not enough scenarios to test.');
            return;
        }

        // 3. Create mock exam with direct scenario links
        const exam = await prisma.mockExam.create({
            data: {
                user_id: user.id,
                scenario_a2_id: scenariosA2[0].id,
                scenario_b1_option1_id: scenariosB1[0].id,
                scenario_b1_option2_id: scenariosB1[1].id,
                status: "TEST_VERIFICATION"
            }
        });

        console.log('✅ Successfully created exam with direct scenario links!');
        console.log('Exam ID:', exam.id);
        console.log('A2 Scenario ID:', exam.scenario_a2_id);
        console.log('B1 Option 1 ID:', exam.scenario_b1_option1_id);
        console.log('B1 Option 2 ID:', exam.scenario_b1_option2_id);

        // Cleanup
        await prisma.mockExam.delete({ where: { id: exam.id } });
        console.log('✅ Verification cleanup done.');

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSchema();
