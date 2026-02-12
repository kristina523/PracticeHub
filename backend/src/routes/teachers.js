import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Получить всех преподавателей (только для админа)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const { search } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const teachers = await prisma.teacher.findMany({
      where,
      include: {
        _count: {
          select: {
            courses: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ teachers });
  } catch (error) {
    console.error('Ошибка получения преподавателей:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;





