import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { sendNotification } from '../bot/telegramBot.js';

// Функция для отправки уведомления (используется в routes)
async function sendTaskNotification(telegramId, message) {
  try {
    const { sendNotification: sendNotif } = await import('../bot/telegramBot.js');
    return await sendNotif(telegramId, message);
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
    return false;
  }
}

const router = express.Router();
const prisma = new PrismaClient();

// Получить все задания (для админа) или задания студента
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { studentId, status, page = 1, limit = 50 } = req.query;

    const where = {};

    // Если админ, может фильтровать по studentId
    if (user.role === 'admin' || user.role === 'teacher') {
      if (studentId) {
        where.studentId = studentId;
      }
    } else {
      // Для студента показываем только его задания
      const student = await prisma.student.findFirst({
        where: { userId: user.id }
      });
      if (!student) {
        return res.status(404).json({ message: 'Студент не найден' });
      }
      where.studentId = student.id;
    }

    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              email: true,
              telegramId: true
            }
          },
          assignedBy: {
            select: {
              id: true,
              username: true,
              telegramId: true
            }
          },
          submissions: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  middleName: true
                }
              }
            },
            orderBy: {
              submittedAt: 'desc'
            }
          },
          _count: {
            select: {
              submissions: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.task.count({ where })
    ]);

    res.json({
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Ошибка получения заданий:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Получить конкретное задание
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            email: true,
            telegramId: true
          }
        },
        assignedBy: {
          select: {
            id: true,
            username: true,
            telegramId: true
          }
        },
        submissions: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true
              }
            },
            reviewedBy: {
              select: {
                id: true,
                username: true
              }
            }
          },
          orderBy: {
            submittedAt: 'desc'
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ message: 'Задание не найдено' });
    }

    // Проверка доступа: студент может видеть только свои задания
    if (user.role !== 'admin' && user.role !== 'teacher') {
      const student = await prisma.student.findFirst({
        where: { userId: user.id }
      });
      if (!student || task.studentId !== student.id) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    }

    res.json(task);
  } catch (error) {
    console.error('Ошибка получения задания:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Создать задание (только админ/преподаватель)
router.post('/', authenticateToken, [
  body('title').notEmpty().withMessage('Название задания обязательно'),
  body('description').notEmpty().withMessage('Описание задания обязательно'),
  body('deadline').isISO8601().withMessage('Некорректная дата дедлайна'),
  body('studentId').optional().isString(),
  body('referenceLink').optional().custom((value) => {
    if (!value || value === '') return true;
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlRegex.test(value)) {
      throw new Error('Некорректная ссылка');
    }
    return true;
  })
], async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, deadline, studentId, referenceLink } = req.body;

    // Проверяем, что studentId указан
    if (!studentId) {
      return res.status(400).json({ message: 'Необходимо указать студента' });
    }

    // Проверяем, что студент существует
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            telegramId: true
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    // Находим админа/преподавателя в StudentUser по telegramId или создаем виртуального
    let assignedByUser = null;
    const adminTelegramId = user.telegramId || `admin_${user.id}`;
    
    // Проверяем, не существует ли уже такой telegramId
    assignedByUser = await prisma.studentUser.findUnique({
      where: { telegramId: adminTelegramId }
    });
    
    if (!assignedByUser) {
      try {
        assignedByUser = await prisma.studentUser.create({
          data: {
            telegramId: adminTelegramId,
            username: user.username || `Admin_${user.id}`,
            email: user.email || `admin_${user.id}@practicehub.local`
          }
        });
      } catch (createError) {
        // Если ошибка из-за дубликата, пытаемся найти существующего
        if (createError.code === 'P2002') {
          assignedByUser = await prisma.studentUser.findUnique({
            where: { telegramId: adminTelegramId }
          });
        } else {
          throw createError;
        }
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        deadline: new Date(deadline),
        referenceLink: referenceLink || null,
        assignedById: assignedByUser.telegramId,
        studentId: studentId || null
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                telegramId: true
              }
            }
          }
        }
      }
    });

    // Отправляем уведомление студенту через бота
    if (student.user && student.user.telegramId) {
      const deadlineFormatted = new Date(task.deadline).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      const message = `📋 *Новое задание!*\n\n` +
        `*${task.title}*\n\n` +
        `${task.description}\n\n` +
        `📅 *Дедлайн:* ${deadlineFormatted}\n` +
        (task.referenceLink ? `🔗 *Ссылка:* ${task.referenceLink}\n\n` : '\n') +
        `Используйте /tasks для просмотра всех заданий.`;

      try {
        const { sendNotification: sendNotif } = await import('../bot/telegramBot.js');
        await sendNotif(student.user.telegramId, message);
      } catch (error) {
        console.error('Ошибка отправки уведомления о задании:', error);
        // Не прерываем создание задания, если уведомление не отправилось
      }
    }

    res.status(201).json({ message: 'Задание создано', task });
  } catch (error) {
    console.error('Ошибка создания задания:', error);
    // Возвращаем более детальное сообщение об ошибке
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Ошибка: дубликат данных' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ message: 'Ошибка: некорректная связь с базой данных' });
    }
    res.status(500).json({ 
      message: 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Отправить решение задания (студент)
router.post('/:id/submit', authenticateToken, [
  body('solutionDescription').optional().isString(),
  body('solutionLink').optional().isURL().withMessage('Некорректная ссылка'),
  body('attachments').optional().isString()
], async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { solutionDescription, solutionLink, attachments } = req.body;

    // Находим студента
    const student = await prisma.student.findFirst({
      where: { userId: user.id }
    });

    if (!student) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    // Проверяем задание
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        student: true
      }
    });

    if (!task) {
      return res.status(404).json({ message: 'Задание не найдено' });
    }

    if (task.studentId !== student.id) {
      return res.status(403).json({ message: 'Это задание не назначено вам' });
    }

    // Проверяем, не отправлено ли уже решение
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: {
        taskId_studentId: {
          taskId: id,
          studentId: student.id
        }
      }
    });

    let submission;
    if (existingSubmission) {
      // Обновляем существующее решение
      submission = await prisma.taskSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          solutionDescription: solutionDescription || null,
          solutionLink: solutionLink || null,
          attachments: attachments || null,
          status: 'SUBMITTED',
          submittedAt: new Date()
        },
        include: {
          task: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true
            }
          }
        }
      });
    } else {
      // Создаем новое решение
      submission = await prisma.taskSubmission.create({
        data: {
          taskId: id,
          studentId: student.id,
          solutionDescription: solutionDescription || null,
          solutionLink: solutionLink || null,
          attachments: attachments || null,
          status: 'SUBMITTED'
        },
        include: {
          task: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true
            }
          }
        }
      });
    }

    // Обновляем статус задания
    await prisma.task.update({
      where: { id },
      data: {
        status: 'SUBMITTED'
      }
    });

    // Уведомляем админов о новом решении
    const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_CHAT_ID || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (ADMIN_CHAT_IDS.length > 0) {
      const studentName = `${student.lastName} ${student.firstName}${student.middleName ? ' ' + student.middleName : ''}`;
      const message = `📥 *Новое решение задания*\n\n` +
        `👤 *Студент:* ${studentName}\n` +
        `📋 *Задание:* ${task.title}\n` +
        `📅 *Отправлено:* ${new Date(submission.submittedAt).toLocaleString('ru-RU')}\n\n` +
        (submission.solutionLink ? `🔗 *Ссылка:* ${submission.solutionLink}\n` : '') +
        (submission.solutionDescription ? `📝 *Описание:* ${submission.solutionDescription.substring(0, 200)}${submission.solutionDescription.length > 200 ? '...' : ''}\n` : '') +
        `\nПроверьте решение на панели администратора.`;

      for (const adminChatId of ADMIN_CHAT_IDS) {
        try {
          const { sendNotification: sendNotif } = await import('../bot/telegramBot.js');
          await sendNotif(adminChatId, message);
        } catch (error) {
          console.error('Ошибка отправки уведомления админу:', error);
        }
      }
    }

    res.status(201).json({ message: 'Решение отправлено', submission });
  } catch (error) {
    console.error('Ошибка отправки решения:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Получить все решения задания (админ)
router.get('/:id/submissions', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const task = await prisma.task.findUnique({
      where: { id }
    });

    if (!task) {
      return res.status(404).json({ message: 'Задание не найдено' });
    }

    const submissions = await prisma.taskSubmission.findMany({
      where: { taskId: id },
      include: {
        student: {
          include: {
            user: {
              select: {
                telegramId: true
              }
            }
          }
        },
        reviewedBy: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    res.json({ submissions });
  } catch (error) {
    console.error('Ошибка получения решений:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// Проверить решение (админ)
router.patch('/:id/submissions/:submissionId/review', authenticateToken, [
  body('status').isIn(['UNDER_REVIEW', 'COMPLETED', 'REJECTED']).withMessage('Некорректный статус'),
  body('reviewComment').optional().isString(),
  body('grade').optional().isInt({ min: 1, max: 10 }).withMessage('Оценка должна быть от 1 до 10')
], async (req, res) => {
  try {
    const user = req.user;
    const { id, submissionId } = req.params;
    const { status, reviewComment, grade } = req.body;

    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Проверяем, что решение существует
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: { id: submissionId },
      include: {
        task: true
      }
    });

    if (!existingSubmission) {
      return res.status(404).json({ message: 'Решение не найдено' });
    }

    if (existingSubmission.taskId !== id) {
      return res.status(400).json({ message: 'Решение не принадлежит этому заданию' });
    }

    // Находим или создаем админа в StudentUser
    let reviewedByUser = null;
    const adminTelegramId = user.telegramId || `admin_${user.id}_${user.username || 'web'}`;
    
    try {
      reviewedByUser = await prisma.studentUser.findUnique({
        where: { telegramId: adminTelegramId }
      });

      if (!reviewedByUser) {
        reviewedByUser = await prisma.studentUser.create({
          data: {
            telegramId: adminTelegramId,
            username: user.username || `Admin_${user.id}`,
            email: user.email || `admin_${user.id}@practicehub.local`
          }
        });
      }
    } catch (error) {
      console.error('Ошибка создания/поиска reviewedByUser:', error);
      // Если не удалось создать/найти, продолжаем без reviewedById
    }

    const submission = await prisma.taskSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        reviewComment: reviewComment || null,
        grade: grade ? parseInt(grade) : null,
        reviewedById: reviewedByUser ? reviewedByUser.telegramId : null,
        reviewedAt: new Date()
      },
      include: {
        task: true,
        student: {
          include: {
            user: {
              select: {
                telegramId: true
              }
            }
          }
        }
      }
    });

    // Обновляем статус задания
    if (status === 'COMPLETED') {
      await prisma.task.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
    }

    // Уведомляем студента о проверке
    if (submission.student.user && submission.student.user.telegramId) {
      const statusMessages = {
        'UNDER_REVIEW': '⏳ Ваше решение проверяется',
        'COMPLETED': '✅ Ваше решение принято!',
        'REJECTED': '❌ Ваше решение отклонено'
      };

      let message = `📋 *Результат проверки задания*\n\n` +
        `*${submission.task.title}*\n\n` +
        `📊 *Статус:* ${statusMessages[status] || status}\n`;

      if (grade) {
        message += `⭐ *Оценка:* ${grade}/10\n`;
      }

      if (reviewComment) {
        message += `\n📝 *Комментарий:*\n${reviewComment}`;
      }

      try {
        const { sendNotification: sendNotif } = await import('../bot/telegramBot.js');
        await sendNotif(submission.student.user.telegramId, message);
      } catch (error) {
        console.error('Ошибка отправки уведомления студенту:', error);
      }
    }

    res.json({ message: 'Решение проверено', submission });
  } catch (error) {
    console.error('Ошибка проверки решения:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    
    // Более детальное сообщение об ошибке для отладки
    const errorMessage = error.code === 'P2002' 
      ? 'Ошибка: дублирование данных'
      : error.code === 'P2025'
      ? 'Решение не найдено'
      : error.message || 'Внутренняя ошибка сервера';
    
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Удалить задание (админ)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const { id } = req.params;

    await prisma.task.delete({
      where: { id }
    });

    res.json({ message: 'Задание удалено' });
  } catch (error) {
    console.error('Ошибка удаления задания:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;

