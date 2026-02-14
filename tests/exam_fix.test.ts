
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
        mockExamAnswerA1: { deleteMany: jest.fn() },
        mockExamAnswerA2: { deleteMany: jest.fn() },
        mockExamAnswerB1: { deleteMany: jest.fn() },
        scenarioA1: { findMany: jest.fn() },
        scenarioA2: { findMany: jest.fn() },
        scenarioB1: { findMany: jest.fn() },
        mockExamSectionA1: { create: jest.fn() },
        mockExamSectionA2: { create: jest.fn() },
        mockExamSectionB1: { create: jest.fn() },
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

            // Setup Scenarios (needed for creation flow)
            mockPrisma.scenarioA1.findMany.mockResolvedValue([{ id: 'a1_1', title: 'A1', contentJson: '{}' }]);
            mockPrisma.scenarioA2.findMany.mockResolvedValue([{ id: 'a2_1', title: 'A2', contentJson: '{}' }]);
            mockPrisma.scenarioB1.findMany.mockResolvedValue([
                { id: 'b1_1', title: 'B1 1', contentJson: '{}' },
                { id: 'b1_2', title: 'B1 2', contentJson: '{}' }
            ]);

            // Setup Sections creation
            mockPrisma.mockExamSectionA1.create.mockResolvedValue({ id: 'sec_a1' });
            mockPrisma.mockExamSectionA2.create.mockResolvedValue({ id: 'sec_a2' });
            mockPrisma.mockExamSectionB1.create.mockResolvedValue({ id: 'sec_b1' });

            // Setup Exam creation
            mockPrisma.mockExam.create.mockResolvedValue({
                id: 'new_exam_id',
                user_id: 123,
                status: 'IN_PROGRESS'
            });

            // EXECUTE
            const response = await request(app).post('/exam/start');

            // VERIFY
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('examId', 'new_exam_id');

            // CRITICAL CHECK: deleteMany should NOT have been called
            expect(mockPrisma.mockExam.deleteMany).not.toHaveBeenCalled();
            expect(mockPrisma.mockExamAnswerA1.deleteMany).not.toHaveBeenCalled();
            expect(mockPrisma.mockExamAnswerA2.deleteMany).not.toHaveBeenCalled();
            expect(mockPrisma.mockExamAnswerB1.deleteMany).not.toHaveBeenCalled();

            // Also ensure transaction was not used to wrap deletions (if creating involved transaction it might be called, but with different args)
            // But in the original code, transaction was specifically for deletions. 
            // If the code uses transaction for creation, we must check what was passed.
            // In the "after fix" code, create is not in transaction (based on my read of the code).
            // Let's verify create was called
            expect(mockPrisma.mockExam.create).toHaveBeenCalled();
        });
    });
});
