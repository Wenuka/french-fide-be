import { Router } from 'express';
import usersRouter from './user';
import healthRouter from './health';

const router = Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: API Root
 *     description: Checks if the API is working and provides a link to documentation.
 *     tags:
 *       - General
 *     responses:
 *       200:
 *         description: API is working
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: API is working
 *                 docs:
 *                   type: string
 *                   example: /api-docs
 */
router.get('', (_, res) => {
  res.json({
    message: 'API is working',
    docs: '/api-docs',
  });
});

// Mount other routes
router.use('/user', usersRouter);
router.use('/health', healthRouter);

export default router;
