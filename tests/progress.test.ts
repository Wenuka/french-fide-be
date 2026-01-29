import request from 'supertest';
import express from 'express';
import progressRouter from '../src/routes/progress';

// 1. Mock dependencies
// Mock Prisma
jest.mock('../src/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
        },
        topicProgress: {
            findMany: jest.fn(),
            upsert: jest.fn(),
            deleteMany: jest.fn(),
        },
    },
}));

import { prisma } from '../src/lib/prisma';
const mockPrisma = prisma as any; // Cast to any or helper type for mocking

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


describe('Progress API', () => {
    let app: express.Express;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/progress', progressRouter);
        jest.clearAllMocks();
    });

    describe('GET /progress', () => {
        it('should return progress map for authenticated user', async () => {
            // Mock user finding
            mockPrisma.user.findUnique.mockResolvedValue({ id: 123 });
            // Mock progress finding
            mockPrisma.topicProgress.findMany.mockResolvedValue([
                { section: 'DIALOGUE', topic_id: 10 },
                { section: 'DISCUSSION', topic_id: 1005 },
            ]);

            const response = await request(app).get('/progress');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                "0": { "10": true },   // DIALOGUE mapped to 0
                "1": { "1005": true }  // DISCUSSION mapped to 1
            });
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { uid: 'test-firebase-uid' },
                select: { id: true }
            });
            expect(mockPrisma.topicProgress.findMany).toHaveBeenCalledWith({ where: { user_id: 123 }, select: expect.any(Object) });
        });

        it('should return 404 if user not found in DB', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const response = await request(app).get('/progress');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'User not found' });
        });
    });

    describe('POST /progress', () => {
        it('should mark topic as completed (upsert)', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 123 });
            mockPrisma.topicProgress.upsert.mockResolvedValue({});

            const payload = { section: 0, topicId: 42, completed: true };
            const response = await request(app).post('/progress').send(payload);

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });
            expect(mockPrisma.topicProgress.upsert).toHaveBeenCalledWith({
                where: expect.anything(), // Compound key structure
                create: { user_id: 123, section: 'DIALOGUE', topic_id: 42 },
                update: {},
            });
        });

        it('should mark topic as incomplete (deleteMany)', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 123 });
            mockPrisma.topicProgress.deleteMany.mockResolvedValue({ count: 1 });

            const payload = { section: 1, topicId: 99, completed: false };
            const response = await request(app).post('/progress').send(payload);

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });
            expect(mockPrisma.topicProgress.deleteMany).toHaveBeenCalledWith({
                where: { user_id: 123, section: 'DISCUSSION', topic_id: 99 },
            });
        });

        it('should validate input', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 123 });

            // Missing completed
            const payload = { section: 0, topicId: 42 };
            const response = await request(app).post('/progress').send(payload);

            expect(response.status).toBe(400);
        });
    });
});
