import type { Request, Response } from "express";
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { extractUidFromRequest } from "./user/helpers";

import fs from "fs";
import path from "path";

const router = Router();

// Helper to load section content directly from files
function loadSectionContent(level: string, type: 'Speaking' | 'Listening', id: string) {
    try {
        const filePath = path.join(__dirname, "..", "data", "scenarios", level.toLowerCase(), type.toLowerCase(), `${id}.json`);
        console.log(`[loadSectionContent] Attempting to load ${level}/${type} from: ${filePath}`);
        if (fs.existsSync(filePath)) {
            console.log(`[loadSectionContent] File exists: ${filePath}`);
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            data.id = id;

            // Apply templates if Speaking
            if (type === 'Speaking' && data.items && Array.isArray(data.items)) {
                try {
                    const templatesPath = path.join(__dirname, "..", "data", "scenarios", "base_templates_oral.json");
                    console.log(`[loadSectionContent] Checking for base templates at: ${templatesPath}`);
                    if (fs.existsSync(templatesPath)) {
                        console.log(`[loadSectionContent] Templates file exists: ${templatesPath}`);
                        const templatesData = JSON.parse(fs.readFileSync(templatesPath, "utf-8"));
                        const lang = data.language || 'fr';
                        const langTemplates = templatesData[lang] || {};

                        data.items = data.items.map((item: any) => {
                            if (item.template && langTemplates[item.template]) {
                                return {
                                    ...langTemplates[item.template],
                                    ...item
                                };
                            }
                            return item;
                        });
                    } else {
                        console.warn(`[loadSectionContent] Templates file NOT found: ${templatesPath}`);
                    }
                } catch (e) {
                    console.error("Failed to load or apply base templates for oral:", e);
                }
            }

            return data;
        } else {
            console.warn(`[loadSectionContent] Section file NOT found: ${filePath}`);
        }
    } catch (err) {
        console.error(`Failed to load section file for ${level}/${type}/${id}:`, err);
    }
    return null;
}

// helper to get DB user id from request
async function getUserId(req: Request) {
    const uid = extractUidFromRequest(req);
    if (!uid) return null;
    const user = await prisma.user.findUnique({ where: { uid }, select: { id: true } });
    return user ? user.id : null;
}

// Helper: get all section IDs for a level/type/language, ordered by id ASC
async function getOrderedSections(
    level: 'A1' | 'A2' | 'B1',
    type: 'Speaking' | 'Listening',
    language: string = 'FR'
): Promise<number[]> {
    if (!language) language = 'FR';
    const langEnum = language.toUpperCase() as "FR" | "EN" | "DE";
    console.log(`[getOrderedSections] Fetching ${level} ${type} sections for lang ${langEnum} from DB`);

    let allSections: { id: number }[] = [];
    if (level === 'A1') {
        allSections = type === 'Speaking'
            ? await prisma.a1SectionSpeaking.findMany({ where: { language: langEnum }, select: { id: true }, orderBy: { id: 'asc' } })
            : await prisma.a1SectionListening.findMany({ where: { language: langEnum }, select: { id: true }, orderBy: { id: 'asc' } });
    } else if (level === 'A2') {
        allSections = type === 'Speaking'
            ? await prisma.a2SectionSpeaking.findMany({ where: { language: langEnum }, select: { id: true }, orderBy: { id: 'asc' } })
            : await prisma.a2SectionListening.findMany({ where: { language: langEnum }, select: { id: true }, orderBy: { id: 'asc' } });
    } else if (level === 'B1') {
        allSections = type === 'Speaking'
            ? await prisma.b1SectionSpeaking.findMany({ where: { language: langEnum }, select: { id: true }, orderBy: { id: 'asc' } })
            : await prisma.b1SectionListening.findMany({ where: { language: langEnum }, select: { id: true }, orderBy: { id: 'asc' } });
    }

    console.log(`[getOrderedSections] Found ${allSections.length} ${level} ${type} sections from DB`);

    if (allSections.length === 0) {
        console.error(`[getOrderedSections] No ${level} ${type} sections available for language ${langEnum}`);
        throw new Error(`No ${level} ${type} sections available for language ${langEnum}`);
    }

    return allSections.map(s => s.id);
}

// Helper: given an ordered list of DB ids, get the 0-based paper index for a DB id
function getPaperIndex(orderedIds: number[], dbId: number): number {
    const idx = orderedIds.indexOf(dbId);
    if (idx === -1) throw new Error(`Section id ${dbId} not found in ordered list`);
    return idx;
}

// Helper: get the next A2 paper for a user (deterministic, ordered)
// Returns { a2Id, existingExamId (if reusing), alreadySeen }
async function getA2PaperForUser(
    userId: number,
    language: string
): Promise<{ a2Id: number; existingExamId: number | null; alreadySeen: boolean }> {
    console.log(`[getA2PaperForUser] Getting A2 paper for user ${userId}, lang: ${language}`);
    const allA2 = await getOrderedSections('A2', 'Speaking', language);
    console.log(`[getA2PaperForUser] Total A2 papers available: ${allA2.length}`);

    // Get all A2 speaking ids this user has used in MockExam
    const userExams = await prisma.mockExam.findMany({
        where: { user_id: userId, speaking_a2_id: { not: null } },
        select: { id: true, speaking_a2_id: true }
    });
    const usedA2Ids = new Set(userExams.map(e => e.speaking_a2_id!));
    console.log(`[getA2PaperForUser] User has previously used A2 ids: ${Array.from(usedA2Ids).join(', ')}`);

    // Find first unseen A2 paper (in order)
    const unseenA2 = allA2.find(id => !usedA2Ids.has(id));

    if (unseenA2 !== undefined) {
        console.log(`[getA2PaperForUser] Found unseen A2 paper id: ${unseenA2}`);
        // Check if a MockExam already exists for this user+paper (from prior bug/race)
        const existingForPaper = await prisma.mockExam.findFirst({
            where: { user_id: userId, speaking_a2_id: unseenA2 },
            select: { id: true }
        });
        if (existingForPaper) {
            console.log(`[PAPER_SELECTION] User ${userId} already has MockExam ${existingForPaper.id} for A2 id ${unseenA2}, reusing`);
            return { a2Id: unseenA2, existingExamId: existingForPaper.id, alreadySeen: true };
        }
        console.log(`[PAPER_SELECTION] User ${userId} gets fresh A2 paper id ${unseenA2} (paper #${getPaperIndex(allA2, unseenA2) + 1})`);
        return { a2Id: unseenA2, existingExamId: null, alreadySeen: false };
    }

    // All papers seen — pick random, reuse existing MockExam
    const randomA2 = allA2[Math.floor(Math.random() * allA2.length)];
    const existingExam = userExams.find(e => e.speaking_a2_id === randomA2);
    console.log(`[PAPER_SELECTION] User ${userId} has seen all A2 papers. Re-using A2 id ${randomA2} (exam ${existingExam?.id})`);
    return { a2Id: randomA2, existingExamId: existingExam?.id ?? null, alreadySeen: true };
}

// Helper: get the A1 paper that pairs with an A2 paper (by index)
async function getA1PaperForA2(
    a2Id: number,
    language: string
): Promise<number> {
    const allA2 = await getOrderedSections('A2', 'Speaking', language);
    const allA1 = await getOrderedSections('A1', 'Speaking', language);
    const paperIdx = getPaperIndex(allA2, a2Id);
    // If there are fewer A1 papers than A2, wrap around
    const a1Id = allA1[paperIdx % allA1.length];
    console.log(`[PAPER_PAIRING] A2 id ${a2Id} (paper #${paperIdx + 1}) -> A1 id ${a1Id}`);
    return a1Id;
}

// Helper: get two B1 options for a user, prioritizing unseen
async function getB1OptionsForUser(
    userId: number,
    language: string
): Promise<[number, number]> {
    const allB1 = await getOrderedSections('B1', 'Speaking', language);

    // Get already used B1 ids (speaking_b1_id = the one the user SELECTED)
    const userExams = await prisma.mockExam.findMany({
        where: { user_id: userId, speaking_b1_id: { not: null } },
        select: { speaking_b1_id: true }
    });
    const usedB1Ids = new Set(userExams.map(e => e.speaking_b1_id!));

    // Split into unseen and seen
    const unseen = allB1.filter(id => !usedB1Ids.has(id));
    const seen = allB1.filter(id => usedB1Ids.has(id));

    // Shuffle unseen and seen separately to add randomness within priority groups
    const shuffleArray = (arr: number[]) => arr.sort(() => 0.5 - Math.random());
    const shuffledUnseen = shuffleArray([...unseen]);
    const shuffledSeen = shuffleArray([...seen]);
    const prioritizedPool = [...shuffledUnseen, ...shuffledSeen];

    // Pick two
    let option1: number, option2: number;
    if (prioritizedPool.length >= 2) {
        option1 = prioritizedPool[0];
        option2 = prioritizedPool[1];
    } else if (prioritizedPool.length === 1) {
        option1 = prioritizedPool[0];
        // Need a second — pick from allB1 excluding option1
        const remaining = allB1.filter(id => id !== option1);
        option2 = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)] : option1;
    } else {
        // Fallback (shouldn't happen if allB1 has entries)
        option1 = allB1[0];
        option2 = allB1.length > 1 ? allB1[1] : allB1[0];
    }

    console.log(`[B1_OPTIONS] User ${userId}: option1=${option1}, option2=${option2}. Unseen: [${unseen}], Seen: [${seen}]`);
    return [option1, option2];
}

// Legacy helper kept for listening (random selection, unchanged behavior)
async function getRandomSections(
    level: 'A1' | 'A2' | 'B1',
    type: 'Speaking' | 'Listening',
    count: number = 1,
    language: string = 'FR'
): Promise<number[]> {
    const ordered = await getOrderedSections(level, type, language);
    const shuffled = [...ordered].sort(() => 0.5 - Math.random());
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
        result.push(shuffled[i % shuffled.length]);
    }
    console.log(`[RANDOM_SELECTION] Selected ${count} ${level} ${type} sections: ${result.join(', ')}`);
    return result;
}

function normalizeQuestionId(questionId: unknown, sectionType?: unknown): string {
    const rawQuestionId = String(questionId ?? "");
    const normalizedSectionType = String(sectionType ?? "").toUpperCase();
    const sectionPrefix = `${normalizedSectionType}_`;

    if (normalizedSectionType && rawQuestionId.toUpperCase().startsWith(sectionPrefix)) {
        return rawQuestionId.slice(sectionPrefix.length);
    }

    return rawQuestionId;
}

// Helper: Filter answers to keep only the most recent per question, and flag if it's from an older attempt
function filterLatestAnswers(answers: any[], currentAttempt: number) {
    const latestByKey = new Map<string, any>();
    for (const ans of answers) {
        const normalizedQuestionId = normalizeQuestionId(ans.question_id, ans.sectionType);
        // Use question_id and sectionType as composite key
        const key = `${ans.sectionType}_${normalizedQuestionId}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(ans.createdAt) > new Date(existing.createdAt)) {
            latestByKey.set(key, {
                ...ans,
                question_id: normalizedQuestionId,
                isOldAttempt: ans.mock_attempt !== currentAttempt
            });
        }
    }
    return Array.from(latestByKey.values());
}


// GET /api/exam/history
router.get("/history", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) {
            console.warn("History request failed: User not found in DB");
            return res.status(401).json({ error: "User not found" });
        }

        console.log(`Fetching history for user ID: ${userId}`);

        const history = await prisma.mockExam.findMany({
            where: { user_id: userId },
            orderBy: { updatedAt: "desc" },
            include: {
                speaking_a2: true,
                speaking_a1: true,
                speaking_b1: true,
                answersSpeakingA1: true,
                answersSpeakingA2: true,
                answersSpeakingB1: true
            }
        });

        console.log(`Found ${history.length} history records for user ${userId}`);
        res.json(history);
    } catch (err: any) {
        console.error("Failed to fetch history:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/exam/:examId
router.get("/:examId", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const examId = parseInt(req.params.examId);
        if (isNaN(examId)) return res.status(400).json({ error: "Invalid exam ID" });

        const exam = await prisma.mockExam.findUnique({
            where: { id: examId },
            include: {
                speaking_a2: true,
                speaking_a1: true,
                speaking_b1: true,
                answersSpeakingA1: true,
                answersSpeakingA2: true,
                answersSpeakingB1: true,
            }
        });

        if (!exam || exam.user_id !== userId) {
            return res.status(404).json({ error: "Exam not found" });
        }

        // Assemble full section items (speaking only)
        const sections: any[] = [];

        // --- A1 or B1 Speaking ---
        if (exam.selected_path === "B1") {
            if (exam.speaking_a2) {
                const oralContent = loadSectionContent("A2", "Speaking", exam.speaking_a2.json_id);
                sections.push({
                    level: "A2",
                    type: "Speaking",
                    items: oralContent ? oralContent.items : []
                });
            }
            if (exam.speaking_b1) {
                const oralContent = loadSectionContent("B1", "Speaking", exam.speaking_b1.json_id);
                sections.push({
                    level: "B1",
                    type: "Speaking",
                    items: oralContent ? oralContent.items : []
                });
            }
        } else if (exam.selected_path === "A1") {
            if (exam.speaking_a2) {
                const oralContent = loadSectionContent("A2", "Speaking", exam.speaking_a2.json_id);
                sections.push({
                    level: "A2",
                    type: "Speaking",
                    items: oralContent ? oralContent.items : []
                });
            }
            if (exam.speaking_a1) {
                const oralContent = loadSectionContent("A1", "Speaking", exam.speaking_a1.json_id);
                sections.push({
                    level: "A1",
                    type: "Speaking",
                    items: oralContent ? oralContent.items : []
                });
            }
        } else {
            // No path selected yet (e.g. only A2 done so far in normal start)
            if (exam.speaking_a2) {
                const oralContent = loadSectionContent("A2", "Speaking", exam.speaking_a2.json_id);
                sections.push({
                    level: "A2",
                    type: "Speaking",
                    items: oralContent ? oralContent.items : []
                });
            }
        }

        // Flatten all answers (speaking only), filtered to current paper assignment
        const allAnswersRaw = [
            ...exam.answersSpeakingA1
                .filter((a: any) => !exam.speaking_a1_id || a.section_id === exam.speaking_a1_id)
                .map((a: any) => ({ ...a, sectionType: "A1" })),
            ...exam.answersSpeakingA2
                .filter((a: any) => !exam.speaking_a2_id || a.section_id === exam.speaking_a2_id)
                .map((a: any) => ({ ...a, sectionType: "A2" })),
            ...exam.answersSpeakingB1
                .filter((a: any) => !exam.speaking_b1_id || a.section_id === exam.speaking_b1_id)
                .map((a: any) => ({ ...a, sectionType: "B1" }))
        ];

        const allAnswers = filterLatestAnswers(allAnswersRaw, exam.attempt);

        res.json({
            exam,
            sections,
            answers: allAnswers
        });

    } catch (err: any) {
        console.error("Failed to fetch exam details:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/exam/mock/start
// Starts a mock exam session using deterministic paper assignment.
// - Resumes IN_PROGRESS exams if resumeId is provided.
// - Otherwise, assigns the next unseen A2 paper (by id order).
// - If all A2 papers are seen, reuses an existing MockExam (reset for fresh attempt) and flags alreadySeen.
router.post("/mock/start", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) {
            console.warn("Start request failed: User not found in DB");
            return res.status(401).json({ error: "User not found" });
        }

        const { examId: requestedExamIdStr } = req.body;
        const requestedExamId = requestedExamIdStr ? parseInt(requestedExamIdStr) : undefined;
        const language = req.body.language || 'FR';

        console.log(`[START] User ${userId} requested start. examId: ${requestedExamId}, language: ${language}`);

        // --- RESUME: If a specific examId is requested, try to resume it ---
        if (requestedExamId) {
            const existingExam = await prisma.mockExam.findFirst({
                where: { id: requestedExamId, user_id: userId, status: "IN_PROGRESS" },
                include: {
                    speaking_a2: true,
                    speaking_a1: true,
                    speaking_b1: true,
                    answersSpeakingA1: true,
                    answersSpeakingA2: true,
                    answersSpeakingB1: true
                }
            });

            if (existingExam) {
                console.log(`Resuming exam ${existingExam.id} for user ${userId}`);
                const sections: any[] = [];

                if (existingExam.speaking_a2) {
                    console.log(`[START] Resuming A2: loading section content for ${existingExam.speaking_a2.json_id}`);
                    const a2Content = loadSectionContent("A2", "Speaking", existingExam.speaking_a2.json_id);
                    console.log(`[START] Resuming A2 content loaded. items: ${a2Content?.items?.length || 0}`);
                    sections.push({
                        level: "A2",
                        type: "Speaking",
                        section: a2Content || {}
                    });
                }
                if (existingExam.selected_path === "A1" && existingExam.speaking_a1) {
                    console.log(`[START] Resuming A1: loading section content for ${existingExam.speaking_a1.json_id}`);
                    const a1Content = loadSectionContent("A1", "Speaking", existingExam.speaking_a1.json_id);
                    sections.push({
                        level: "A1",
                        type: "Speaking",
                        section: a1Content || {}
                    });
                }
                if (existingExam.selected_path === "B1" && existingExam.speaking_b1) {
                    console.log(`[START] Resuming B1: loading section content for ${existingExam.speaking_b1.json_id}`);
                    const b1Content = loadSectionContent("B1", "Speaking", existingExam.speaking_b1.json_id);
                    sections.push({
                        level: "B1",
                        type: "Speaking",
                        section: b1Content || {}
                    });
                }

                const allAnswersRaw = [
                    ...existingExam.answersSpeakingA1
                        .filter((a: any) => !existingExam.speaking_a1_id || a.section_id === existingExam.speaking_a1_id)
                        .map((a: any) => ({ ...a, sectionType: "A1" })),
                    ...existingExam.answersSpeakingA2
                        .filter((a: any) => !existingExam.speaking_a2_id || a.section_id === existingExam.speaking_a2_id)
                        .map((a: any) => ({ ...a, sectionType: "A2" })),
                    ...existingExam.answersSpeakingB1
                        .filter((a: any) => !existingExam.speaking_b1_id || a.section_id === existingExam.speaking_b1_id)
                        .map((a: any) => ({ ...a, sectionType: "B1" }))
                ];

                const allAnswers = filterLatestAnswers(allAnswersRaw, existingExam.attempt);

                return res.json({
                    examId: existingExam.id,
                    attempt: existingExam.attempt,
                    resumed: true,
                    sections,
                    answers: allAnswers
                });
            }
        }

        // --- DETERMINISTIC PAPER ASSIGNMENT ---
        console.log(`[START] Initiating deterministic A2 paper assignment`);
        const { a2Id, existingExamId, alreadySeen } = await getA2PaperForUser(userId, language);
        console.log(`[START] getA2PaperForUser results -> a2Id: ${a2Id}, existingExamId: ${existingExamId}, alreadySeen: ${alreadySeen}`);

        let exam: any;

        if (existingExamId) {
            // Reuse existing MockExam: reset it for a fresh attempt, BUT preserve B1 options
            console.log(`[START] Resetting existing exam ${existingExamId} for user ${userId} (A2 id: ${a2Id})`);
            exam = await prisma.mockExam.update({
                where: { id: existingExamId },
                data: {
                    status: "IN_PROGRESS",
                    selected_path: null,
                    attempt: { increment: 1 }
                },
                include: { speaking_a2: true }
            });
            console.log(`[START] Successfully reset existing exam. ID: ${exam.id}, attempt: ${exam.attempt}`);
        } else {
            // Create new MockExam with the assigned A2 paper
            console.log(`[START] Creating new MockExam with A2 id ${a2Id} for user ${userId}`);
            exam = await prisma.mockExam.create({
                data: {
                    user_id: userId,
                    speaking_a2_id: a2Id,
                    status: "IN_PROGRESS"
                },
                include: { speaking_a2: true }
            });
            console.log(`[START] Successfully created new exam. ID: ${exam.id}`);
        }

        console.log(`[START] Loading A2 section content for json_id: ${exam.speaking_a2?.json_id} (Speaking)`);
        const a2SectionContent = loadSectionContent("A2", "Speaking", exam.speaking_a2!.json_id) || {};
        console.log(`[START] A2 section content loaded. Has items: ${!!a2SectionContent.items}, items length: ${a2SectionContent.items?.length}`);

        res.json({
            examId: exam.id,
            attempt: exam.attempt,
            section: "A2",
            alreadySeen,
            sections: [
                {
                    level: "A2",
                    type: "Speaking",
                    section: a2SectionContent
                }
            ]
        });

    } catch (err: any) {
        console.error("Failed to start mock exam:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/exam/mock/start/listening
// Starts a listening exam. Accepts optional `path` ('A1'|'B1') and `speakingExamId`.
// When path is known upfront (either passed directly or inferred from a prior speaking exam),
// both A2 and A1/B1 sections are loaded at once. Otherwise only A2 is returned.
router.post("/mock/start/listening", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const { forceNew, path: rawPath, speakingExamId: speakingExamIdStr, language = 'FR' } = req.body;
        const speakingExamId = speakingExamIdStr ? parseInt(speakingExamIdStr) : undefined;

        // Resolve path: from body param OR from a prior speaking exam's selected_path
        let resolvedPath: 'A1' | 'B1' | null = rawPath
            ? (rawPath.toUpperCase() as 'A1' | 'B1')
            : null;

        if (!resolvedPath && speakingExamId) {
            const speakingExam = await prisma.mockExam.findFirst({
                where: { id: speakingExamId, user_id: userId },
                select: { selected_path: true }
            });
            if (speakingExam?.selected_path) {
                resolvedPath = speakingExam.selected_path as 'A1' | 'B1';
            }
        }

        console.log(`[LISTEN_START] User ${userId} listening start. path: ${resolvedPath}, speakingExamId: ${speakingExamId}, forceNew: ${forceNew}, language: ${language}`);

        // Pick random sections
        const [a2Id] = await getRandomSections('A2', 'Listening', 1, language);

        let a1Id: number | undefined;
        let b1Id: number | undefined;
        if (resolvedPath === 'A1') {
            [a1Id] = await getRandomSections('A1', 'Listening', 1, language);
        } else if (resolvedPath === 'B1') {
            [b1Id] = await getRandomSections('B1', 'Listening', 1, language);
        }

        // Create new listening exam (linked sections)
        const examData: any = { user_id: userId, listening_a2_id: a2Id, status: 'IN_PROGRESS' };
        if (a1Id) { examData.listening_a1_id = a1Id; examData.selected_path = 'A1'; }
        if (b1Id) { examData.listening_b1_id = b1Id; examData.selected_path = 'B1'; }

        const exam = await prisma.mockExam.create({
            data: examData,
            include: { listening_a2: true, listening_a1: true, listening_b1: true }
        });

        // Build ordered sections array
        const sections: any[] = [];
        const a2Content = loadSectionContent('A2', 'Listening', exam.listening_a2!.json_id);

        if (resolvedPath === 'A1') {
            sections.push({ level: 'A2', type: 'Listening', section: a2Content || {} });
            if (a1Id && exam.listening_a1) {
                const a1Content = loadSectionContent('A1', 'Listening', exam.listening_a1.json_id);
                sections.push({ level: 'A1', type: 'Listening', section: a1Content || {} });
            }
        } else {
            sections.push({ level: 'A2', type: 'Listening', section: a2Content || {} });
            if (resolvedPath === 'B1' && b1Id && exam.listening_b1) {
                const b1Content = loadSectionContent('B1', 'Listening', exam.listening_b1.json_id);
                sections.push({ level: 'B1', type: 'Listening', section: b1Content || {} });
            }
        }

        res.json({ examId: exam.id, sections, selectedPath: resolvedPath });

    } catch (err: any) {
        console.error("Failed to start listening exam:", err);
        res.status(500).json({ error: err.message });
    }
});



// POST /api/exam/mock/:examId/listening/decision
// After A2 listening, load the A1 or B1 listening section based on selected_path
router.post("/mock/:examId/listening/decision", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const examId = parseInt(req.params.examId);
        if (isNaN(examId)) return res.status(400).json({ error: "Invalid exam ID" });

        const exam = await prisma.mockExam.findUnique({ where: { id: examId } });
        if (!exam || exam.user_id !== userId) return res.status(404).json({ error: "Exam not found" });

        const { choice, language = 'FR' } = req.body; // 'A1' or 'B1'
        if (!choice || !['A1', 'B1'].includes(choice)) {
            return res.status(400).json({ error: "Choice must be 'A1' or 'B1'" });
        }

        console.log(`[LISTEN_DECISION] User ${userId} chose ${choice} listening for exam ${examId}, language: ${language}`);

        const [sectionId] = await getRandomSections(choice as 'A1' | 'B1', 'Listening', 1, language);

        const updateData: any = { selected_path: choice };
        if (choice === 'A1') updateData.listening_a1_id = sectionId;
        else updateData.listening_b1_id = sectionId;

        await prisma.mockExam.update({ where: { id: examId }, data: updateData });

        let sectionRecord: any;
        if (choice === 'A1') {
            sectionRecord = await prisma.a1SectionListening.findUnique({ where: { id: sectionId } });
        } else {
            sectionRecord = await prisma.b1SectionListening.findUnique({ where: { id: sectionId } });
        }

        const content = loadSectionContent(choice, "Listening", sectionRecord!.json_id);

        return res.json({
            examId,
            sections: [{ level: choice, type: "Listening", section: content || {} }]
        });

    } catch (err: any) {
        console.error("Failed to process listening decision", err);
        res.status(500).json({ error: err.message });
    }
});



// POST /api/exam/mock/:examId/answer
// Submit multiple answers for a section
router.post("/mock/:examId/answer", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const examId = parseInt(req.params.examId);
        if (isNaN(examId)) return res.status(400).json({ error: "Invalid exam ID" });

        let answers = req.body.answers;
        if (typeof answers === 'string') {
            answers = JSON.parse(answers);
        }

        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: "Answers must be an array" });
        }

        const exam = await prisma.mockExam.findUnique({ where: { id: examId } });
        if (!exam || exam.user_id !== userId) return res.status(404).json({ error: "Exam not found" });

        const results = [];

        for (const ans of answers) {
            const { sectionType, mode, sectionId, questionId, answerText, audioUrl } = ans;
            // mode should be 'Speaking' or 'Listening'
            const normalizedQuestionId = normalizeQuestionId(questionId, sectionType);

            // Audio is now stored locally on the client. We only store the remote URL if it was previously provided via backend sync or another method
            let finalAudioUrl = audioUrl || '';

            let dbSectionId: number | null = null;
            if (sectionType === "A1" && mode === "Speaking") dbSectionId = exam.speaking_a1_id;
            else if (sectionType === "A1" && mode === "Listening") dbSectionId = exam.listening_a1_id;
            else if (sectionType === "A2" && mode === "Speaking") dbSectionId = exam.speaking_a2_id;
            else if (sectionType === "A2" && mode === "Listening") dbSectionId = exam.listening_a2_id;
            else if (sectionType === "B1" && mode === "Speaking") dbSectionId = exam.speaking_b1_id;
            else if (sectionType === "B1" && mode === "Listening") dbSectionId = exam.listening_b1_id;

            if (!dbSectionId) {
                console.warn(`Could not find dbSectionId for ${sectionType} ${mode} on exam ${examId}`);
                continue;
            }

            const data = {
                mock_exam_id: examId,
                mock_attempt: exam.attempt,
                user_id: userId,
                section_id: dbSectionId,
                question_id: normalizedQuestionId,
                answer_text: answerText || '',
                audio_url: finalAudioUrl || ''
            };

            let result;
            if (sectionType === "A1") {
                if (mode === "Speaking") {
                    result = await prisma.a1SectionSpeakingAnswer.create({ data });
                } else {
                    result = await prisma.a1SectionListeningAnswer.create({ data });
                }
            } else if (sectionType === "A2") {
                if (mode === "Speaking") {
                    result = await prisma.a2SectionSpeakingAnswer.create({ data });
                } else {
                    result = await prisma.a2SectionListeningAnswer.create({ data });
                }
            } else if (sectionType === "B1") {
                if (mode === "Speaking") {
                    result = await prisma.b1SectionSpeakingAnswer.create({ data });
                } else {
                    result = await prisma.b1SectionListeningAnswer.create({ data });
                }
            }
            results.push(result);
        }

        res.json({ ok: true, count: results.length });
    } catch (err: any) {
        console.error("Failed to submit answers", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/exam/mock/:examId/answer/:sectionType/:questionId
// Delete the most recent answer for a given question inside a section
router.delete("/mock/:examId/answer/:sectionType/:questionId", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const examId = parseInt(req.params.examId);
        if (isNaN(examId)) return res.status(400).json({ error: "Invalid exam ID" });

        const { sectionType, questionId } = req.params; // sectionType: 'A1', 'A2', 'B1'
        const mode = req.query.mode as string || 'Speaking'; // default to Speaking

        const exam = await prisma.mockExam.findUnique({ where: { id: examId } });
        if (!exam || exam.user_id !== userId) return res.status(404).json({ error: "Exam not found" });

        let dbSectionId: number | null = null;
        if (sectionType === "A1" && mode === "Speaking") dbSectionId = exam.speaking_a1_id;
        else if (sectionType === "A1" && mode === "Listening") dbSectionId = exam.listening_a1_id;
        else if (sectionType === "A2" && mode === "Speaking") dbSectionId = exam.speaking_a2_id;
        else if (sectionType === "A2" && mode === "Listening") dbSectionId = exam.listening_a2_id;
        else if (sectionType === "B1" && mode === "Speaking") dbSectionId = exam.speaking_b1_id;
        else if (sectionType === "B1" && mode === "Listening") dbSectionId = exam.listening_b1_id;

        if (!dbSectionId) {
            return res.status(404).json({ error: "Section not found for this exam" });
        }

        // Find the most recent answer for this question
        let answerModel: any;
        if (sectionType === "A1") answerModel = mode === "Speaking" ? prisma.a1SectionSpeakingAnswer : prisma.a1SectionListeningAnswer;
        else if (sectionType === "A2") answerModel = mode === "Speaking" ? prisma.a2SectionSpeakingAnswer : prisma.a2SectionListeningAnswer;
        else if (sectionType === "B1") answerModel = mode === "Speaking" ? prisma.b1SectionSpeakingAnswer : prisma.b1SectionListeningAnswer;

        if (!answerModel) {
            return res.status(400).json({ error: "Invalid sectionType or mode" });
        }

        const normalizedQuestionId = normalizeQuestionId(questionId, sectionType);
        const candidateQuestionIds = Array.from(new Set([
            String(questionId),
            normalizedQuestionId,
            `${sectionType}_${normalizedQuestionId}`
        ]));

        const latestAnswer = await answerModel.findFirst({
            where: {
                user_id: userId,
                mock_exam_id: examId,
                section_id: dbSectionId,
                question_id: { in: candidateQuestionIds }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!latestAnswer) {
            return res.status(404).json({ error: "Answer not found" });
        }

        await answerModel.delete({
            where: { id: latestAnswer.id }
        });

        res.json({ ok: true, deletedId: latestAnswer.id });

    } catch (err: any) {
        console.error("Failed to delete answer", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/exam/mock/:examId/decision
// Handle the user choice between A1 and B1 after A2 section
// A1: deterministically paired with A2 paper by index
// B1: reuse existing option1/option2 if exam was restarted, otherwise pick new options prioritizing unseen
router.post("/mock/:examId/decision", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const examId = parseInt(req.params.examId);
        if (isNaN(examId)) return res.status(400).json({ error: "Invalid exam ID" });

        const { choice, language = 'FR' } = req.body;

        console.log(`[DECISION] User ${userId} made choice "${choice}" for exam ${examId}, language: ${language}`);

        if (!choice) {
            return res.status(400).json({ error: "Missing choice." });
        }

        // Fetch exam to know A2 paper id and existing B1 options
        const currentExam = await prisma.mockExam.findUnique({
            where: { id: examId },
            select: {
                user_id: true,
                speaking_a2_id: true,
                speaking_b1_option1_id: true,
                speaking_b1_option2_id: true
            }
        });
        if (!currentExam || currentExam.user_id !== userId) return res.status(404).json({ error: "Exam not found" });

        if (choice === "A1") {
            // Deterministic A1 pairing by paper index
            const a2Id = currentExam.speaking_a2_id;
            if (!a2Id) return res.status(400).json({ error: "No A2 section on this exam" });

            const oralId = await getA1PaperForA2(a2Id, language);

            await prisma.mockExam.update({
                where: { id: examId },
                data: {
                    speaking_a1_id: oralId,
                    selected_path: "A1",
                    speaking_b1_id: null  // Clear B1 since user chose A1
                }
            });

            const sectionSpeaking = await prisma.a1SectionSpeaking.findUnique({ where: { id: oralId } });

            return res.json({
                examId,
                section: "A1",
                sections: [
                    { type: "Speaking", section: loadSectionContent("A1", "Speaking", sectionSpeaking!.json_id) || {} }
                ]
            });

        } else if (choice === "B1") {
            let option1Id: number;
            let option2Id: number;

            // If exam already has B1 options (from a previous attempt / restarted exam), reuse them
            if (currentExam.speaking_b1_option1_id && currentExam.speaking_b1_option2_id) {
                option1Id = currentExam.speaking_b1_option1_id;
                option2Id = currentExam.speaking_b1_option2_id;
                console.log(`[DECISION] Reusing existing B1 options for exam ${examId}: option1=${option1Id}, option2=${option2Id}`);
            } else {
                // New mock - pick B1 options prioritizing unseen
                [option1Id, option2Id] = await getB1OptionsForUser(userId, language);

                await prisma.mockExam.update({
                    where: { id: examId },
                    data: {
                        speaking_b1_option1_id: option1Id,
                        speaking_b1_option2_id: option2Id
                    }
                });
            }

            const opt1 = await prisma.b1SectionSpeaking.findUnique({ where: { id: option1Id } });
            const opt2 = await prisma.b1SectionSpeaking.findUnique({ where: { id: option2Id } });

            return res.json({
                examId,
                section: "B1",
                topicSelection: {
                    title: "Section B1",
                    options: [
                        { id: opt1!.id, title: opt1!.title },
                        { id: opt2!.id, title: opt2!.title }
                    ]
                }
            });

        } else if (typeof choice === 'number' || (typeof choice === 'string' && !isNaN(parseInt(choice)))) {
            // Choice is B1 Speaking Topic selection
            const selectedSpeakingId = typeof choice === 'number' ? choice : parseInt(choice);

            await prisma.mockExam.update({
                where: { id: examId },
                data: {
                    speaking_b1_id: selectedSpeakingId,
                    selected_path: "B1",
                    speaking_a1_id: null  // Clear A1 since user chose B1
                }
            });

            const exam = await prisma.mockExam.findUnique({
                where: { id: examId },
                include: { speaking_b1: true }
            });

            return res.json({
                examId,
                section: "B1",
                sections: [
                    { type: "Speaking", section: loadSectionContent("B1", "Speaking", exam!.speaking_b1!.json_id) || {} }
                ]
            });
        }

        res.status(400).json({ error: "Invalid choice" });
    } catch (err: any) {
        console.error("Failed to process decision", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/exam/mock/:examId/complete
// Finalizes the mock exam session
router.post("/mock/:examId/complete", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const examId = parseInt(req.params.examId);
        if (isNaN(examId)) return res.status(400).json({ error: "Invalid exam ID" });

        console.log(`[COMPLETE] User ${userId} completing exam ${examId}`);

        await prisma.mockExam.update({
            where: { id: examId, user_id: userId },
            data: { status: "COMPLETED" }
        });

        res.json({ ok: true });
    } catch (err: any) {
        console.error("[COMPLETE ERROR] Failed to complete exam:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
