import type { Request, Response } from "express";
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { extractUidFromRequest } from "./user/helpers";

import fs from "fs";
import path from "path";
import multer from "multer";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../../../french-fide/public/audio/recordings");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname) || '.webm'}`);
    }
});

const upload = multer({ storage });

const router = Router();

// Helper to load section content directly from files
function loadSectionContent(level: string, type: 'Speaking' | 'Listening', id: string) {
    try {
        const filePath = path.join(__dirname, "..", "data", "scenarios", level.toLowerCase(), type.toLowerCase(), `${id}.json`);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            data.id = id;

            // Apply templates if Speaking
            if (type === 'Speaking' && data.items && Array.isArray(data.items)) {
                try {
                    const templatesPath = path.join(__dirname, "..", "data", "scenarios", "base_templates_oral.json");
                    if (fs.existsSync(templatesPath)) {
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
                    }
                } catch (e) {
                    console.error("Failed to load or apply base templates for oral:", e);
                }
            }

            return data;
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

// Helper to get random sections
async function getRandomSections(
    level: 'A1' | 'A2' | 'B1',
    type: 'Speaking' | 'Listening',
    count: number = 1,
    language: string = 'FR'
): Promise<number[]> {
    if (!language) language = 'FR';
    const langEnum = language.toUpperCase() as "FR" | "EN" | "DE";

    // Get all sections for this level and type
    let allSections: { id: number }[] = [];
    if (level === 'A1') {
        allSections = type === 'Speaking'
            ? await prisma.a1SectionSpeaking.findMany({ where: { language: langEnum }, select: { id: true } })
            : await prisma.a1SectionListening.findMany({ where: { language: langEnum }, select: { id: true } });
    } else if (level === 'A2') {
        allSections = type === 'Speaking'
            ? await prisma.a2SectionSpeaking.findMany({ where: { language: langEnum }, select: { id: true } })
            : await prisma.a2SectionListening.findMany({ where: { language: langEnum }, select: { id: true } });
    } else if (level === 'B1') {
        allSections = type === 'Speaking'
            ? await prisma.b1SectionSpeaking.findMany({ where: { language: langEnum }, select: { id: true } })
            : await prisma.b1SectionListening.findMany({ where: { language: langEnum }, select: { id: true } });
    }

    if (allSections.length === 0) {
        throw new Error(`No ${level} ${type} sections available for language ${langEnum}`);
    }

    // Shuffle all sections
    const shuffled = allSections.map(s => s.id).sort(() => 0.5 - Math.random());

    const result: number[] = [];
    for (let i = 0; i < count; i++) {
        result.push(shuffled[i % shuffled.length]);
    }

    console.log(`[RANDOM_SELECTION] Selected ${count} ${level} ${type} sections: ${result.join(', ')}`);
    return result;
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
            orderBy: { createdAt: "desc" },
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
            if (exam.speaking_a1) {
                const oralContent = loadSectionContent("A1", "Speaking", exam.speaking_a1.json_id);
                sections.push({
                    level: "A1",
                    type: "Speaking",
                    items: oralContent ? oralContent.items : []
                });
            }
            if (exam.speaking_a2) {
                const oralContent = loadSectionContent("A2", "Speaking", exam.speaking_a2.json_id);
                sections.push({
                    level: "A2",
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

        // Flatten all answers (speaking only)
        const allAnswers = [
            ...exam.answersSpeakingA1.map((a: any) => ({ ...a, sectionType: "A1" })),
            ...exam.answersSpeakingA2.map((a: any) => ({ ...a, sectionType: "A2" })),
            ...exam.answersSpeakingB1.map((a: any) => ({ ...a, sectionType: "B1" }))
        ];

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
// Starts a new mock exam session, initializing with A2 section or resumes existing
router.post("/mock/start", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) {
            console.warn("Start request failed: User not found in DB");
            return res.status(401).json({ error: "User not found" });
        }

        const { examId: requestedExamIdStr, forceNew } = req.body;
        const requestedExamId = requestedExamIdStr ? parseInt(requestedExamIdStr) : undefined;

        console.log(`[START] User ${userId} requested start. examId: ${requestedExamId}, forceNew: ${forceNew}`);

        // Handle Resume Logic
        if (!forceNew) {
            const resumeWhere: any = {
                user_id: userId,
                status: "IN_PROGRESS"
            };

            if (requestedExamId) {
                resumeWhere.id = requestedExamId;
            }

            const existingExam = await prisma.mockExam.findFirst({
                where: resumeWhere,
                orderBy: { createdAt: 'desc' },
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

                if (existingExam.selected_path === "A1") {
                    if (existingExam.speaking_a1) {
                        sections.push({
                            level: "A1",
                            type: "Speaking",
                            section: loadSectionContent("A1", "Speaking", existingExam.speaking_a1.json_id) || {}
                        });
                    }
                    if (existingExam.speaking_a2) {
                        sections.push({
                            level: "A2",
                            type: "Speaking",
                            section: loadSectionContent("A2", "Speaking", existingExam.speaking_a2.json_id) || {}
                        });
                    }
                } else {
                    if (existingExam.speaking_a2) {
                        sections.push({
                            level: "A2",
                            type: "Speaking",
                            section: loadSectionContent("A2", "Speaking", existingExam.speaking_a2.json_id) || {}
                        });
                    }
                    if (existingExam.selected_path === "B1" && existingExam.speaking_b1) {
                        sections.push({
                            level: "B1",
                            type: "Speaking",
                            section: loadSectionContent("B1", "Speaking", existingExam.speaking_b1.json_id) || {}
                        });
                    }
                }

                const allAnswers = [
                    ...existingExam.answersSpeakingA1.map((a: any) => ({ ...a, sectionType: "A1" })),
                    ...existingExam.answersSpeakingA2.map((a: any) => ({ ...a, sectionType: "A2" })),
                    ...existingExam.answersSpeakingB1.map((a: any) => ({ ...a, sectionType: "B1" }))
                ];

                return res.json({
                    examId: existingExam.id,
                    resumed: true,
                    sections,
                    answers: allAnswers
                });
            }
        }

        // --- NEW EXAM FLOW ---
        const language = req.body.language || 'FR';

        // Get random A2 Speaking section
        const [randomSpeakingA2Id] = await getRandomSections('A2', 'Speaking', 1, language);

        // Create MockExam with A2 Speaking section
        const exam = await prisma.mockExam.create({
            data: {
                user_id: userId,
                speaking_a2_id: randomSpeakingA2Id,
                status: "IN_PROGRESS"
            },
            include: {
                speaking_a2: true
            }
        });

        res.json({
            examId: exam.id,
            section: "A2",
            sections: [
                {
                    level: "A2",
                    type: "Speaking",
                    section: loadSectionContent("A2", "Speaking", exam.speaking_a2!.json_id) || {}
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
            const speakingExam = await prisma.mockExam.findUnique({
                where: { id: speakingExamId },
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
            if (a1Id && exam.listening_a1) {
                const a1Content = loadSectionContent('A1', 'Listening', exam.listening_a1.json_id);
                sections.push({ level: 'A1', type: 'Listening', section: a1Content || {} });
            }
            sections.push({ level: 'A2', type: 'Listening', section: a2Content || {} });
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
        if (!exam) return res.status(404).json({ error: "Exam not found" });

        const results = [];

        for (const ans of answers) {
            const { sectionType, mode, sectionId, questionId, answerText, audioUrl } = ans;
            // mode should be 'Speaking' or 'Listening'

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
                user_id: userId,
                section_id: dbSectionId,
                question_id: String(questionId),
                answer_text: answerText || '',
                audio_url: finalAudioUrl || ''
            };

            let result;
            const modelName = `${sectionType}Section${mode}Answer`;
            // Dynamic access or explicit if/else
            if (sectionType === "A1") {
                if (mode === "Speaking") {
                    result = await prisma.a1SectionSpeakingAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: data.question_id } },
                        update: data,
                        create: data
                    });
                } else {
                    result = await prisma.a1SectionListeningAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: data.question_id } },
                        update: data,
                        create: data
                    });
                }
            } else if (sectionType === "A2") {
                if (mode === "Speaking") {
                    result = await prisma.a2SectionSpeakingAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: data.question_id } },
                        update: data,
                        create: data
                    });
                } else {
                    result = await prisma.a2SectionListeningAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: data.question_id } },
                        update: data,
                        create: data
                    });
                }
            } else if (sectionType === "B1") {
                if (mode === "Speaking") {
                    result = await prisma.b1SectionSpeakingAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: data.question_id } },
                        update: data,
                        create: data
                    });
                } else {
                    result = await prisma.b1SectionListeningAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: data.question_id } },
                        update: data,
                        create: data
                    });
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

// POST /api/exam/mock/:examId/decision
// Handle the user choice between A1 and B1 after A2 section
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

        if (choice === "A1") {
            const [oralId] = await getRandomSections('A1', 'Speaking', 1, language);

            await prisma.mockExam.update({
                where: { id: examId },
                data: {
                    speaking_a1_id: oralId,
                    selected_path: "A1"
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
            // Options are for Speaking B1 topic selection
            const [option1Id, option2Id] = await getRandomSections('B1', 'Speaking', 2, language);

            await prisma.mockExam.update({
                where: { id: examId },
                data: {
                    speaking_b1_option1_id: option1Id,
                    speaking_b1_option2_id: option2Id
                }
            });

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
                    selected_path: "B1"
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
