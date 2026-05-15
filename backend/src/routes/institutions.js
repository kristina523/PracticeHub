import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/institutions:
 *   get:
 *     summary: Получить список учебных заведений
 *     tags: [Institutions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поиск по названию
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Лимит результатов
 *     responses:
 *       200:
 *         description: Список учебных заведений
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Не авторизован
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, limit = 10 } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    const institutions = await prisma.institution.findMany({
      where,
      include: {
        _count: {
          select: { students: true }
        }
      },
      orderBy: {
        name: 'asc'
      },
      take: parseInt(limit)
    });

    res.json(institutions);
  } catch (error) {
    console.error('Ошибка получения всех институтов:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});


/**
 * @swagger
 * /api/institutions:
 *   post:
 *     summary: Создать новое учебное заведение
 *     tags: [Institutions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "МГУ"
 *               type:
 *                 type: string
 *                 enum: [COLLEGE, UNIVERSITY]
 *                 example: "UNIVERSITY"
 *               description:
 *                 type: string
 *                 example: "Описание учебного заведения"
 *     responses:
 *       201:
 *         description: Учебное заведение успешно создано
 *       400:
 *         description: Ошибка валидации или заведение уже существует
 *       401:
 *         description: Не авторизован
 */
router.post('/',
  authenticateToken,
  [
    body('name').trim().notEmpty().withMessage('Название института обязательно'),
    body('type').isIn(['COLLEGE', 'UNIVERSITY']).withMessage('Неверный тип института')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, type, description } = req.body;

      const existing = await prisma.institution.findFirst({
        where: { name }
      });

      if (existing) {
        return res.status(400).json({ message: 'Институт с таким названием уже существует' });
      }

      const institution = await prisma.institution.create({
        data: { 
          name, 
          type,
          ...(description && { description })
        }
      });

      res.status(201).json(institution);
    } catch (error) {
      console.error('Ошибка создания института:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

/**
 * @swagger
 * /api/institutions/{id}:
 *   get:
 *     summary: Получить учебное заведение по ID
 *     tags: [Institutions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID учебного заведения
 *     responses:
 *       200:
 *         description: Информация об учебном заведении
 *       404:
 *         description: Учебное заведение не найдено
 *       401:
 *         description: Не авторизован
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const institution = await prisma.institution.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            institution: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: { students: true }
        }
      }
    });

    if (!institution) {
      return res.status(404).json({ message: 'Институт не найден' });
    }

    res.json(institution);
  } catch (error) {
    console.error('Ошибка получения института:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});
/**
 * @swagger
 * /api/institutions/{id}:
 *   put:
 *     summary: Обновить учебное заведение
 *     tags: [Institutions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID учебного заведения
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [COLLEGE, UNIVERSITY]
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Учебное заведение успешно обновлено
 *       400:
 *         description: Ошибка валидации
 *       404:
 *         description: Учебное заведение не найдено
 *       401:
 *         description: Не авторизован
 */
router.put('/:id',
  authenticateToken,
  [
    body('name').optional().trim().notEmpty().withMessage('Название института не может быть пустым'),
    body('type').optional().isIn(['COLLEGE', 'UNIVERSITY']).withMessage('Неверный тип института')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { name, type, description } = req.body;

      const existing = await prisma.institution.findUnique({
        where: { id }
      });

      if (!existing) {
        return res.status(404).json({ message: 'Институт не найден' });
      }

      if (name && name !== existing.name) {
        const nameTaken = await prisma.institution.findFirst({
          where: { name }
        });

        if (nameTaken) {
          return res.status(400).json({ message: 'Институт с таким названием уже существует' });
        }
      }

      const institution = await prisma.institution.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(type && { type }),
          ...(description !== undefined && { description })
        }
      });

      res.json(institution);
    } catch (error) {
      console.error('Ошибка обновления института:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);


/**
 * @swagger
 * /api/institutions/{id}:
 *   delete:
 *     summary: Удалить учебное заведение
 *     tags: [Institutions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID учебного заведения
 *     responses:
 *       200:
 *         description: Учебное заведение успешно удалено
 *       400:
 *         description: Невозможно удалить заведение с связанными студентами
 *       404:
 *         description: Учебное заведение не найдено
 *       401:
 *         description: Не авторизован
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const institution = await prisma.institution.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: true }
        }
      }
    });

    if (!institution) {
      return res.status(404).json({ message: 'Институт не найден' });
    }

    if (institution._count.students > 0) {
      return res.status(400).json({
      message: 'Невозможно удалить институт с связанными студентами',
      studentCount: institution._count.students
      });
    }

    await prisma.institution.delete({
      where: { id }
    });

    res.json({ message: 'Институт успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления института:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;

