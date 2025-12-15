import express from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { sendBulkNotifications } from '../bot/telegramBot.js';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/bulk',
  authenticateToken,
  [
    body('message').trim().notEmpty().withMessage('Текст уведомления обязателен'),
    body('telegramIds').optional().isArray().withMessage('telegramIds должен быть массивом строк'),
    body('filters').optional().isObject().withMessage('filters должен быть объектом')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!['admin', 'teacher'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }

      const { message, telegramIds = [], filters = {} } = req.body;

      const collectedIds = new Set(
        telegramIds
          .filter(Boolean)
          .map(id => id.toString())
      );

      const hasFilters = filters.practiceType || filters.status || filters.institutionId;
      if (hasFilters) {
        const where = {
          telegramId: { not: null },
        };

        if (filters.practiceType) {
          where.practiceType = filters.practiceType;
        }
        if (filters.status) {
          where.status = filters.status;
        }
        if (filters.institutionId) {
          where.institutionId = filters.institutionId;
        }

        const students = await prisma.student.findMany({
          where,
          select: { telegramId: true }
        });

        students.forEach(s => s.telegramId && collectedIds.add(s.telegramId));
      }

      if (collectedIds.size === 0) {
        return res.status(400).json({ message: 'Не выбраны получатели уведомления' });
      }

      const idsArray = Array.from(collectedIds);
      const results = await sendBulkNotifications(idsArray, message);

      const successCount = results.filter(r => r.success).length;
      res.json({
        message: 'Массовая отправка завершена',
        total: idsArray.length,
        success: successCount,
        failed: idsArray.length - successCount,
        results
      });
    } catch (error) {
      console.error('Ошибка массовой отправки уведомлений:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

export default router;

