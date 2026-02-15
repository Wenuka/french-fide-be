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

// Helper to get least-used scenarios for a user
async function getLeastUsedScenarios(
    userId: number,
    level: 'A1' | 'A2' | 'B1',
    count: number = 1
): Promise<string[]> {
    // Get all scenarios for this level
    let allScenarios: { id: string }[] = [];
    if (level === 'A1') {
        allScenarios = await prisma.scenarioA1.findMany({ select: { id: true } });
    } else if (level === 'A2') {
        allScenarios = await prisma.scenarioA2.findMany({ select: { id: true } });
    } else if (level === 'B1') {
        allScenarios = await prisma.scenarioB1.findMany({ select: { id: true } });
    }

    if (allScenarios.length === 0) {
        throw new Error(`No ${level} scenarios available`);
    }

    // If we need more scenarios than available, we'll have to duplicate
    // This is okay - user wants variety but accepts duplicates when necessary
    if (count > allScenarios.length) {
        console.log(`[SMART_SELECTION] Requested ${count} ${level} scenarios but only ${allScenarios.length} available. Will duplicate.`);
    }

    // Get user's exam history to count scenario usage
    const userExams = await prisma.mockExam.findMany({
        where: { user_id: userId },
        select: {
            scenario_a1_id: true,
            scenario_a2_id: true,
            scenario_b1_id: true,
            scenario_b1_option1_id: true,
            scenario_b1_option2_id: true
        }
    });

    // Count usage for each scenario
    const usageCount: Record<string, number> = {};
    allScenarios.forEach(s => usageCount[s.id] = 0);

    userExams.forEach(exam => {
        if (level === 'A1' && exam.scenario_a1_id) {
            usageCount[exam.scenario_a1_id] = (usageCount[exam.scenario_a1_id] || 0) + 1;
        } else if (level === 'A2' && exam.scenario_a2_id) {
            usageCount[exam.scenario_a2_id] = (usageCount[exam.scenario_a2_id] || 0) + 1;
        } else if (level === 'B1') {
            // Count B1 selected scenarios and options shown
            if (exam.scenario_b1_id) {
                usageCount[exam.scenario_b1_id] = (usageCount[exam.scenario_b1_id] || 0) + 1;
            }
            // Also count options that were shown (even if not selected)
            if (exam.scenario_b1_option1_id) {
                usageCount[exam.scenario_b1_option1_id] = (usageCount[exam.scenario_b1_option1_id] || 0) + 0.5;
            }
            if (exam.scenario_b1_option2_id) {
                usageCount[exam.scenario_b1_option2_id] = (usageCount[exam.scenario_b1_option2_id] || 0) + 0.5;
            }
        }
    });

    // Sort scenarios by usage count (ascending)
    const sortedScenarios = allScenarios
        .map(s => ({ id: s.id, count: usageCount[s.id] }))
        .sort((a, b) => a.count - b.count);

    // Get the minimum usage count
    const minUsage = sortedScenarios[0].count;

    // Get all scenarios with minimum usage
    const leastUsedScenarios = sortedScenarios
        .filter(s => s.count === minUsage)
        .map(s => s.id);

    // Shuffle the least-used scenarios
    const shuffled = leastUsedScenarios.sort(() => 0.5 - Math.random());

    // If we don't have enough unique least-used scenarios, we need to fill with duplicates
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
        // Use modulo to cycle through available scenarios if we need duplicates
        result.push(shuffled[i % shuffled.length]);
    }

    console.log(`[SMART_SELECTION] Selected ${count} ${level} scenarios: ${result.join(', ')}`);
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
                scenario_a2: true,
                scenario_a1: true,
                scenario_b1: true,
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
                scenario_a2: true,
                scenario_a1: true,
                scenario_b1: true,
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
        if (exam.scenario_a2) {
            const content = loadScenarioContent("A2", exam.scenario_a2.id);
            scenarios.push({
                level: "A2",
                items: content ? content.items : JSON.parse(exam.scenario_a2.contentJson || "{}").items
            });
        }

        // A1 or B1
        // Determine path using explicit selection if available, otherwise heuristic
        if (exam.selected_path === "B1") {
            if (exam.scenario_b1) {
                const content = loadScenarioContent("B1", exam.scenario_b1.id);
                scenarios.push({
                    level: "B1",
                    items: content ? content.items : JSON.parse(exam.scenario_b1.contentJson || "{}").items
                });
            }
        } else if (exam.selected_path === "A1") {
            if (exam.scenario_a1) {
                const content = loadScenarioContent("A1", exam.scenario_a1.id);
                scenarios.push({
                    level: "A1",
                    items: content ? content.items : JSON.parse(exam.scenario_a1.contentJson || "{}").items
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
                    scenario_a2: true,
                    scenario_a1: true,
                    scenario_b1: true,
                    answersA1: true,
                    answersA2: true,
                    answersB1: true
                }
            });

            if (existingExam) {
                console.log(`Resuming exam ${existingExam.id} for user ${userId}`);

                const scenarios: any[] = [];
                if (existingExam.scenario_a2) {
                    scenarios.push({
                        section: "A2",
                        scenario: loadScenarioContent("A2", existingExam.scenario_a2.id) || JSON.parse(existingExam.scenario_a2?.contentJson || "{}")
                    });
                }

                if (existingExam.scenario_a1 && existingExam.answersA1.length > 0) {
                    scenarios.push({
                        section: "A1",
                        scenario: loadScenarioContent("A1", existingExam.scenario_a1.id) || JSON.parse(existingExam.scenario_a1?.contentJson || "{}")
                    });
                }

                if (existingExam.scenario_b1 && existingExam.answersB1.length > 0) {
                    scenarios.push({
                        section: "B1",
                        scenario: loadScenarioContent("B1", existingExam.scenario_b1.id) || JSON.parse(existingExam.scenario_b1?.contentJson || "{}")
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

        // Use smart selection to get least-used A2 scenario
        const [leastUsedA2Id] = await getLeastUsedScenarios(userId, 'A2', 1);
        const scenarioA2 = await prisma.scenarioA2.findUnique({
            where: { id: leastUsedA2Id }
        });

        if (!scenarioA2) {
            return res.status(500).json({ error: "No A2 scenarios available" });
        }

        // Create MockExam with only A2 set
        // A1 and B1 will be set when user selects their path
        const exam = await prisma.mockExam.create({
            data: {
                user_id: userId,
                scenario_a2_id: scenarioA2.id,
                // Leave A1 and B1 empty - they'll be set in select-path
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
                scenario_a1: true,
                scenario_b1: true
            }
        });

        if (!existingExam) {
            return res.status(404).json({ error: "Exam not found." });
        }

        let freshContent = null;
        let scenarioContentJson = null;

        if (choice === "A1") {
            // User selected A1 - use smart selection to get least-used A1 scenario
            const [leastUsedA1Id] = await getLeastUsedScenarios(userId, 'A1', 1);

            // Update exam with selected A1 scenario
            await prisma.mockExam.update({
                where: { id: examId },
                data: {
                    scenario_a1_id: leastUsedA1Id,
                    selected_path: "A1"
                }
            });

            const scenarioA1 = await prisma.scenarioA1.findUnique({
                where: { id: leastUsedA1Id }
            });

            if (!scenarioA1) {
                return res.status(500).json({ error: "A1 scenario not found" });
            }

            freshContent = loadScenarioContent("A1", scenarioA1.id);
            scenarioContentJson = scenarioA1.contentJson;

            console.log(`[DECISION] ✓ Updated exam ${examId} with selected_path="A1" and scenario_a1_id="${leastUsedA1Id}"`);

        } else if (choice === "B1") {
            // User selected B1 - use smart selection to get 2 least-used B1 scenarios
            const [option1Id, option2Id] = await getLeastUsedScenarios(userId, 'B1', 2);

            // Update exam with B1 options
            await prisma.mockExam.update({
                where: { id: examId },
                data: {
                    scenario_b1_option1_id: option1Id,
                    scenario_b1_option2_id: option2Id
                }
            });

            const option1Scenario = await prisma.scenarioB1.findUnique({ where: { id: option1Id } });
            const option2Scenario = await prisma.scenarioB1.findUnique({ where: { id: option2Id } });

            if (!option1Scenario || !option2Scenario) {
                return res.status(500).json({ error: "B1 scenarios not found" });
            }

            // Return topic selection UI
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

            // Fetch the B1 options from the exam to validate the choice
            const examWithOptions = await prisma.mockExam.findUnique({
                where: { id: examId },
                select: {
                    scenario_b1_option1_id: true,
                    scenario_b1_option2_id: true
                }
            });

            if (!examWithOptions || !examWithOptions.scenario_b1_option1_id || !examWithOptions.scenario_b1_option2_id) {
                return res.status(500).json({ error: "B1 options not set for this exam" });
            }

            // Validate that the choice matches one of the options
            let selectedScenarioId = null;
            if (choice === examWithOptions.scenario_b1_option1_id) {
                selectedScenarioId = choice;
            } else if (choice === examWithOptions.scenario_b1_option2_id) {
                selectedScenarioId = choice;
            } else {
                return res.status(404).json({ error: "Invalid B1 topic selection" });
            }

            // Fetch the selected scenario
            const scenario = await prisma.scenarioB1.findUnique({
                where: { id: selectedScenarioId }
            });

            if (!scenario) {
                return res.status(500).json({ error: "B1 scenario not found" });
            }

            console.log(`[DECISION] Matched choice ${choice} to scenario ID: ${selectedScenarioId}`);

            // Update exam with B1 scenario and path
            await prisma.mockExam.update({
                where: { id: examId },
                data: {
                    scenario_b1_id: selectedScenarioId,
                    selected_path: "B1"
                }
            });
            console.log(`[DECISION] ✓ Updated exam ${examId} with selected B1 scenario and selected_path="B1"`);

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
