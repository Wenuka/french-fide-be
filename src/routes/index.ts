import { Router } from 'express';
import usersRouter from './user';
import healthRouter from './health';

const router = Router();

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
