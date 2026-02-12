import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Получить все сообщения чата для конкретной записи на курс
router.get('/enrollment/:enrollmentId', authenticateToken, async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const user = req.user;

    // Проверяем, что enrollment существует
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: {
          include: {
            teacher: true
          }
        },
        studentUser: true
      }
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Запись на курс не найдена' });
    }

    // Проверка прав доступа
    if (user.role === 'student') {
      // Студент может видеть только свои чаты
      if (enrollment.studentUserId !== user.id) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    } else if (user.role === 'teacher') {
      // Преподаватель может видеть чаты только по своим курсам
      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username }
      });
      if (!teacher || enrollment.course.teacherId !== teacher.id) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    } else if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const messages = await prisma.courseChatMessage.findMany({
      where: { enrollmentId },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ messages, enrollment });
  } catch (error) {
    console.error('Ошибка получения сообщений чата:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Отправить сообщение в чат
router.post('/enrollment/:enrollmentId', 
  authenticateToken,
  [
    body('message').trim().notEmpty().withMessage('Сообщение не может быть пустым')
  ],
  async (req, res) => {
    try {
      const { enrollmentId } = req.params;
      const { message } = req.body;
      const user = req.user;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Проверяем, что enrollment существует
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          course: {
            include: {
              teacher: true
            }
          },
          studentUser: true
        }
      });

      if (!enrollment) {
        return res.status(404).json({ message: 'Запись на курс не найдена' });
      }

      // Определяем тип отправителя и проверяем права
      let senderType = null;
      let senderId = null;

      if (user.role === 'student') {
        if (enrollment.studentUserId !== user.id) {
          return res.status(403).json({ message: 'Доступ запрещен' });
        }
        senderType = 'STUDENT';
        senderId = user.id;
      } else if (user.role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({
          where: { username: user.username }
        });
        if (!teacher || enrollment.course.teacherId !== teacher.id) {
          return res.status(403).json({ message: 'Доступ запрещен' });
        }
        senderType = 'TEACHER';
        senderId = teacher.id;
      } else if (user.role === 'admin') {
        // Админ может писать от имени преподавателя
        senderType = 'TEACHER';
        senderId = enrollment.course.teacherId;
      } else {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }

      // Проверяем, что запись на курс одобрена (только для студентов)
      if (user.role === 'student' && enrollment.status !== 'APPROVED') {
        return res.status(400).json({ message: 'Вы не можете писать в чат, пока ваша заявка не одобрена' });
      }

      const chatMessage = await prisma.courseChatMessage.create({
        data: {
          enrollmentId,
          senderId,
          senderType,
          message: message.trim()
        },
        include: {
          enrollment: {
            include: {
              course: {
                select: {
                  title: true,
                  teacher: {
                    select: {
                      firstName: true,
                      lastName: true,
                      username: true
                    }
                  }
                }
              },
              studentUser: {
                select: {
                  username: true,
                  email: true
                }
              }
            }
          }
        }
      });

      res.status(201).json({ message: 'Сообщение отправлено', chatMessage });
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

// Получить все чаты для студента (по всем его записям на курсы)
router.get('/student', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const enrollments = await prisma.courseEnrollment.findMany({
      where: {
        studentUserId: user.id,
        status: 'APPROVED' // Только одобренные курсы
      },
      include: {
        course: {
          include: {
            teacher: {
              select: {
                firstName: true,
                lastName: true,
                username: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Последнее сообщение
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ enrollments });
  } catch (error) {
    console.error('Ошибка получения чатов студента:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Получить все чаты для преподавателя (по всем записям на его курсы)
router.get('/teacher', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { username: user.username }
    });

    if (!teacher) {
      return res.status(404).json({ message: 'Преподаватель не найден' });
    }

    const enrollments = await prisma.courseEnrollment.findMany({
      where: {
        course: {
          teacherId: teacher.id
        },
        status: 'APPROVED' // Только одобренные записи
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            direction: true
          }
        },
        studentUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Последнее сообщение
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ enrollments });
  } catch (error) {
    console.error('Ошибка получения чатов преподавателя:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Отметить сообщения как прочитанные
router.patch('/enrollment/:enrollmentId/read', authenticateToken, async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const user = req.user;

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId }
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Запись на курс не найдена' });
    }

    // Проверка прав доступа
    if (user.role === 'student' && enrollment.studentUserId !== user.id) {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    // Определяем, какие сообщения нужно отметить как прочитанные
    // (те, которые отправлены не текущим пользователем)
    const senderType = user.role === 'student' ? 'TEACHER' : 'STUDENT';

    await prisma.courseChatMessage.updateMany({
      where: {
        enrollmentId,
        senderType,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    res.json({ message: 'Сообщения отмечены как прочитанные' });
  } catch (error) {
    console.error('Ошибка отметки сообщений как прочитанных:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;

