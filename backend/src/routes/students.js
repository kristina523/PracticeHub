import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: Получить список студентов
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Количество записей на странице
 *       - in: query
 *         name: practiceType
 *         schema:
 *           type: string
 *           enum: [EDUCATIONAL, PRODUCTION, INTERNSHIP]
 *         description: Тип практики
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACTIVE, COMPLETED]
 *         description: Статус практики
 *       - in: query
 *         name: institutionId
 *         schema:
 *           type: string
 *         description: ID учебного заведения
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поиск по ФИО, email или названию учебного заведения
 *       - in: query
 *         name: userOnly
 *         schema:
 *           type: boolean
 *         description: Только студенты с аккаунтами (для студентов)
 *     responses:
 *       200:
 *         description: Список студентов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 students:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Не авторизован
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      practiceType,
      status,
      institutionId,
      search,
      startDate,
      endDate,
      isRegistered,
      userOnly,
      page = 1,
      limit = 50
    } = req.query;

    const where = {};

    if (practiceType) {
      where.practiceType = practiceType;
    }

    if (status) {
      where.status = status;
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (search) {
      where.OR = [
        { lastName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
        { institutionName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (startDate || endDate) {
      where.OR = [
        {
          AND: [
            startDate ? { startDate: { gte: new Date(startDate) } } : {},
            endDate ? { endDate: { lte: new Date(endDate) } } : {}
          ]
        },
        {
          AND: [
            startDate ? { endDate: { gte: new Date(startDate) } } : {},
            endDate ? { startDate: { lte: new Date(endDate) } } : {}
          ]
        }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          institution: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.student.count({ where })
    ]);

    // Получаем информацию о зарегистрированных студентах (StudentUser)
    const allRegisteredStudents = await prisma.studentUser.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      }
    });

    // Все StudentUser, привязанные к карточке Student (по всей базе, не только текущая страница)
    const linkedRows = await prisma.student.findMany({
      where: { userId: { not: null } },
      select: { userId: true }
    });
    const studentUserIdsSet = new Set(linkedRows.map((r) => r.userId).filter(Boolean));

    const applicationUserRows = await prisma.practiceApplication.findMany({
      where: { studentUserId: { not: null } },
      select: { studentUserId: true },
      distinct: ['studentUserId']
    });
    const studentUserIdsWithApplication = new Set(
      applicationUserRows.map((r) => r.studentUserId).filter(Boolean)
    );

    // Разделяем зарегистрированных на тех, у кого есть Student запись, и тех, у кого нет
    const registeredWithStudent = allRegisteredStudents.filter((reg) => studentUserIdsSet.has(reg.id));
    const registeredWithoutStudent = allRegisteredStudents.filter(
      (reg) => !studentUserIdsSet.has(reg.id) && !studentUserIdsWithApplication.has(reg.id)
    );

    // Создаем Map для быстрого доступа к данным StudentUser по ID
    const registeredMap = new Map();
    allRegisteredStudents.forEach(reg => {
      registeredMap.set(reg.id, {
        username: reg.username,
        email: reg.email
      });
    });

    // Добавляем информацию о регистрации к студентам
    let studentsWithRegistration = students.map(student => {
      const userInfo = student.userId ? registeredMap.get(student.userId) : null;
      return {
        ...student,
        isRegistered: !!student.userId && !!userInfo,
        studentUser: userInfo || null
      };
    });

    const virtualStudents = registeredWithoutStudent.map(reg => ({
      id: `user_${reg.id}`, 
      lastName: reg.username.split(' ')[0] || reg.username,
      firstName: reg.username.split(' ')[1] || '',
      middleName: null,
      practiceType: 'EDUCATIONAL', 
      institutionId: '',
      institutionName: 'Не указано',
      course: 0,
      email: reg.email,
      phone: null,
      telegramId: null,
      startDate: reg.createdAt,
      endDate: new Date(reg.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000), 
      status: 'PENDING',
      supervisor: null,
      notes: 'Зарегистрирован без привязки к студенту',
      createdAt: reg.createdAt,
      updatedAt: reg.createdAt,
      institution: null,
      isRegistered: true,
      studentUser: {
        username: reg.username,
        email: reg.email
      },
      isVirtual: true 
    }));

    studentsWithRegistration = [...studentsWithRegistration, ...virtualStudents];

    // Если запрашиваются данные только текущего пользователя
    if (userOnly === 'true' || userOnly === true) {
      const currentUser = req.user;
      if (currentUser && currentUser.role === 'student') {
        // Фильтруем только студента текущего пользователя
        studentsWithRegistration = studentsWithRegistration.filter(
          student => student.userId === currentUser.id || (student.isVirtual && student.studentUser?.email === currentUser.email)
        );
      }
    }

    let filteredTotal = total + virtualStudents.length; 
    if (isRegistered !== undefined && isRegistered !== '' && isRegistered !== null) {
      const filterRegistered = isRegistered === 'true' || isRegistered === true;
      studentsWithRegistration = studentsWithRegistration.filter(
        student => student.isRegistered === filterRegistered
      );
      if (filterRegistered) {
        filteredTotal = allRegisteredStudents.length;
      } else {
        filteredTotal = total - registeredWithStudent.length;
      }
    }

    studentsWithRegistration.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    });

    const paginatedStudents = studentsWithRegistration.slice(skip, skip + take);
    const finalTotal = isRegistered !== undefined && isRegistered !== '' && isRegistered !== null
      ? filteredTotal
      : studentsWithRegistration.length;

    res.json({
      students: paginatedStudents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: finalTotal,
        pages: Math.ceil(finalTotal / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Ошибка получения всех студентов:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/students/{id}:
 *   get:
 *     summary: Получить студента по ID
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID студента
 *     responses:
 *       200:
 *         description: Информация о студенте
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Студент не найден
 *       401:
 *         description: Не авторизован
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        institution: true
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    res.json(student);
  } catch (error) {
    console.error('Ошибка получения студента:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/students:
 *   post:
 *     summary: Создать нового студента
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lastName
 *               - firstName
 *               - practiceType
 *               - institutionName
 *               - course
 *               - startDate
 *               - endDate
 *             properties:
 *               lastName:
 *                 type: string
 *                 example: "Иванов"
 *               firstName:
 *                 type: string
 *                 example: "Иван"
 *               middleName:
 *                 type: string
 *                 example: "Иванович"
 *               practiceType:
 *                 type: string
 *                 enum: [EDUCATIONAL, PRODUCTION, INTERNSHIP]
 *               institutionName:
 *                 type: string
 *                 example: "МГУ"
 *               course:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Студент успешно создан
 *       400:
 *         description: Ошибка валидации
 */
router.post('/',
  authenticateToken,
  [
    body('lastName').trim().notEmpty().withMessage('Фамилия обязательна'),
    body('firstName').trim().notEmpty().withMessage('Имя обязательно'),
    body('middleName').optional().trim(),
    body('practiceType').isIn(['EDUCATIONAL', 'PRODUCTION', 'INTERNSHIP']).withMessage('Invalid practice type'),
    body('institutionId').optional(),
    body('institutionName').trim().notEmpty().withMessage('Название учебного заведения обязательно'),
    body('course').isInt({ min: 1, max: 4 }).withMessage('Курс должен быть между 1 и 4'),
    body('email').trim().notEmpty().isEmail().withMessage('Укажите корректный email'),
    body('phone').trim().notEmpty().withMessage('Укажите телефон'),
    body('startDate').isISO8601().withMessage('Неверная дата начала'),
    body('endDate').isISO8601().withMessage('Неверная дата окончания'),
    body('status').optional().isIn(['PENDING', 'ACTIVE', 'COMPLETED']).withMessage('Неверный статус')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        lastName,
        firstName,
        middleName,
        practiceType,
        institutionId,
        institutionName,
        course,
        email,
        phone,
        telegramId,
        startDate,
        endDate,
        status = 'PENDING',
        supervisor,
        notes
      } = req.body;

      let finalInstitutionId = institutionId;
      
      if (!finalInstitutionId && institutionName) {
        let institution = await prisma.institution.findFirst({
          where: { name: institutionName }
        });

        if (!institution) {
          institution = await prisma.institution.create({
            data: {
              name: institutionName,
              type: 'COLLEGE'
            }
          });
        }
        
        finalInstitutionId = institution.id;
      } else if (finalInstitutionId) {
        const institution = await prisma.institution.findUnique({
          where: { id: finalInstitutionId }
        });

        if (!institution) {
          return res.status(404).json({ message: 'Институт не найден' });
        }
      } else {
        return res.status(400).json({ message: 'Название института является обязательным' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res.status(400).json({ message: 'Дата окончания должна быть после даты начала' });
      }

      // Получаем тип института для заявки
      const institution = await prisma.institution.findUnique({
        where: { id: finalInstitutionId }
      });
      const institutionType = institution?.type || 'COLLEGE';

      // Создаем студента и заявку на практику в транзакции
      const result = await prisma.$transaction(async (tx) => {
        // Создаем студента
        const student = await tx.student.create({
          data: {
            lastName,
            firstName,
            middleName: middleName || null,
            practiceType,
            institutionId: finalInstitutionId,
            institutionName,
            course,
            email,
            phone,
            telegramId,
            startDate: start,
            endDate: end,
            status: 'PENDING', // Всегда создаем со статусом PENDING
            supervisor,
            notes
          },
          include: {
            institution: true
          }
        });

        // Создаем заявку на практику для этого студента
        const application = await tx.practiceApplication.create({
          data: {
            firstName,
            lastName,
            middleName: middleName || null,
            practiceType,
            institutionType: institutionType, // Используем тип из института
            institutionName,
            course,
            email: email || '',
            phone: phone || '',
            telegramId: telegramId || null,
            startDate: start,
            endDate: end,
            status: 'PENDING',
            notes: notes || null,
            studentId: student.id // Связываем заявку со студентом
          }
        });

        return { student, application };
      });

      res.status(201).json(result.student);
    } catch (error) {
      console.error('Ошибка создания студента:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

/**
 * @swagger
 * /api/students/{id}:
 *   put:
 *     summary: Обновить информацию о студенте
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID студента
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lastName:
 *                 type: string
 *               firstName:
 *                 type: string
 *               middleName:
 *                 type: string
 *               practiceType:
 *                 type: string
 *                 enum: [EDUCATIONAL, PRODUCTION, INTERNSHIP]
 *               institutionId:
 *                 type: string
 *               institutionName:
 *                 type: string
 *               course:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *               email:
 *                 type: string
 *                 format: email
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACTIVE, COMPLETED]
 *     responses:
 *       200:
 *         description: Студент успешно обновлен
 *       400:
 *         description: Ошибка валидации
 *       404:
 *         description: Студент не найден
 *       401:
 *         description: Не авторизован
 */
router.put('/:id',
  authenticateToken,
  [
    body('lastName').optional().trim().notEmpty().withMessage('Фамилия не может быть пустой'),
    body('firstName').optional().trim().notEmpty().withMessage('Имя не может быть пустым'),
    body('middleName').optional().trim(),
    body('practiceType').optional().isIn(['EDUCATIONAL', 'PRODUCTION', 'INTERNSHIP']).withMessage('Неверный тип практики'),
    body('institutionId').optional().notEmpty().withMessage('ID института не может быть пустым'),
    body('institutionName').optional().trim().notEmpty().withMessage('Название института не может быть пустым'),
    body('course').optional().isInt({ min: 1, max: 4 }).withMessage('Курс должен быть между 1 и 4'),
    body('email').optional().isEmail().withMessage('Неверный email'),
    body('startDate').optional().isISO8601().withMessage('Неверная дата начала'),
    body('endDate').optional().isISO8601().withMessage('Неверная дата окончания'),
    body('status').optional().isIn(['PENDING', 'ACTIVE', 'COMPLETED']).withMessage('Неверный статус')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updateData = { ...req.body };

      const existingStudent = await prisma.student.findUnique({
        where: { id }
      });

      if (!existingStudent) {
        return res.status(404).json({ message: 'Студент не найден' });
      }

      if (updateData.institutionName) {
        if (updateData.institutionId) {
          const institution = await prisma.institution.findUnique({
            where: { id: updateData.institutionId }
          });

          if (!institution) {
            return res.status(404).json({ message: 'Институт не найден' });
          }
        } else {
          let institution = await prisma.institution.findUnique({
            where: { name: updateData.institutionName }
          });

          if (!institution) {
            institution = await prisma.institution.create({
              data: {
                name: updateData.institutionName,
                type: 'COLLEGE'
              }
            });
          }
          
          updateData.institutionId = institution.id;
        }
      }

      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      if (updateData.startDate && updateData.endDate) {
        if (updateData.startDate >= updateData.endDate) {
          return res.status(400).json({ message: 'Дата окончания должна быть после даты начала' });
        }
      } else if (updateData.startDate && existingStudent.endDate) {
        if (updateData.startDate >= existingStudent.endDate) {
          return res.status(400).json({ message: 'Дата окончания должна быть после даты начала' });
        }
      } else if (updateData.endDate && existingStudent.startDate) {
        if (existingStudent.startDate >= updateData.endDate) {
          return res.status(400).json({ message: 'Дата окончания должна быть после даты начала' });
        }
      }

      const student = await prisma.student.update({
        where: { id },
        data: updateData,
        include: {
          institution: true
        }
      });

      res.json(student);
    } catch (error) {
      console.error('Ошибка обновления студента:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);


/**
 * @swagger
 * /api/students/{id}:
 *   delete:
 *     summary: Удалить студента
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID студента (может начинаться с "user_" для виртуальных студентов)
 *     responses:
 *       200:
 *         description: Студент успешно удален
 *       404:
 *         description: Студент не найден
 *       400:
 *         description: Ошибка удаления
 *       401:
 *         description: Не авторизован
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Обработка виртуальных студентов (только StudentUser без Student)
    if (id.startsWith('user_')) {
      const studentUserId = id.replace('user_', '');

      const studentUser = await prisma.studentUser.findUnique({
        where: { id: studentUserId },
        include: {
          applications: true,
          assignedTasks: true,
          reviewedSubmissions: true,
          courseEnrollments: {
            include: {
              messages: true
            }
          },
          student: true // Проверяем, есть ли связанный Student
        }
      });

      if (!studentUser) {
        return res.status(404).json({ message: 'Аккаунт студента не найден' });
      }

      // Если есть связанный Student, не удаляем - это не виртуальный студент
      if (studentUser.student) {
        return res.status(400).json({ 
          message: 'Этот студент имеет связанную запись. Удалите запись Student сначала.' 
        });
      }

      // Удаляем связанные данные в правильном порядке
      // 1. Удаляем сообщения в чатах курсов
      for (const enrollment of studentUser.courseEnrollments) {
        if (enrollment.messages && enrollment.messages.length > 0) {
          await prisma.courseChatMessage.deleteMany({
            where: { enrollmentId: enrollment.id }
          });
        }
      }

      // 2. Удаляем записи на курсы
      if (studentUser.courseEnrollments.length > 0) {
        await prisma.courseEnrollment.deleteMany({
          where: { studentUserId: studentUserId }
        });
      }

      // 3. Удаляем заявки
      if (studentUser.applications.length > 0) {
        await prisma.practiceApplication.deleteMany({
          where: { studentUserId: studentUserId }
        });
      }

      // 4. Обрабатываем задачи, где этот пользователь был назначен
      if (studentUser.assignedTasks.length > 0) {
        // Удаляем задачи, которые были созданы этим пользователем
        // Сначала удаляем все решения этих задач
        const taskIds = studentUser.assignedTasks.map(t => t.id);
        if (taskIds.length > 0) {
          await prisma.taskSubmission.deleteMany({
            where: { taskId: { in: taskIds } }
          });
          // Затем удаляем сами задачи
          await prisma.task.deleteMany({
            where: { id: { in: taskIds } }
          });
        }
      }

      // 5. Обновляем проверенные решения (устанавливаем reviewedById в null)
      if (studentUser.reviewedSubmissions.length > 0) {
        await prisma.taskSubmission.updateMany({
          where: { reviewedById: studentUserId },
          data: { reviewedById: null }
        });
      }

      // 6. Удаляем StudentUser
      await prisma.studentUser.delete({ where: { id: studentUserId } });

      return res.json({ message: 'Аккаунт студента удален, повторная регистрация доступна' });
    }

    // Обработка обычных студентов (Student)
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        applications: true,
        tasks: true,
        submissions: true,
        user: {
          include: {
            courseEnrollments: true
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    // Удаляем связанные данные
    if (student.submissions.length > 0) {
      await prisma.taskSubmission.deleteMany({
        where: { studentId: id }
      });
    }

    // Удаляем задачи, назначенные конкретно этому студенту (не курсовые)
    if (student.tasks.length > 0) {
      await prisma.task.deleteMany({
        where: { studentId: id }
      });
    }

    if (student.applications.length > 0) {
      await prisma.practiceApplication.deleteMany({
        where: { studentId: id }
      });
    }

    // Если у студента есть связанный StudentUser, удаляем его и связанные данные
    if (student.userId && student.user) {
      const studentUser = student.user;

      // Удаляем заявки StudentUser
      if (studentUser.applications && studentUser.applications.length > 0) {
        await prisma.practiceApplication.deleteMany({
          where: { studentUserId: student.userId }
        });
      }

      // Удаляем записи на курсы
      if (studentUser.courseEnrollments && studentUser.courseEnrollments.length > 0) {
        await prisma.courseEnrollment.deleteMany({
          where: { studentUserId: student.userId }
        });
      }

      // Удаляем StudentUser
      await prisma.studentUser.delete({
        where: { id: student.userId }
      });
    }

    // Удаляем самого студента
    await prisma.student.delete({
      where: { id }
    });

    res.json({ message: 'Студент и связанные учетные данные удалены' });
  } catch (error) {
    console.error('Ошибка удаления студента:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack?.substring(0, 500)
    });
    res.status(500).json({ 
      message: 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

