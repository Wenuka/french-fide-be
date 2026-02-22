import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const SCENARIOS_DIR = path.join(__dirname, '../data/scenarios');

async function seedLevel(level: 'A1' | 'A2' | 'B1') {
    const levelDir = path.join(SCENARIOS_DIR, level.toLowerCase());
    if (!fs.existsSync(levelDir)) return;

    console.log(`\n--- Seeding ${level} ---`);

    // Process Speaking
    const speakingDir = path.join(levelDir, 'speaking');
    if (fs.existsSync(speakingDir)) {
        const files = fs.readdirSync(speakingDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const content = fs.readFileSync(path.join(speakingDir, file), 'utf-8');
            const json = JSON.parse(content);
            const id = file.replace('.json', '');
            const title = json.title || id;
            const language = file.startsWith('de_') ? 'DE' : 'FR';
            const data = { json_id: id, title, language };

            const modelConfig: any = {
                'A1': prisma.a1SectionSpeaking,
                'A2': prisma.a2SectionSpeaking,
                'B1': prisma.b1SectionSpeaking
            };
            const model = modelConfig[level];

            const existing = await model.findUnique({ where: { json_id: id } });
            if (existing) {
                console.log(`[SKIP] ${level} Speaking: ${id} already exists`);
            } else {
                console.log(`[ADD] ${level} Speaking: ${id}`);
                await model.create({ data });
            }
        }
    }

    // Process Listening
    const listeningDir = path.join(levelDir, 'listening');
    if (fs.existsSync(listeningDir)) {
        const files = fs.readdirSync(listeningDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const content = fs.readFileSync(path.join(listeningDir, file), 'utf-8');
            const json = JSON.parse(content);
            const id = file.replace('.json', '');
            const title = json.title || id;
            const language = file.startsWith('de_') ? 'DE' : 'FR';
            const data = { json_id: id, title, language };

            const modelConfig: any = {
                'A1': prisma.a1SectionListening,
                'A2': prisma.a2SectionListening,
                'B1': prisma.b1SectionListening
            };
            const model = modelConfig[level];

            const existing = await model.findUnique({ where: { json_id: id } });
            if (existing) {
                console.log(`[SKIP] ${level} Listening: ${id} already exists`);
            } else {
                console.log(`[ADD] ${level} Listening: ${id}`);
                await model.create({ data });
            }
        }
    }
}

async function seedScenarios() {
    console.log('Starting Scenario Seeding process...');
    await seedLevel('A1');
    await seedLevel('A2');
    await seedLevel('B1');
    console.log('\n✅ Seeding completed successfully!');
}

seedScenarios()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
