import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/webinars:
 *   get:
 *     summary: Получить список вебинаров
 *     tags: [Webinars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Только предстоящие вебинары
 *       - in: query
 *         name: past
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Только прошедшие вебинары
 *     responses:
 *       200:
 *         description: Список вебинаров
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webinars:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Не авторизован
 */
// Получить все вебинары
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { upcoming, past } = req.query;
    const now = new Date();

    let where = {};

    if (upcoming === 'true') {
      where.startTime = { gte: now };
    } else if (past === 'true') {
      where.startTime = { lt: now };
    }

    // Формируем include в зависимости от роли пользователя
    const includeOptions = {
      _count: {
        select: {
          registrations: true
        }
      }
    };
    
    // Для студентов включаем только их регистрации
    if (user.role === 'student') {
      includeOptions.registrations = {
        where: {
          studentUserId: user.id
        }
      };
    }
    
    const webinars = await prisma.webinar.findMany({
      where,
      include: includeOptions,
      orderBy: {
        startTime: 'asc'
      }
    });

    // Для студентов добавляем информацию о регистрации
    const webinarsWithRegistration = webinars.map(webinar => {
      // Для студентов проверяем наличие регистрации
      let isRegistered = false;
      if (user.role === 'student') {
        // registrations - это массив регистраций текущего студента
        isRegistered = Array.isArray(webinar.registrations) && webinar.registrations.length > 0;
        
        // Логирование для отладки
        console.log(`Вебинар "${webinar.title}" (ID: ${webinar.id}): isRegistered=${isRegistered}, registrations.length=${webinar.registrations?.length || 0}, userId=${user.id}`);
      }
      
      return {
        ...webinar,
        isRegistered,
        registrationCount: webinar._count.registrations,
        // Убираем registrations из ответа, чтобы не отправлять лишние данные
        registrations: undefined
      };
    });

    res.json({ webinars: webinarsWithRegistration });
  } catch (error) {
    console.error('Ошибка получения вебинаров:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/webinars/{id}:
 *   get:
 *     summary: Получить вебинар по ID
 *     tags: [Webinars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID вебинара
 *     responses:
 *       200:
 *         description: Информация о вебинаре
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webinar:
 *                   type: object
 *       404:
 *         description: Вебинар не найден
 *       401:
 *         description: Не авторизован
 */
// Получить конкретный вебинар
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const webinar = await prisma.webinar.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            registrations: true
          }
        },
        registrations: user.role === 'student' ? {
          where: {
            studentUserId: user.id
          }
        } : {
          include: {
            studentUser: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!webinar) {
      return res.status(404).json({ message: 'Вебинар не найден' });
    }

    const webinarWithRegistration = {
      ...webinar,
      isRegistered: user.role === 'student' && webinar.registrations && webinar.registrations.length > 0,
      registrationCount: webinar._count.registrations
    };

    res.json({ webinar: webinarWithRegistration });
  } catch (error) {
    console.error('Ошибка получения вебинара:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/webinars:
 *   post:
 *     summary: Создать вебинар
 *     tags: [Webinars]
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
 *               - link
 *               - startTime
 *               - endTime
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Введение в веб-разработку"
 *               description:
 *                 type: string
 *               link:
 *                 type: string
 *                 format: uri
 *                 example: "https://zoom.us/j/123456789"
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               maxParticipants:
 *                 type: integer
 *                 description: Максимальное количество участников
 *     responses:
 *       201:
 *         description: Вебинар создан
 *       400:
 *         description: Ошибка валидации
 *       403:
 *         description: Доступ запрещен (только для админов)
 *       401:
 *         description: Не авторизован
 */
// Создать вебинар (только админ)
router.post(
  '/',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Название обязательно'),
    body('link').notEmpty().withMessage('Ссылка обязательна'),
    body('startTime').isISO8601().withMessage('Некорректная дата начала'),
    body('endTime').isISO8601().withMessage('Некорректная дата окончания')
  ],
  async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, link, startTime, endTime, maxParticipants } = req.body;

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        return res.status(400).json({ message: 'Дата окончания должна быть позже даты начала' });
      }

      const webinar = await prisma.webinar.create({
        data: {
          title,
          description: description || null,
          link,
          startTime: start,
          endTime: end,
          maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
          createdById: req.user.id
        }
      });

      res.status(201).json({ webinar });
    } catch (error) {
      console.error('Ошибка создания вебинара:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

/**
 * @swagger
 * /api/webinars/{id}:
 *   patch:
 *     summary: Обновить вебинар
 *     tags: [Webinars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID вебинара
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
 *               link:
 *                 type: string
 *                 format: uri
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               maxParticipants:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Вебинар обновлен
 *       400:
 *         description: Ошибка валидации
 *       403:
 *         description: Доступ запрещен (только для админов)
 *       404:
 *         description: Вебинар не найден
 *       401:
 *         description: Не авторизован
 */
// Обновить вебинар (только админ)
router.patch(
  '/:id',
  authenticateToken,
  [
    body('startTime').optional().isISO8601().withMessage('Некорректная дата начала'),
    body('endTime').optional().isISO8601().withMessage('Некорректная дата окончания')
  ],
  async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }

      const { id } = req.params;
      const { title, description, link, startTime, endTime, maxParticipants } = req.body;

      const webinar = await prisma.webinar.findUnique({
        where: { id }
      });

      if (!webinar) {
        return res.status(404).json({ message: 'Вебинар не найден' });
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (link !== undefined) updateData.link = link;
      if (startTime !== undefined) updateData.startTime = new Date(startTime);
      if (endTime !== undefined) updateData.endTime = new Date(endTime);
      if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants ? parseInt(maxParticipants) : null;

      if (updateData.endTime && updateData.startTime && updateData.endTime <= updateData.startTime) {
        return res.status(400).json({ message: 'Дата окончания должна быть позже даты начала' });
      }

      const updatedWebinar = await prisma.webinar.update({
        where: { id },
        data: updateData
      });

      res.json({ webinar: updatedWebinar });
    } catch (error) {
      console.error('Ошибка обновления вебинара:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

/**
 * @swagger
 * /api/webinars/{id}:
 *   delete:
 *     summary: Удалить вебинар
 *     tags: [Webinars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID вебинара
 *     responses:
 *       200:
 *         description: Вебинар удален
 *       403:
 *         description: Доступ запрещен (только для админов)
 *       404:
 *         description: Вебинар не найден
 *       401:
 *         description: Не авторизован
 */
// Удалить вебинар (только админ)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const { id } = req.params;

    const webinar = await prisma.webinar.findUnique({
      where: { id }
    });

    if (!webinar) {
      return res.status(404).json({ message: 'Вебинар не найден' });
    }

    await prisma.webinar.delete({
      where: { id }
    });

    res.json({ message: 'Вебинар удален' });
  } catch (error) {
    console.error('Ошибка удаления вебинара:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/webinars/{id}/register:
 *   post:
 *     summary: Зарегистрироваться на вебинар
 *     tags: [Webinars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID вебинара
 *     responses:
 *       201:
 *         description: Регистрация успешна
 *       400:
 *         description: Вебинар прошел, достигнут лимит участников или уже зарегистрирован
 *       403:
 *         description: Доступ запрещен (только для студентов)
 *       404:
 *         description: Вебинар не найден
 *       401:
 *         description: Не авторизован
 */
// Зарегистрироваться на вебинар (студент)
router.post('/:id/register', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Только студенты могут регистрироваться на вебинары' });
    }

    const { id } = req.params;
    const user = req.user;

    const webinar = await prisma.webinar.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            registrations: true
          }
        }
      }
    });

    if (!webinar) {
      return res.status(404).json({ message: 'Вебинар не найден' });
    }

    // Проверяем, не прошел ли вебинар
    if (new Date(webinar.startTime) < new Date()) {
      return res.status(400).json({ message: 'Нельзя зарегистрироваться на прошедший вебинар' });
    }

    // Проверяем лимит участников
    if (webinar.maxParticipants && webinar._count.registrations >= webinar.maxParticipants) {
      return res.status(400).json({ message: 'Достигнут лимит участников' });
    }

    // Проверяем, не зарегистрирован ли уже
    const existingRegistration = await prisma.webinarRegistration.findUnique({
      where: {
        webinarId_studentUserId: {
          webinarId: id,
          studentUserId: user.id
        }
      }
    });

    if (existingRegistration) {
      return res.status(400).json({ message: 'Вы уже зарегистрированы на этот вебинар' });
    }

    const registration = await prisma.webinarRegistration.create({
      data: {
        webinarId: id,
        studentUserId: user.id
      },
      include: {
        webinar: {
          select: {
            title: true,
            startTime: true
          }
        }
      }
    });

    res.status(201).json({ registration, message: 'Вы успешно зарегистрированы на вебинар' });
  } catch (error) {
    console.error('Ошибка регистрации на вебинар:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Вы уже зарегистрированы на этот вебинар' });
    }
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/webinars/{id}/register:
 *   delete:
 *     summary: Отменить регистрацию на вебинар
 *     tags: [Webinars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID вебинара
 *     responses:
 *       200:
 *         description: Регистрация отменена
 *       403:
 *         description: Доступ запрещен (только для студентов)
 *       404:
 *         description: Регистрация не найдена
 *       401:
 *         description: Не авторизован
 */
// Отменить регистрацию на вебинар (студент)
router.delete('/:id/register', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Только студенты могут отменять регистрацию' });
    }

    const { id } = req.params;
    const user = req.user;

    const registration = await prisma.webinarRegistration.findUnique({
      where: {
        webinarId_studentUserId: {
          webinarId: id,
          studentUserId: user.id
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ message: 'Регистрация не найдена' });
    }

    await prisma.webinarRegistration.delete({
      where: {
        webinarId_studentUserId: {
          webinarId: id,
          studentUserId: user.id
        }
      }
    });

    res.json({ message: 'Регистрация отменена' });
  } catch (error) {
    console.error('Ошибка отмены регистрации:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;

