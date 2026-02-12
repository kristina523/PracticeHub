import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

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

    const webinars = await prisma.webinar.findMany({
      where,
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
        } : false
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // Для студентов добавляем информацию о регистрации
    const webinarsWithRegistration = webinars.map(webinar => ({
      ...webinar,
      isRegistered: user.role === 'student' && webinar.registrations && webinar.registrations.length > 0,
      registrationCount: webinar._count.registrations
    }));

    res.json({ webinars: webinarsWithRegistration });
  } catch (error) {
    console.error('Ошибка получения вебинаров:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

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

