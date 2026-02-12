import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Получить все материалы курса
router.get('/course/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = req.user;

    // Проверяем доступ к курсу
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: true
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

    // Преподаватель может видеть только материалы своих курсов
    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username }
      });
      if (!teacher || course.teacherId !== teacher.id) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    }

    const materials = await prisma.courseMaterial.findMany({
      where: { courseId },
      orderBy: {
        order: 'asc'
      }
    });

    res.json({ materials });
  } catch (error) {
    console.error('Ошибка получения материалов:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Получить конкретный материал
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const material = await prisma.courseMaterial.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            teacher: true
          }
        }
      }
    });

    if (!material) {
      return res.status(404).json({ message: 'Материал не найден' });
    }

    // Проверка доступа
    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username }
      });
      if (!teacher || material.course.teacherId !== teacher.id) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    }

    res.json(material);
  } catch (error) {
    console.error('Ошибка получения материала:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Создать материал (только преподаватель)
router.post('/',
  authenticateToken,
  [
    body('title').trim().notEmpty().withMessage('Название материала обязательно'),
    body('courseId').notEmpty().withMessage('ID курса обязателен'),
    body('materialType').optional().isIn(['TEXT', 'VIDEO', 'PDF', 'LINK', 'FILE']).withMessage('Неверный тип материала'),
    body('order').optional().isInt().withMessage('Порядок должен быть числом')
  ],
  async (req, res) => {
    try {
      const user = req.user;

      if (user.role !== 'teacher') {
        return res.status(403).json({ message: 'Только преподаватели могут создавать материалы' });
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

      const { title, description, content, fileUrl, materialType, order, courseId } = req.body;

      // Проверяем, что курс принадлежит преподавателю
      const course = await prisma.course.findUnique({
        where: { id: courseId }
      });

      if (!course) {
        return res.status(404).json({ message: 'Курс не найден' });
      }

      if (course.teacherId !== teacher.id) {
        return res.status(403).json({ message: 'Вы можете добавлять материалы только к своим курсам' });
      }

      // Определяем порядок, если не указан
      const maxOrder = await prisma.courseMaterial.findFirst({
        where: { courseId },
        orderBy: { order: 'desc' }
      });

      const material = await prisma.courseMaterial.create({
        data: {
          title,
          description: description || null,
          content: content || null,
          fileUrl: fileUrl || null,
          materialType: materialType || 'TEXT',
          order: order !== undefined ? parseInt(order) : (maxOrder ? maxOrder.order + 1 : 0),
          courseId
        }
      });

      res.status(201).json(material);
    } catch (error) {
      console.error('Ошибка создания материала:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

// Обновить материал
router.put('/:id',
  authenticateToken,
  [
    body('title').optional().trim().notEmpty().withMessage('Название материала не может быть пустым'),
    body('materialType').optional().isIn(['TEXT', 'VIDEO', 'PDF', 'LINK', 'FILE']).withMessage('Неверный тип материала'),
    body('order').optional().isInt().withMessage('Порядок должен быть числом')
  ],
  async (req, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      if (user.role !== 'teacher') {
        return res.status(403).json({ message: 'Только преподаватели могут редактировать материалы' });
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

      const existingMaterial = await prisma.courseMaterial.findUnique({
        where: { id },
        include: {
          course: true
        }
      });

      if (!existingMaterial) {
        return res.status(404).json({ message: 'Материал не найден' });
      }

      if (existingMaterial.course.teacherId !== teacher.id) {
        return res.status(403).json({ message: 'Вы можете редактировать только материалы своих курсов' });
      }

      const updateData = { ...req.body };
      if (updateData.order !== undefined) {
        updateData.order = parseInt(updateData.order);
      }

      const material = await prisma.courseMaterial.update({
        where: { id },
        data: updateData
      });

      res.json(material);
    } catch (error) {
      console.error('Ошибка обновления материала:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

// Удалить материал
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { username: user.username }
    });

    if (!teacher) {
      return res.status(404).json({ message: 'Преподаватель не найден' });
    }

    const material = await prisma.courseMaterial.findUnique({
      where: { id },
      include: {
        course: true
      }
    });

    if (!material) {
      return res.status(404).json({ message: 'Материал не найден' });
    }

    if (material.course.teacherId !== teacher.id) {
      return res.status(403).json({ message: 'Вы можете удалять только материалы своих курсов' });
    }

    await prisma.courseMaterial.delete({
      where: { id }
    });

    res.json({ message: 'Материал удален' });
  } catch (error) {
    console.error('Ошибка удаления материала:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;

