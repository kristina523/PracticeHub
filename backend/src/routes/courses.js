import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Получить список курсов
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *         description: Направление курса
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Список курсов
 *       401:
 *         description: Не авторизован
 */
// Получить все курсы (для преподавателя - только свои, для админа - все)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { direction, page = 1, limit = 50 } = req.query;

    const where = {};

    // Если преподаватель, показываем только его курсы
    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username }
      });
      if (!teacher) {
        return res.status(404).json({ message: 'Преподаватель не найден' });
      }
      where.teacherId = teacher.id;
    }

    if (direction) {
      where.direction = direction;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

      const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              email: true
            }
          },
          enrollments: {
            where: {
              status: 'APPROVED'
            },
            select: {
              id: true
            }
          },
          _count: {
            select: {
              materials: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.course.count({ where })
    ]);

    res.json({
      courses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Ошибка получения курсов:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Получить курс по ID
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID курса
 *     responses:
 *       200:
 *         description: Информация о курсе
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Курс не найден
 *       401:
 *         description: Не авторизован
 */
// Получить конкретный курс
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            email: true
          }
        },
        materials: {
          orderBy: {
            order: 'asc'
          }
        },
        enrollments: {
          where: {
            status: 'APPROVED' // Только одобренные записи
          },
          include: {
            studentUser: {
              select: {
                id: true,
                username: true,
                email: true
              }
            },
            _count: {
              select: {
                messages: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            materials: true,
            enrollments: true
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

    // Проверка доступа: преподаватель может видеть только свои курсы
    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username }
      });
      if (!teacher || course.teacherId !== teacher.id) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    }

    res.json(course);
  } catch (error) {
    console.error('Ошибка получения курса:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Создать курс
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - direction
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Введение в программирование"
 *               description:
 *                 type: string
 *                 example: "Базовый курс по программированию"
 *               direction:
 *                 type: string
 *                 example: "Программирование"
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL изображения курса
 *     responses:
 *       201:
 *         description: Курс создан
 *       400:
 *         description: Ошибка валидации
 *       403:
 *         description: Доступ запрещен (только для преподавателей)
 *       404:
 *         description: Преподаватель не найден
 *       401:
 *         description: Не авторизован
 */
// Создать курс (только преподаватель)
router.post('/',
  authenticateToken,
  [
    body('title').trim().notEmpty().withMessage('Название курса обязательно'),
    body('description').optional().trim(),
    body('direction').trim().notEmpty().withMessage('Направление обязательно')
  ],
  async (req, res) => {
    try {
      const user = req.user;

      if (user.role !== 'teacher') {
        return res.status(403).json({ message: 'Только преподаватели могут создавать курсы' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username }
      });

      if (!teacher) {
        return res.status(404).json({ message: 'Преподаватель не найден' });
      }

      const { title, description, direction, imageUrl } = req.body;

      const course = await prisma.course.create({
        data: {
          title,
          description: description || null,
          direction,
          imageUrl: imageUrl || null,
          teacherId: teacher.id
        },
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              email: true
            }
          }
        }
      });

      res.status(201).json(course);
    } catch (error) {
      console.error('Ошибка создания курса:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}:
 *   put:
 *     summary: Обновить курс
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID курса
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               direction:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Курс обновлен
 *       400:
 *         description: Ошибка валидации
 *       403:
 *         description: Доступ запрещен (только для преподавателей, только свои курсы)
 *       404:
 *         description: Курс не найден
 *       401:
 *         description: Не авторизован
 */
// Обновить курс (только преподаватель, только свои курсы)
router.put('/:id',
  authenticateToken,
  [
    body('title').optional().trim().notEmpty().withMessage('Название курса не может быть пустым'),
    body('description').optional().trim(),
    body('direction').optional().trim().notEmpty().withMessage('Направление не может быть пустым')
  ],
  async (req, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'teacher') {
        return res.status(403).json({ message: 'Только преподаватели могут редактировать курсы' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username }
      });

      if (!teacher) {
        return res.status(404).json({ message: 'Преподаватель не найден' });
      }

      const existingCourse = await prisma.course.findUnique({
        where: { id }
      });

      if (!existingCourse) {
        return res.status(404).json({ message: 'Курс не найден' });
      }

      if (existingCourse.teacherId !== teacher.id) {
        return res.status(403).json({ message: 'Вы можете редактировать только свои курсы' });
      }

      const updateData = { ...req.body };
      delete updateData.teacherId; // Не позволяем менять преподавателя
      // Обрабатываем imageUrl, если он передан
      if (updateData.imageUrl === '') {
        updateData.imageUrl = null;
      }

      const course = await prisma.course.update({
        where: { id },
        data: updateData,
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              email: true
            }
          }
        }
      });

      res.json(course);
    } catch (error) {
      console.error('Ошибка обновления курса:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}:
 *   delete:
 *     summary: Удалить курс
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID курса
 *     responses:
 *       200:
 *         description: Курс удален
 *       403:
 *         description: Доступ запрещен (только для преподавателей и админов)
 *       404:
 *         description: Курс не найден
 *       401:
 *         description: Не авторизован
 */
// Удалить курс (только преподаватель, только свои курсы)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { username: user.username }
    });

    if (!teacher) {
      return res.status(404).json({ message: 'Преподаватель не найден' });
    }

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

    // Преподаватель может удалять только свои курсы, админ - любые
    if (user.role === 'teacher' && course.teacherId !== teacher.id) {
      return res.status(403).json({ message: 'Вы можете удалять только свои курсы' });
    }

    await prisma.course.delete({
      where: { id }
    });

    res.json({ message: 'Курс удален' });
  } catch (error) {
    console.error('Ошибка удаления курса:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;

