
import request from 'supertest';
import express from 'express';
import examRouter from '../src/routes/exam';

// 1. Mock dependencies
jest.mock('../src/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
        },
        mockExam: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            deleteMany: jest.fn(), // We will inspect this
        },
        a1SectionSpeakingAnswer: { deleteMany: jest.fn() },
        a1SectionListeningAnswer: { deleteMany: jest.fn() },
        a2SectionSpeakingAnswer: { deleteMany: jest.fn() },
        a2SectionListeningAnswer: { deleteMany: jest.fn() },
        b1SectionSpeakingAnswer: { deleteMany: jest.fn() },
        b1SectionListeningAnswer: { deleteMany: jest.fn() },
        a1SectionSpeaking: { findMany: jest.fn() },
        a1SectionListening: { findMany: jest.fn() },
        a2SectionSpeaking: { findMany: jest.fn() },
        a2SectionListening: { findMany: jest.fn() },
        b1SectionSpeaking: { findMany: jest.fn() },
        b1SectionListening: { findMany: jest.fn() },
        $transaction: jest.fn(),
    },
}));

import { prisma } from '../src/lib/prisma';
const mockPrisma = prisma as any;

// Mock Middleware
jest.mock('../src/middleware/requireAuth', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        req.user = { uid: 'test-firebase-uid' };
        next();
    },
}));

// Mock Helper
jest.mock('../src/routes/user/helpers', () => ({
    extractUidFromRequest: () => 'test-firebase-uid',
}));

// Mock fs to avoid file system errors
jest.mock('fs', () => ({
    existsSync: jest.fn(() => false),
    readFileSync: jest.fn(),
    mkdirSync: jest.fn(),
}));

describe('Exam API - Fix Verification', () => {
    let app: express.Express;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/exam', examRouter);
        jest.clearAllMocks();
    });

    describe('POST /exam/start', () => {
        it('should NOT delete existing exam history when starting a new exam', async () => {
            // Setup User
            mockPrisma.user.findUnique.mockResolvedValue({ id: 123 });

            // Setup: No IN_PROGRESS exam exists (so it creates a new one)
            mockPrisma.mockExam.findFirst.mockResolvedValue(null);
            mockPrisma.mockExam.findMany.mockResolvedValue([]);

            // Setup Scenarios (needed for creation flow)
            mockPrisma.a1SectionSpeaking.findMany.mockResolvedValue([{ id: 1, json_id: 'a1_1', title: 'A1' }]);
            mockPrisma.a1SectionListening.findMany.mockResolvedValue([{ id: 1, json_id: 'a1_L_1', title: 'A1L' }]);
            mockPrisma.a2SectionSpeaking.findMany.mockResolvedValue([{ id: 2, json_id: 'a2_1', title: 'A2' }]);
            mockPrisma.a2SectionListening.findMany.mockResolvedValue([{ id: 2, json_id: 'a2_L_1', title: 'A2L' }]);
            mockPrisma.b1SectionSpeaking.findMany.mockResolvedValue([
                { id: 3, json_id: 'b1_1', title: 'B1 1' },
                { id: 4, json_id: 'b1_2', title: 'B1 2' }
            ]);
            mockPrisma.b1SectionListening.findMany.mockResolvedValue([{ id: 3, json_id: 'b1_L_1', title: 'B1L' }]);

            // Setup Exam creation
            mockPrisma.mockExam.create.mockResolvedValue({
                id: 'new_exam_id',
                user_id: 123,
                status: 'IN_PROGRESS',
                speaking_a2: { json_id: 'a2_1' },
                listening_a2: { json_id: 'a2_L_1' }
            });

            // EXECUTE
            const response = await request(app).post('/exam/start');

            // VERIFY
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('examId', 'new_exam_id');

            // CRITICAL CHECK: deleteMany should NOT have been called
            expect(mockPrisma.mockExam.deleteMany).not.toHaveBeenCalled();
            expect(mockPrisma.a1SectionSpeakingAnswer.deleteMany).not.toHaveBeenCalled();
            expect(mockPrisma.a2SectionSpeakingAnswer.deleteMany).not.toHaveBeenCalled();
            expect(mockPrisma.b1SectionSpeakingAnswer.deleteMany).not.toHaveBeenCalled();

            // Also ensure transaction was not used to wrap deletions (if creating involved transaction it might be called, but with different args)
            // But in the original code, transaction was specifically for deletions. 
            // If the code uses transaction for creation, we must check what was passed.
            // In the "after fix" code, create is not in transaction (based on my read of the code).
            // Let's verify create was called
            expect(mockPrisma.mockExam.create).toHaveBeenCalled();
        });
    });
});
