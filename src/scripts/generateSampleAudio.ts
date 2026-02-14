import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SCENARIOS_DIR = path.join(__dirname, '../data/scenarios');
const OUTPUT_DIR = path.join(__dirname, '../../../french-fide/public/audio/samples');
const VOICE = 'Thomas'; // French voice

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function walkDir(dir: string, callback: (filePath: string) => void) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

console.log("Searching for sample answers...");

walkDir(SCENARIOS_DIR, (filePath) => {
    if (!filePath.endsWith('.json')) return;

    try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!content.items) return;

        content.items.forEach((item: any) => {
            // Check top level sampleAnswer
            if (item.sampleAnswer && item.id) {
                generateAudio(item.id, item.sampleAnswer);
            }

            // Check dialog steps
            if (item.type === 'dialog_steps' && item.steps) {
                item.steps.forEach((step: any) => {
                    if (step.sampleAnswer) {
                        const stepId = `${item.id}_step_${step.step}`;
                        generateAudio(stepId, step.sampleAnswer);
                    }
                });
            }
        });
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
});

function generateAudio(id: string, text: string) {
    const aiffFile = path.join(OUTPUT_DIR, `${id}_sample.aiff`);
    const mp3File = path.join(OUTPUT_DIR, `${id}_sample.mp3`);

    if (fs.existsSync(mp3File)) {
        console.log(`Skipping (already exists): ${id}`);
        return;
    }

    console.log(`Generating: ${id}_sample.mp3`);
    try {
        // Generate AIFF
        execSync(`say -v "${VOICE}" "${text}" -o "${aiffFile}"`);

        // Convert to MP3
        execSync(`ffmpeg -i "${aiffFile}" -y -codec:a libmp3lame -qscale:a 2 "${mp3File}" > /dev/null 2>&1`);

        // Remove AIFF
        fs.unlinkSync(aiffFile);
    } catch (err) {
        console.error(`Failed to generate audio for ${id}:`, err);
    }
}

console.log("Done!");
