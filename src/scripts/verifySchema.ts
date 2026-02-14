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
        const scenarios = await prisma.scenarioB1.findMany();
        if (scenarios.length < 2) {
            console.log('Not enough B1 scenarios to test.');
            return;
        }

        // 3. Create mock exam with options
        const section1 = await prisma.mockExamSectionB1.create({ data: { scenarioId: scenarios[0].id } });
        const section2 = await prisma.mockExamSectionB1.create({ data: { scenarioId: scenarios[1].id } });

        const exam = await prisma.mockExam.create({
            data: {
                user_id: user.id,
                section_b1_option1_id: section1.id,
                section_b1_option2_id: section2.id,
                status: "TEST_VERIFICATION"
            }
        });

        console.log('✅ Successfully created exam with B1 options!');
        console.log('Exam ID:', exam.id);
        console.log('Option 1 ID:', exam.section_b1_option1_id);
        console.log('Option 2 ID:', exam.section_b1_option2_id);

        // Cleanup
        await prisma.mockExam.delete({ where: { id: exam.id } });
        await prisma.mockExamSectionB1.delete({ where: { id: section1.id } });
        await prisma.mockExamSectionB1.delete({ where: { id: section2.id } });
        console.log('✅ Verification cleanup done.');

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSchema();
