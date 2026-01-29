import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { extractUidFromRequest } from './user/helpers';
import { z } from 'zod';

const router = Router();

// Validation schema for progress updates
const updateProgressSchema = z.object({
    section: z.number().int().min(0).max(1), // 0: Dialogue, 1: Discussion
    topicId: z.number().int().positive(),
    completed: z.boolean(),
});

// GET /progress - Get all progress for the user
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = extractUidFromRequest(req);
        if (!userId) return res.status(401).json({ error: "Invalid token" });

        // Get internal user ID
        const user = await prisma.user.findUnique({
            where: { uid: userId },
            select: { id: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const progress = await prisma.topicProgress.findMany({
            where: { user_id: user.id },
            select: {
                section: true,
                topic_id: true
            }
        });

        // Transform to a mapped structure for easier client consumption
        // { section: { topicId: true } }
        const progressMap: Record<number, Record<number, boolean>> = {};

        progress.forEach(p => {
            let sectionId = p.section === 'DIALOGUE' ? 0 : 1;

            if (!progressMap[sectionId]) {
                progressMap[sectionId] = {};
            }
            progressMap[sectionId][p.topic_id] = true;
        });

        res.json(progressMap);
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

// POST /progress - Update progress
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = extractUidFromRequest(req);
        if (!userId) return res.status(401).json({ error: "Invalid token" });
        const body = updateProgressSchema.parse(req.body); // validates body

        const user = await prisma.user.findUnique({
            where: { uid: userId },
            select: { id: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const sectionEnum = body.section === 0 ? 'DIALOGUE' : 'DISCUSSION';

        if (body.completed) {
            // Create or ignore if exists
            await prisma.topicProgress.upsert({
                where: {
                    user_id_section_topic_id: {
                        user_id: user.id,
                        section: sectionEnum,
                        topic_id: body.topicId
                    }
                },
                create: {
                    user_id: user.id,
                    section: sectionEnum,
                    topic_id: body.topicId
                },
                update: {} // do nothing if exists
            });
        } else {
            // Delete if exists
            await prisma.topicProgress.deleteMany({
                where: {
                    user_id: user.id,
                    section: sectionEnum,
                    topic_id: body.topicId
                }
            });
        }

        res.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        console.error('Error updating progress:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

export default router;
