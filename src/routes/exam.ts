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

// Helper to get least-used sections for a user
async function getLeastUsedSections(
    userId: number,
    level: 'A1' | 'A2' | 'B1',
    type: 'Speaking' | 'Listening',
    count: number = 1
): Promise<number[]> {
    // Get all sections for this level and type
    let allSections: { id: number }[] = [];
    if (level === 'A1') {
        allSections = type === 'Speaking'
            ? await prisma.a1SectionSpeaking.findMany({ select: { id: true } })
            : await prisma.a1SectionListening.findMany({ select: { id: true } });
    } else if (level === 'A2') {
        allSections = type === 'Speaking'
            ? await prisma.a2SectionSpeaking.findMany({ select: { id: true } })
            : await prisma.a2SectionListening.findMany({ select: { id: true } });
    } else if (level === 'B1') {
        allSections = type === 'Speaking'
            ? await prisma.b1SectionSpeaking.findMany({ select: { id: true } })
            : await prisma.b1SectionListening.findMany({ select: { id: true } });
    }

    if (allSections.length === 0) {
        throw new Error(`No ${level} ${type} sections available`);
    }

    // Get user's exam history to count section usage
    const userExams = await prisma.mockExam.findMany({
        where: { user_id: userId },
        select: {
            speaking_a1_id: true,
            speaking_a2_id: true,
            speaking_b1_id: true,
            speaking_b1_option1_id: true,
            speaking_b1_option2_id: true,
            listening_a1_id: true,
            listening_a2_id: true,
            listening_b1_id: true
        }
    });

    // Count usage for each section
    const usageCount: Record<number, number> = {};
    allSections.forEach(s => usageCount[s.id] = 0);

    userExams.forEach(exam => {
        if (type === 'Speaking') {
            if (level === 'A1' && exam.speaking_a1_id) {
                usageCount[exam.speaking_a1_id] = (usageCount[exam.speaking_a1_id] || 0) + 1;
            } else if (level === 'A2' && exam.speaking_a2_id) {
                usageCount[exam.speaking_a2_id] = (usageCount[exam.speaking_a2_id] || 0) + 1;
            } else if (level === 'B1') {
                if (exam.speaking_b1_id) {
                    usageCount[exam.speaking_b1_id] = (usageCount[exam.speaking_b1_id] || 0) + 1;
                }
                if (exam.speaking_b1_option1_id) {
                    usageCount[exam.speaking_b1_option1_id] = (usageCount[exam.speaking_b1_option1_id] || 0) + 0.5;
                }
                if (exam.speaking_b1_option2_id) {
                    usageCount[exam.speaking_b1_option2_id] = (usageCount[exam.speaking_b1_option2_id] || 0) + 0.5;
                }
            }
        } else {
            // Listening
            if (level === 'A1' && exam.listening_a1_id) {
                usageCount[exam.listening_a1_id] = (usageCount[exam.listening_a1_id] || 0) + 1;
            } else if (level === 'A2' && exam.listening_a2_id) {
                usageCount[exam.listening_a2_id] = (usageCount[exam.listening_a2_id] || 0) + 1;
            } else if (level === 'B1' && exam.listening_b1_id) {
                usageCount[exam.listening_b1_id] = (usageCount[exam.listening_b1_id] || 0) + 1;
            }
        }
    });

    // Sort sections by usage count (ascending)
    const sortedSections = allSections
        .map(s => ({ id: s.id, count: usageCount[s.id] }))
        .sort((a, b) => a.count - b.count);

    // Get the minimum usage count
    const minUsage = sortedSections[0].count;

    // Get all sections with minimum usage
    const leastUsedSections = sortedSections
        .filter(s => s.count === minUsage)
        .map(s => s.id);

    // Shuffle the least-used sections
    const shuffled = leastUsedSections.sort(() => 0.5 - Math.random());

    const result: number[] = [];
    for (let i = 0; i < count; i++) {
        result.push(shuffled[i % shuffled.length]);
    }

    console.log(`[SMART_SELECTION] Selected ${count} ${level} ${type} sections: ${result.join(', ')}`);
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

        // --- A2 Speaking ---
        if (exam.speaking_a2) {
            const oralContent = loadSectionContent("A2", "Speaking", exam.speaking_a2.json_id);
            sections.push({
                level: "A2",
                type: "Speaking",
                items: oralContent ? oralContent.items : []
            });
        }

        // --- A1 or B1 Speaking ---
        if (exam.selected_path === "B1") {
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
        }

        // Flatten all answers (speaking only)
        const allAnswers = [
            ...exam.answersSpeakingA1,
            ...exam.answersSpeakingA2,
            ...exam.answersSpeakingB1
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
                if (existingExam.speaking_a2) {
                    sections.push({
                        type: "Speaking",
                        section: loadSectionContent("A2", "Speaking", existingExam.speaking_a2.json_id) || {}
                    });
                }

                const allAnswers = [
                    ...existingExam.answersSpeakingA1,
                    ...existingExam.answersSpeakingA2,
                    ...existingExam.answersSpeakingB1
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
        // Get least-used A2 Speaking section
        const [leastUsedSpeakingA2Id] = await getLeastUsedSections(userId, 'A2', 'Speaking', 1);

        // Create MockExam with A2 Speaking section
        const exam = await prisma.mockExam.create({
            data: {
                user_id: userId,
                speaking_a2_id: leastUsedSpeakingA2Id,
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

// POST /api/exam/mock/:examId/answer
// Submit multiple answers for a section
router.post("/mock/:examId/answer", requireAuth, upload.any(), async (req: Request, res: Response) => {
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

        const files = req.files as Express.Multer.File[];
        const results = [];

        for (const ans of answers) {
            const { sectionType, mode, sectionId, questionId, answerText, fileField } = ans;
            // mode should be 'Speaking' or 'Listening'

            let finalAudioUrl = ans.audioUrl;
            if (fileField && files) {
                const uploadedFile = files.find(f => f.fieldname === fileField);
                if (uploadedFile) {
                    finalAudioUrl = `/audio/recordings/${uploadedFile.filename}`;
                }
            }

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
                question_id: questionId,
                answer_text: answerText || '',
                audio_url: finalAudioUrl || ''
            };

            let result;
            const modelName = `${sectionType}Section${mode}Answer`;
            // Dynamic access or explicit if/else
            if (sectionType === "A1") {
                if (mode === "Speaking") {
                    result = await prisma.a1SectionSpeakingAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: questionId } },
                        update: data,
                        create: data
                    });
                } else {
                    result = await prisma.a1SectionListeningAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: questionId } },
                        update: data,
                        create: data
                    });
                }
            } else if (sectionType === "A2") {
                if (mode === "Speaking") {
                    result = await prisma.a2SectionSpeakingAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: questionId } },
                        update: data,
                        create: data
                    });
                } else {
                    result = await prisma.a2SectionListeningAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: questionId } },
                        update: data,
                        create: data
                    });
                }
            } else if (sectionType === "B1") {
                if (mode === "Speaking") {
                    result = await prisma.b1SectionSpeakingAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: questionId } },
                        update: data,
                        create: data
                    });
                } else {
                    result = await prisma.b1SectionListeningAnswer.upsert({
                        where: { user_id_mock_exam_id_section_id_question_id: { user_id: userId, mock_exam_id: examId, section_id: data.section_id, question_id: questionId } },
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

        const { choice } = req.body;

        console.log(`[DECISION] User ${userId} made choice "${choice}" for exam ${examId}`);

        if (!choice) {
            return res.status(400).json({ error: "Missing choice." });
        }

        if (choice === "A1") {
            const [oralId] = await getLeastUsedSections(userId, 'A1', 'Speaking', 1);

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
            const [option1Id, option2Id] = await getLeastUsedSections(userId, 'B1', 'Speaking', 2);

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
                    title: "Expression Speaking B1",
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
