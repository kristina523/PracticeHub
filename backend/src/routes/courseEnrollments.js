import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Получить все курсы с информацией о статусе записи для текущего студента
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Доступ разрешен только студентам' });
    }

    const studentUser = await prisma.studentUser.findUnique({
      where: { id: user.id },
    });

    if (!studentUser) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    const courses = await prisma.course.findMany({
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        enrollments: {
          where: { studentUserId: studentUser.id },
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const result = courses.map((course) => {
      const enrollment = course.enrollments[0] || null;
      const { enrollments, ...rest } = course;
      return {
        ...rest,
        enrollment: enrollment ? {
          ...enrollment,
          course: {
            id: course.id,
            title: course.title
          }
        } : null,
      };
    });

    res.json({ courses: result });
  } catch (error) {
    console.error('Ошибка получения курсов для студента:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Подать заявку на курс (или повторно, если был REJECTED)
router.post(
  '/:courseId',
  authenticateToken,
  [body('message').optional().isString().isLength({ max: 1000 }).withMessage('Сообщение слишком длинное')],
  async (req, res) => {
    try {
      const user = req.user;

      if (user.role !== 'student') {
        return res.status(403).json({ message: 'Доступ разрешен только студентам' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { courseId } = req.params;

      const studentUser = await prisma.studentUser.findUnique({
        where: { id: user.id },
      });

      if (!studentUser) {
        return res.status(404).json({ message: 'Студент не найден' });
      }

      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          teacher: true,
        },
      });

      if (!course) {
        return res.status(404).json({ message: 'Курс не найден' });
      }

      const existingEnrollment = await prisma.courseEnrollment.findUnique({
        where: {
          courseId_studentUserId: {
            courseId,
            studentUserId: studentUser.id,
          },
        },
      });

      let enrollment;

      if (!existingEnrollment) {
        enrollment = await prisma.courseEnrollment.create({
          data: {
            courseId,
            studentUserId: studentUser.id,
            status: 'PENDING',
          },
        });
      } else if (existingEnrollment.status === 'REJECTED') {
        enrollment = await prisma.courseEnrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: 'PENDING',
          },
        });
      } else {
        return res.status(400).json({ message: 'Заявка уже подана или одобрена' });
      }

      res.status(201).json({ message: 'Заявка на курс отправлена', enrollment });
    } catch (error) {
      console.error('Ошибка подачи заявки на курс:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  },
);

// Преподаватель: получить заявки на свои курсы
router.get('/teacher/pending', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ разрешен только преподавателям' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { username: user.username },
    });

    if (!teacher) {
      return res.status(404).json({ message: 'Преподаватель не найден' });
    }

    const enrollments = await prisma.courseEnrollment.findMany({
      where: {
        status: 'PENDING',
        course: {
          teacherId: teacher.id,
        },
      },
      include: {
        course: true,
        studentUser: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(enrollments);
  } catch (error) {
    console.error('Ошибка получения заявок на курсы:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Преподаватель: одобрить или отклонить заявку
router.patch(
  '/:enrollmentId',
  authenticateToken,
  [body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Некорректный статус')],
  async (req, res) => {
    try {
      const user = req.user;

      if (user.role !== 'teacher') {
        return res.status(403).json({ message: 'Доступ разрешен только преподавателям' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { enrollmentId } = req.params;
      const { status } = req.body;

      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username },
      });

      if (!teacher) {
        return res.status(404).json({ message: 'Преподаватель не найден' });
      }

      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          course: true,
          studentUser: true,
        },
      });

      if (!enrollment) {
        return res.status(404).json({ message: 'Заявка не найдена' });
      }

      if (enrollment.course.teacherId !== teacher.id) {
        return res.status(403).json({ message: 'Вы не являетесь владельцем курса' });
      }

      const updated = await prisma.courseEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status,
        },
      });

      res.json({ message: 'Статус заявки обновлен', enrollment: updated });
    } catch (error) {
      console.error('Ошибка обновления статуса заявки:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  },
);

export default router;


