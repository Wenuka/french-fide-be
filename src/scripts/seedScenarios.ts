
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const SCENARIOS_DIR = path.join(__dirname, '../data/scenarios');

async function seedScenarios() {
    console.log('Seeding scenarios...');

    // Seed A1
    const a1Dir = path.join(SCENARIOS_DIR, 'a1');
    if (fs.existsSync(a1Dir)) {
        const files = fs.readdirSync(a1Dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const content = fs.readFileSync(path.join(a1Dir, file), 'utf-8');
            const json = JSON.parse(content);
            const id = json.sectionId || json.id; // Use sectionId from JSON

            console.log(`Upserting ScenarioA1: ${id}`);
            await prisma.scenarioA1.upsert({
                where: { id },
                update: {
                    title: json.title,
                    contentJson: content
                },
                create: {
                    id,
                    title: json.title,
                    contentJson: content
                }
            });
        }
    }

    // Seed A2
    const a2Dir = path.join(SCENARIOS_DIR, 'a2');
    if (fs.existsSync(a2Dir)) {
        const files = fs.readdirSync(a2Dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const content = fs.readFileSync(path.join(a2Dir, file), 'utf-8');
            const json = JSON.parse(content);
            const id = json.sectionId || json.id;

            console.log(`Upserting ScenarioA2: ${id}`);
            await prisma.scenarioA2.upsert({
                where: { id },
                update: {
                    title: json.title,
                    contentJson: content
                },
                create: {
                    id,
                    title: json.title,
                    contentJson: content
                }
            });
        }
    }

    // Seed B1
    const b1Dir = path.join(SCENARIOS_DIR, 'b1');
    if (fs.existsSync(b1Dir)) {
        const files = fs.readdirSync(b1Dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const content = fs.readFileSync(path.join(b1Dir, file), 'utf-8');
            const json = JSON.parse(content);
            const id = json.sectionId || json.id;

            console.log(`Upserting ScenarioB1: ${id}`);
            await prisma.scenarioB1.upsert({
                where: { id },
                update: {
                    title: json.title,
                    contentJson: content
                },
                create: {
                    id,
                    title: json.title,
                    contentJson: content
                }
            });
        }
    }

    console.log('Seeding completed.');
}

seedScenarios()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
