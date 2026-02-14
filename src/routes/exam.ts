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

// Helper to load scenario content directly from files
function loadScenarioContent(level: string, id: string) {
    try {
        const filePath = path.join(__dirname, "..", "data", "scenarios", level.toLowerCase(), `${id}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
    } catch (err) {
        console.error(`Failed to load scenario file for ${level}/${id}:`, err);
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
                section_a2: { include: { scenario: true } },
                section_a1: { include: { scenario: true } },
                section_b1: { include: { scenario: true } },
                // Use plural names as defined in schema relations
                answersA1: true,
                answersA2: true,
                answersB1: true
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

        const { examId } = req.params;

        const exam = await prisma.mockExam.findUnique({
            where: { id: examId },
            include: {
                section_a2: { include: { scenario: true } },
                section_a1: { include: { scenario: true } },
                section_b1: { include: { scenario: true } },
                answersA1: true,
                answersA2: true,
                answersB1: true,
            }
        });

        if (!exam || exam.user_id !== userId) {
            return res.status(404).json({ error: "Exam not found" });
        }

        // Assemble full scenario items
        const scenarios: any[] = [];

        // A2
        if (exam.section_a2) {
            const content = loadScenarioContent("A2", exam.section_a2.scenarioId);
            scenarios.push({
                level: "A2",
                items: content ? content.items : JSON.parse(exam.section_a2.scenario.contentJson || "{}").items
            });
        }

        // A1 or B1
        // Determine path using explicit selection if available, otherwise heuristic
        if (exam.selected_path === "B1") {
            if (exam.section_b1) {
                const content = loadScenarioContent("B1", exam.section_b1.scenarioId);
                scenarios.push({
                    level: "B1",
                    items: content ? content.items : JSON.parse(exam.section_b1.scenario.contentJson || "{}").items
                });
            }
        } else if (exam.selected_path === "A1") {
            if (exam.section_a1) {
                const content = loadScenarioContent("A1", exam.section_a1.scenarioId);
                scenarios.push({
                    level: "A1",
                    items: content ? content.items : JSON.parse(exam.section_a1.scenario.contentJson || "{}").items
                });
            }
        }

        // Flatten all items and match with answers
        const allAnswers = [...exam.answersA1, ...exam.answersA2, ...exam.answersB1];

        res.json({
            exam,
            scenarios,
            answers: allAnswers
        });

    } catch (err: any) {
        console.error("Failed to fetch exam details:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/exam/mock/start
// Starts a new mock exam session, initializing with A2 scenario or resumes existing
router.post("/start", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) {
            console.warn("Start request failed: User not found in DB");
            return res.status(401).json({ error: "User not found" });
        }

        const { examId: requestedExamId, forceNew } = req.body;
        console.log(`[START] User ${userId} requested start. examId: ${requestedExamId}, forceNew: ${forceNew}`);

        // Handle Resume Logic
        if (!forceNew) {
            const resumeWhere: any = {
                user_id: userId,
                status: "IN_PROGRESS"
            };

            // If a specific examId is requested, resume only that one
            if (requestedExamId) {
                resumeWhere.id = requestedExamId;
            }

            const existingExam = await prisma.mockExam.findFirst({
                where: resumeWhere,
                orderBy: { createdAt: 'desc' },
                include: {
                    section_a2: { include: { scenario: true } },
                    section_a1: { include: { scenario: true } },
                    section_b1: { include: { scenario: true } },
                    answersA1: true,
                    answersA2: true,
                    answersB1: true
                }
            });

            if (existingExam) {
                console.log(`Resuming exam ${existingExam.id} for user ${userId}`);

                const scenarios: any[] = [];
                if (existingExam.section_a2) {
                    scenarios.push({
                        section: "A2",
                        scenario: loadScenarioContent("A2", existingExam.section_a2.scenarioId) || JSON.parse(existingExam.section_a2.scenario?.contentJson || "{}")
                    });
                }

                if (existingExam.section_a1 && existingExam.answersA1.length > 0) {
                    scenarios.push({
                        section: "A1",
                        scenario: loadScenarioContent("A1", existingExam.section_a1.scenarioId) || JSON.parse(existingExam.section_a1.scenario?.contentJson || "{}")
                    });
                }

                if (existingExam.section_b1 && existingExam.answersB1.length > 0) {
                    scenarios.push({
                        section: "B1",
                        scenario: loadScenarioContent("B1", existingExam.section_b1.scenarioId) || JSON.parse(existingExam.section_b1.scenario?.contentJson || "{}")
                    });
                }

                const allAnswers = [...existingExam.answersA1, ...existingExam.answersA2, ...existingExam.answersB1];

                return res.json({
                    examId: existingExam.id,
                    resumed: true,
                    scenarios,
                    answers: allAnswers
                });
            }
        }

        // --- NEW EXAM FLOW ---
        // (Previously deleted all history here - removed to preserve completed exams)

        // Pre-create BOTH A1 and A2 sections (B1 will be created only when selected)
        const scenarios_A1 = await prisma.scenarioA1.findMany();
        const scenarios_A2 = await prisma.scenarioA2.findMany();

        if (scenarios_A1.length === 0) {
            return res.status(500).json({ error: "No A1 scenarios available" });
        }
        if (scenarios_A2.length === 0) {
            return res.status(500).json({ error: "No A2 scenarios available" });
        }

        // Random selection for both
        const scenarioA1 = scenarios_A1[Math.floor(Math.random() * scenarios_A1.length)];
        const scenarioA2 = scenarios_A2[Math.floor(Math.random() * scenarios_A2.length)];

        // Create Section instances
        const sectionA1 = await prisma.mockExamSectionA1.create({
            data: { scenarioId: scenarioA1.id }
        });

        const sectionA2 = await prisma.mockExamSectionA2.create({
            data: { scenarioId: scenarioA2.id }
        });

        // Pre-create B1 Options (2 random scenarios)
        const scenarios_B1 = await prisma.scenarioB1.findMany();
        if (scenarios_B1.length < 2) {
            return res.status(500).json({ error: "Not enough B1 scenarios available" });
        }

        // Shuffle and pick 2 unique scenarios
        const shuffledB1 = scenarios_B1.sort(() => 0.5 - Math.random());
        const selectedB1 = shuffledB1.slice(0, 2);

        // Create Section instances for B1 options
        const sectionB1_Option1 = await prisma.mockExamSectionB1.create({
            data: { scenarioId: selectedB1[0].id }
        });

        const sectionB1_Option2 = await prisma.mockExamSectionB1.create({
            data: { scenarioId: selectedB1[1].id }
        });

        // Create MockExam with ALL sections pre-populated (A1, A2, and B1 Options)
        const exam = await prisma.mockExam.create({
            data: {
                user_id: userId,
                section_a1_id: sectionA1.id,
                section_a2_id: sectionA2.id,
                section_b1_option1_id: sectionB1_Option1.id,
                section_b1_option2_id: sectionB1_Option2.id,
                status: "IN_PROGRESS"
            }
        });

        // Load A2 content for the initial flow (user starts with A2)
        const freshContent = loadScenarioContent("A2", scenarioA2.id);

        res.json({
            examId: exam.id,
            section: "A2",
            scenario: freshContent || JSON.parse(scenarioA2.contentJson || "{}")
        });

    } catch (err: any) {
        console.error("Failed to start mock exam:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/exam/mock/:examId/answer
// Submit multiple answers for a section
router.post("/:examId/answer", requireAuth, upload.any(), async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const { examId } = req.params;

        // In multipart/form-data, answers might be sent as a JSON string
        let answers = req.body.answers;
        if (typeof answers === 'string') {
            answers = JSON.parse(answers);
        }

        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: "Answers must be an array" });
        }

        const files = req.files as Express.Multer.File[];
        const results = [];

        for (const ans of answers) {
            const { sectionType, questionId, answerText, fileField } = ans;

            let finalAudioUrl = ans.audioUrl;

            // If a file was uploaded for this question, use its path
            if (fileField && files) {
                const uploadedFile = files.find(f => f.fieldname === fileField);
                if (uploadedFile) {
                    finalAudioUrl = `/audio/recordings/${uploadedFile.filename}`;
                }
            }

            const data = {
                mock_exam_id: examId,
                user_id: userId,
                question_id: questionId,
                answer_text: answerText || '',
                audio_url: finalAudioUrl || ''
            };

            let result;
            if (sectionType === "A1") {
                result = await prisma.mockExamAnswerA1.upsert({
                    where: { user_id_mock_exam_id_question_id: { user_id: userId, mock_exam_id: examId, question_id: questionId } },
                    update: data,
                    create: data
                });
            } else if (sectionType === "A2") {
                result = await prisma.mockExamAnswerA2.upsert({
                    where: { user_id_mock_exam_id_question_id: { user_id: userId, mock_exam_id: examId, question_id: questionId } },
                    update: data,
                    create: data
                });
            } else if (sectionType === "B1") {
                result = await prisma.mockExamAnswerB1.upsert({
                    where: { user_id_mock_exam_id_question_id: { user_id: userId, mock_exam_id: examId, question_id: questionId } },
                    update: data,
                    create: data
                });
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
router.post("/:examId/decision", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const { examId } = req.params;
        const { choice } = req.body; // "A1", "B1" or specific Topic ID

        console.log(`[DECISION] User ${userId} made choice "${choice}" for exam ${examId}`);

        if (!choice) {
            return res.status(400).json({ error: "Missing choice." });
        }

        // --- RESUME PROTECTION ---
        const existingExam = await prisma.mockExam.findUnique({
            where: { id: examId },
            include: {
                section_a1: { include: { scenario: true } },
                section_b1: { include: { scenario: true } },
                section_b1_option1: { include: { scenario: true } },
                section_b1_option2: { include: { scenario: true } }
            }
        });

        if (!existingExam) {
            return res.status(404).json({ error: "Exam not found." });
        }

        let freshContent = null;
        let scenarioContentJson = null;

        if (choice === "A1") {
            // User selected A1
            if (!existingExam.section_a1 || !existingExam.section_a1.scenario) {
                return res.status(500).json({ error: "A1 section not properly initialized" });
            }

            freshContent = loadScenarioContent("A1", existingExam.section_a1.scenario.id);
            scenarioContentJson = existingExam.section_a1.scenario.contentJson;

            // Mark path as A1
            await prisma.mockExam.update({
                where: { id: examId },
                data: { selected_path: "A1" }
            });
            console.log(`[DECISION] ✓ Updated exam ${examId} with selected_path="A1"`);

        } else if (choice === "B1") {
            // User selected B1 -> Show Topic Selection Options

            if (!existingExam.section_b1_option1 || !existingExam.section_b1_option2) {
                return res.status(500).json({ error: "B1 options missing for this exam" });
            }

            const option1Scenario = existingExam.section_b1_option1.scenario;
            const option2Scenario = existingExam.section_b1_option2.scenario;

            return res.json({
                examId,
                section: "B1",
                scenario: {
                    title: "Expression Orale B1",
                    items: [
                        {
                            id: "b1_topic_selection",
                            type: "topic_selection",
                            instruction: "Choisissez un sujet pour la partie B1 :",
                            options: [
                                {
                                    id: option1Scenario.id,
                                    title: option1Scenario.title,
                                    description: "Discussion informelle"
                                },
                                {
                                    id: option2Scenario.id,
                                    title: option2Scenario.title,
                                    description: "Discussion formelle"
                                }
                            ]
                        }
                    ]
                }
            });

        } else {
            // Choice is a specific B1 Scenario ID (Topic Selection)
            console.log(`[DECISION] User selected B1 topic: ${choice}`);

            let selectedSectionId = null;
            let scenario = null;

            if (existingExam.section_b1_option1 && existingExam.section_b1_option1.scenario.id === choice) {
                selectedSectionId = existingExam.section_b1_option1.id;
                scenario = existingExam.section_b1_option1.scenario;
            } else if (existingExam.section_b1_option2 && existingExam.section_b1_option2.scenario.id === choice) {
                selectedSectionId = existingExam.section_b1_option2.id;
                scenario = existingExam.section_b1_option2.scenario;
            } else {
                return res.status(404).json({ error: "Invalid B1 topic selection" });
            }

            console.log(`[DECISION] Matched choice ${choice} to section ID: ${selectedSectionId}`);

            // Update exam with B1 section and path
            await prisma.mockExam.update({
                where: { id: examId },
                data: {
                    section_b1_id: selectedSectionId,
                    selected_path: "B1"
                }
            });
            console.log(`[DECISION] ✓ Updated exam ${examId} with selected B1 section and selected_path="B1"`);

            freshContent = loadScenarioContent("B1", scenario.id);
            scenarioContentJson = scenario.contentJson;
        }

        res.json({
            examId,
            section: choice,
            scenario: freshContent || JSON.parse(scenarioContentJson || "{}")
        });
    } catch (err: any) {
        console.error("Failed to process decision", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/exam/mock/:examId/complete
// Finalizes the mock exam session
router.post("/:examId/complete", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "User not found" });

        const { examId } = req.params;
        console.log(`[COMPLETE] User ${userId} completing exam ${examId}`);

        const updated = await prisma.mockExam.update({
            where: { id: examId, user_id: userId },
            data: { status: "COMPLETED" }
        });

        console.log(`[COMPLETE] ✓ Exam ${examId} marked as COMPLETED`);

        res.json({ ok: true });
    } catch (err: any) {
        console.error("[COMPLETE ERROR] Failed to complete exam:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
