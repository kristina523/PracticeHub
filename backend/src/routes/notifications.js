import express from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { sendBulkNotifications } from '../bot/telegramBot.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/notifications/bulk:
 *   post:
 *     summary: Отправить массовые уведомления
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Текст уведомления
 *                 example: "Важное объявление для всех студентов"
 *               telegramIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Список Telegram ID получателей
 *               filters:
 *                 type: object
 *                 description: Фильтры для выбора получателей
 *                 properties:
 *                   practiceType:
 *                     type: string
 *                     enum: [EDUCATIONAL, PRODUCTION, INTERNSHIP]
 *                   status:
 *                     type: string
 *                     enum: [PENDING, ACTIVE, COMPLETED]
 *                   institutionId:
 *                     type: string
 *     responses:
 *       200:
 *         description: Массовая отправка завершена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 total:
 *                   type: integer
 *                 success:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *                 results:
 *                   type: array
 *       400:
 *         description: Ошибка валидации или не выбраны получатели
 *       403:
 *         description: Доступ запрещен (только для админов и преподавателей)
 *       401:
 *         description: Не авторизован
 */
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

      const rawInputs = telegramIds
        .filter(Boolean)
        .map((id) => id.toString().trim())
        .filter(Boolean);

      const collectedIds = new Set();
      const unresolved = [];

      for (const raw of rawInputs) {
        // Чистый chat_id — только цифры (поддерживаем и отрицательные ID групп)
        if (/^-?\d+$/.test(raw)) {
          collectedIds.add(raw);
          continue;
        }
        // @username или username — ищем StudentUser по логину/нику (регистронечувствительно)
        const handle = raw.startsWith('@') ? raw.slice(1) : raw;
        const handleLower = handle.toLowerCase();

        const candidates = await prisma.studentUser.findMany({
          where: {
            OR: [{ username: handle }, { email: handle }],
            telegramId: { not: null }
          },
          select: { telegramId: true, username: true, email: true }
        });

        let match = candidates.find((c) => /^-?\d+$/.test(c.telegramId || ''));

        if (!match) {
          // Расширенный фоллбэк: подгружаем всех с telegramId и ищем без учёта регистра
          const all = await prisma.studentUser.findMany({
            where: { telegramId: { not: null } },
            select: { telegramId: true, username: true, email: true }
          });
          match = all.find(
            (c) =>
              /^-?\d+$/.test(c.telegramId || '') &&
              ((c.username || '').toLowerCase() === handleLower ||
                (c.email || '').toLowerCase() === handleLower)
          );
        }

        if (match?.telegramId) {
          collectedIds.add(match.telegramId);
        } else {
          unresolved.push(raw);
        }
      }

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
        return res.status(400).json({
          message:
            unresolved.length > 0
              ? `Не удалось распознать получателей: ${unresolved.join(', ')}. Используйте числовой chat_id или @username студента, который зарегистрировался в боте.`
              : 'Не выбраны получатели уведомления',
          unresolved
        });
      }

      const idsArray = Array.from(collectedIds);
      const results = await sendBulkNotifications(idsArray, message);

      const successCount = results.filter((r) => r.success).length;
      res.json({
        message: 'Массовая отправка завершена',
        total: idsArray.length,
        success: successCount,
        failed: idsArray.length - successCount,
        unresolved,
        results
      });
    } catch (error) {
      console.error('Ошибка массовой отправки уведомлений:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

export default router;

