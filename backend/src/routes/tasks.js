import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { sendNotification } from '../bot/telegramBot.js';
import bcrypt from 'bcryptjs';

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

    // Если админ или преподаватель, может фильтровать по studentId или courseId
    if (user.role === 'admin' || user.role === 'teacher') {
      if (studentId) {
        where.studentId = studentId;
      }
      if (req.query.courseId) {
        where.courseId = req.query.courseId;
      }
      
      // Для преподавателя показываем только его задания (созданные им или для его курсов)
      if (user.role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({
          where: { username: user.username }
        });
        
        if (teacher) {
          // Получаем курсы преподавателя
          const teacherCourses = await prisma.course.findMany({
            where: { teacherId: teacher.id },
            select: { id: true }
          });
          const courseIds = teacherCourses.map(c => c.id);
          
          // Находим assignedByUser для преподавателя
          let assignedByUser = null;
          if (user.username) {
            assignedByUser = await prisma.studentUser.findUnique({
              where: { username: user.username }
            });
          }
          if (!assignedByUser && user.email) {
            assignedByUser = await prisma.studentUser.findUnique({
              where: { email: user.email }
            });
          }
          
          // Фильтруем: задания созданные преподавателем ИЛИ задания для его курсов
          const teacherWhere = [];
          
          if (assignedByUser) {
            teacherWhere.push({ assignedById: assignedByUser.id });
          }
          
          if (courseIds.length > 0) {
            teacherWhere.push({ courseId: { in: courseIds } });
          }
          
          // Если есть условия для преподавателя, применяем их
          if (teacherWhere.length > 0) {
            // Сохраняем существующие фильтры
            const existingFilters = {};
            if (where.studentId) {
              existingFilters.studentId = where.studentId;
              delete where.studentId;
            }
            if (where.courseId) {
              existingFilters.courseId = where.courseId;
              delete where.courseId;
            }
            
            // Строим финальный запрос
            if (Object.keys(existingFilters).length > 0) {
              // Если есть дополнительные фильтры, используем AND
              where.AND = [
                { OR: teacherWhere },
                ...Object.entries(existingFilters).map(([key, value]) => ({ [key]: value }))
              ];
            } else {
              // Если нет дополнительных фильтров, просто OR
              where.OR = teacherWhere;
            }
          } else {
            // Если нет ни assignedByUser, ни курсов, возвращаем пустой список
            return res.json({
              tasks: [],
              pagination: {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50,
                total: 0,
                pages: 0
              }
            });
          }
        } else {
          // Если преподаватель не найден, возвращаем пустой список
          return res.json({
            tasks: [],
            pagination: {
              page: parseInt(req.query.page) || 1,
              limit: parseInt(req.query.limit) || 50,
              total: 0,
              pages: 0
            }
          });
        }
      }
    } else {
      // Для студента показываем задания по его курсам или личные задания
      const student = await prisma.student.findFirst({
        where: { userId: user.id }
      });
      
      console.log('👤 Студент найден:', student ? student.id : 'не найден');
      
      // Получаем все одобренные записи студента на курсы
      const enrollments = await prisma.courseEnrollment.findMany({
        where: {
          studentUserId: user.id,
          status: 'APPROVED'
        },
        select: { courseId: true }
      });
      
      const courseIds = enrollments.map(e => e.courseId);
      console.log('📚 Курсы студента:', courseIds.length, courseIds);
      
      // Задания либо личные (studentId), либо по курсам студента
      where.OR = [];
      
      if (student) {
        where.OR.push({ studentId: student.id });
        console.log('✅ Добавлен фильтр по studentId:', student.id);
      }
      
      if (courseIds.length > 0) {
        where.OR.push({ courseId: { in: courseIds } });
        console.log('✅ Добавлен фильтр по courseId:', courseIds);
      }
      
      // Если нет ни студента, ни курсов, возвращаем пустой список
      if (where.OR.length === 0) {
        console.log('⚠️ Нет условий для фильтрации заданий студента');
        return res.json({
          tasks: [],
          pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            total: 0,
            pages: 0
          }
        });
      }
      
      console.log('🔍 Условия поиска заданий:', JSON.stringify(where, null, 2));
    }

    // Для студентов фильтр "completed" означает статус submission, а не task
    if (status && user.role === 'student') {
      if (status === 'COMPLETED') {
        // Для завершенных заданий фильтруем по статусу submission
        const student = await prisma.student.findFirst({
          where: { userId: user.id }
        });
        
        if (student) {
          where.submissions = {
            some: {
              studentId: student.id,
              status: 'COMPLETED'
            }
          };
        } else {
          // Если студент не найден, возвращаем пустой список
          return res.json({
            tasks: [],
            pagination: {
              page: parseInt(req.query.page) || 1,
              limit: parseInt(req.query.limit) || 50,
              total: 0,
              pages: 0
            }
          });
        }
      } else if (status === 'SUBMITTED') {
        // Для отправленных заданий фильтруем по статусу submission
        const student = await prisma.student.findFirst({
          where: { userId: user.id }
        });
        
        if (student) {
          where.submissions = {
            some: {
              studentId: student.id,
              status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
            }
          };
        } else {
          return res.json({
            tasks: [],
            pagination: {
              page: parseInt(req.query.page) || 1,
              limit: parseInt(req.query.limit) || 50,
              total: 0,
              pages: 0
            }
          });
        }
      } else {
        // Для других статусов используем обычную фильтрацию
        where.status = status;
      }
      console.log('📌 Фильтр по статусу для студента:', status);
    } else if (status) {
      where.status = status;
      console.log('📌 Фильтр по статусу:', status);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    console.log('🔍 Финальные условия запроса:', JSON.stringify(where, null, 2));

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          course: {
            select: {
              id: true,
              title: true,
              direction: true
            }
          },
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

    console.log(`📋 Найдено заданий: ${total} (показано: ${tasks.length})`);

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

    // Проверка доступа: студент может видеть только свои задания или задания по своим курсам
    if (user.role !== 'admin' && user.role !== 'teacher') {
      const student = await prisma.student.findFirst({
        where: { userId: user.id }
      });
      
      // Проверяем, является ли это личным заданием студента
      const isPersonalTask = student && task.studentId === student.id;
      
      // Проверяем, является ли это заданием по курсу, на который записан студент
      let isCourseTask = false;
      if (task.courseId) {
        const enrollment = await prisma.courseEnrollment.findFirst({
          where: {
            courseId: task.courseId,
            studentUserId: user.id,
            status: 'APPROVED'
          }
        });
        isCourseTask = !!enrollment;
      }
      
      if (!isPersonalTask && !isCourseTask) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    }
    
    // Добавляем информацию о курсе, если задание связано с курсом
    if (task.courseId) {
      const course = await prisma.course.findUnique({
        where: { id: task.courseId },
        select: {
          id: true,
          title: true,
          direction: true
        }
      });
      task.course = course;
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

    const { title, description, deadline, studentId, courseId, referenceLink, allowLateSubmission } = req.body;
    
    // Явно обрабатываем значение: если не передано, по умолчанию true, иначе используем переданное значение
    const allowLateSubmissionValue = allowLateSubmission !== undefined ? allowLateSubmission : true;

    // Проверяем, что указан либо studentId, либо courseId
    if (!studentId && !courseId) {
      return res.status(400).json({ message: 'Необходимо указать студента или курс' });
    }

    // Если указан courseId, проверяем права преподавателя на этот курс
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: { teacher: true }
      });

      if (!course) {
        return res.status(404).json({ message: 'Курс не найден' });
      }

      if (user.role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({
          where: { username: user.username }
        });
        if (!teacher || course.teacherId !== teacher.id) {
          return res.status(403).json({ message: 'Вы не можете создавать задания для этого курса' });
        }
      }
    }

    // Если указан studentId, проверяем, что студент существует
    let student = null;
    if (studentId) {
      student = await prisma.student.findUnique({
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
    }

    // Находим админа/преподавателя в StudentUser по username или email, или создаем виртуального
    let assignedByUser = null;
    
    // Ищем существующего пользователя по username или email
    if (user.username) {
      assignedByUser = await prisma.studentUser.findUnique({
        where: { username: user.username }
      });
    }
    
    if (!assignedByUser && user.email) {
      assignedByUser = await prisma.studentUser.findUnique({
        where: { email: user.email }
      });
    }
    
    // Если не найден, создаем виртуального пользователя для преподавателя/админа
    if (!assignedByUser) {
      try {
        // Генерируем случайный пароль (не используется, но обязателен в схеме)
        const randomPassword = await bcrypt.hash(`temp_${user.id}_${Date.now()}`, 10);
        
        assignedByUser = await prisma.studentUser.create({
          data: {
            username: user.username || `teacher_${user.id}`,
            email: user.email || `teacher_${user.id}@practicehub.local`,
            password: randomPassword,
            telegramId: user.telegramId || null
          }
        });
      } catch (createError) {
        // Если ошибка из-за дубликата, пытаемся найти существующего
        if (createError.code === 'P2002') {
          if (user.username) {
            assignedByUser = await prisma.studentUser.findUnique({
              where: { username: user.username }
            });
          }
          if (!assignedByUser && user.email) {
            assignedByUser = await prisma.studentUser.findUnique({
              where: { email: user.email }
            });
          }
        }
        
        // Если все еще не найден, создаем с уникальным username/email
        if (!assignedByUser) {
          const uniqueUsername = `teacher_${user.id}_${Date.now()}`;
          const uniqueEmail = `teacher_${user.id}_${Date.now()}@practicehub.local`;
          const randomPassword = await bcrypt.hash(`temp_${user.id}_${Date.now()}`, 10);
          
          assignedByUser = await prisma.studentUser.create({
            data: {
              username: uniqueUsername,
              email: uniqueEmail,
              password: randomPassword,
              telegramId: user.telegramId || null
            }
          });
        }
      }
    }
    
    // Гарантируем, что assignedByUser всегда существует
    if (!assignedByUser) {
      console.error('Не удалось создать или найти assignedByUser для пользователя:', user.id);
      return res.status(500).json({ message: 'Ошибка создания задания: не удалось определить автора' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        deadline: new Date(deadline),
        referenceLink: referenceLink || null,
        allowLateSubmission: allowLateSubmissionValue, // Явно сохраняем значение
        assignedById: assignedByUser.id, // Используем id вместо telegramId
        studentId: studentId || null,
        courseId: courseId || null
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

    if (studentId && student && student.user && student.user.telegramId) {
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
    
    // Если задание для курса, можно отправить уведомления всем студентам курса (опционально)
    if (courseId && !studentId) {
      // Задание создано для курса - студенты увидят его в списке заданий
      // Уведомления можно добавить позже, если нужно
      console.log(`Задание "${task.title}" создано для курса ${courseId}`);
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
  body('solutionLink').optional().custom((value) => {
    if (!value || value === '') return true; // Пустое значение разрешено
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlRegex.test(value)) {
      throw new Error('Некорректная ссылка');
    }
    return true;
  }),
  body('attachments').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = req.user;
    const { id } = req.params;
    const { solutionDescription, solutionLink, attachments } = req.body;

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

    // Находим или создаем студента
    let student = await prisma.student.findFirst({
      where: { userId: user.id }
    });

    // Проверяем доступ: задание должно быть либо личным (task.studentId), либо по курсу, на который записан студент
    let isPersonalTask = false;
    let isCourseTask = false;
    
    if (student) {
      isPersonalTask = task.studentId === student.id;
    }
    
    if (task.courseId) {
      const enrollment = await prisma.courseEnrollment.findFirst({
        where: {
          courseId: task.courseId,
          studentUserId: user.id,
          status: 'APPROVED'
        }
      });
      isCourseTask = !!enrollment;
      
      // Если задание по курсу, но нет записи Student, создаем минимальную запись
      if (isCourseTask && !student) {
        const studentUser = await prisma.studentUser.findUnique({
          where: { id: user.id },
          select: { username: true, email: true }
        });
        
        if (studentUser) {
          // Создаем минимальную запись Student для возможности отправки решения
          student = await prisma.student.create({
            data: {
              firstName: studentUser.username?.split(' ')[1] || 'Студент',
              lastName: studentUser.username?.split(' ')[0] || 'Не указано',
              practiceType: 'EDUCATIONAL',
              institutionName: 'Не указано',
              course: 1,
              email: studentUser.email || null,
              status: 'PENDING',
              userId: user.id
            }
          });
        }
      }
    }

    if (!isPersonalTask && !isCourseTask) {
      return res.status(403).json({ message: 'Это задание не назначено вам' });
    }

    if (!student) {
      return res.status(404).json({ message: 'Студент не найден. Пожалуйста, подайте заявку на практику.' });
    }

    // Проверяем, не истек ли срок и разрешена ли отправка после дедлайна
    const now = new Date();
    const deadline = new Date(task.deadline);
    const isOverdue = now > deadline;
    
    // Строгая проверка: если срок истек И allowLateSubmission явно false (не null, не undefined)
    if (isOverdue && task.allowLateSubmission === false) {
      return res.status(403).json({ 
        message: 'Срок сдачи задания истек. Отправка решения больше недоступна.',
        deadline: task.deadline,
        allowLateSubmission: false
      });
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
  body('grade').optional().custom((value) => {
    if (value === null || value === undefined || value === '') return true; // Пустое значение разрешено
    const num = parseInt(value);
    if (isNaN(num) || num < 1 || num > 10) {
      throw new Error('Оценка должна быть от 1 до 10');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = req.user;
    const { id, submissionId } = req.params;
    const { status, reviewComment, grade } = req.body;

    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
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

    // Находим или создаем преподавателя/админа в StudentUser
    let reviewedByUser = null;
    
    // Ищем существующего пользователя по username или email
    if (user.username) {
      reviewedByUser = await prisma.studentUser.findUnique({
        where: { username: user.username }
      });
    }
    
    if (!reviewedByUser && user.email) {
      reviewedByUser = await prisma.studentUser.findUnique({
        where: { email: user.email }
      });
    }
    
    // Если не найден, создаем виртуального пользователя для преподавателя/админа
    if (!reviewedByUser) {
      try {
        // Генерируем случайный пароль (не используется, но обязателен в схеме)
        const randomPassword = await bcrypt.hash(`temp_${user.id}_${Date.now()}`, 10);
        
        reviewedByUser = await prisma.studentUser.create({
          data: {
            username: user.username || `teacher_${user.id}`,
            email: user.email || `teacher_${user.id}@practicehub.local`,
            password: randomPassword,
            telegramId: user.telegramId || null
          }
        });
      } catch (createError) {
        // Если ошибка из-за дубликата, пытаемся найти существующего
        if (createError.code === 'P2002') {
          if (user.username) {
            reviewedByUser = await prisma.studentUser.findUnique({
              where: { username: user.username }
            });
          }
          if (!reviewedByUser && user.email) {
            reviewedByUser = await prisma.studentUser.findUnique({
              where: { email: user.email }
            });
          }
        } else {
          console.error('Ошибка создания reviewedByUser:', createError);
        }
      }
    }

    // Подготавливаем данные для обновления
    const updateData = {
      status,
      reviewComment: reviewComment || null,
      grade: grade ? parseInt(grade) : null,
      reviewedAt: new Date()
    };
    
    // Добавляем reviewedById только если пользователь найден
    if (reviewedByUser) {
      updateData.reviewedById = reviewedByUser.id;
    }

    const submission = await prisma.taskSubmission.update({
      where: { id: submissionId },
      data: updateData,
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
      stack: error.stack?.substring(0, 500)
    });
    
    // Более детальное сообщение об ошибке для отладки
    let errorMessage = 'Внутренняя ошибка сервера';
    let statusCode = 500;
    
    if (error.code === 'P2002') {
      errorMessage = 'Ошибка: дублирование данных';
      statusCode = 400;
    } else if (error.code === 'P2025') {
      errorMessage = 'Решение не найдено';
      statusCode = 404;
    } else if (error.code === 'P2003') {
      errorMessage = 'Ошибка: некорректная связь с базой данных';
      statusCode = 400;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Удалить задание (админ/преподаватель)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const { id } = req.params;

    // Проверяем существование задания
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            teacher: true
          }
        },
        assignedBy: true,
        submissions: true
      }
    });

    if (!task) {
      return res.status(404).json({ message: 'Задание не найдено' });
    }

    // Проверка прав: преподаватель может удалять только свои задания или задания своих курсов
    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { username: user.username }
      });

      if (!teacher) {
        return res.status(403).json({ message: 'Преподаватель не найден' });
      }

      // Проверяем, является ли задание заданием курса преподавателя
      const isTeacherCourse = task.course && task.course.teacherId === teacher.id;
      
      // Проверяем, создал ли преподаватель это задание
      const isTaskCreator = task.assignedBy && (
        task.assignedBy.username === user.username || 
        task.assignedBy.email === user.email
      );

      if (!isTeacherCourse && !isTaskCreator) {
        return res.status(403).json({ message: 'Вы можете удалять только свои задания или задания своих курсов' });
      }
    }

    // Удаляем связанные решения (submissions) перед удалением задания
    if (task.submissions && task.submissions.length > 0) {
      await prisma.taskSubmission.deleteMany({
        where: { taskId: id }
      });
    }

    // Удаляем задание
    await prisma.task.delete({
      where: { id }
    });

    res.json({ message: 'Задание удалено' });
  } catch (error) {
    console.error('Ошибка удаления задания:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Задание не найдено' });
    }
    
    res.status(500).json({ 
      message: 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


