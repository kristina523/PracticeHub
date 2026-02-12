import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { notifyApplicationStatusChange } from '../bot/telegramBot.js';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      practiceType,
      page = 1,
      limit = 50
    } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (practiceType) {
      where.practiceType = practiceType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [applications, total] = await Promise.all([
      prisma.practiceApplication.findMany({
        where,
        include: {
          studentUser: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.practiceApplication.count({ where })
    ]);

    res.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Ошибка получения заявок:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Проверяем, является ли ошибка связанной с Prisma Client
    if (error.message && error.message.includes('practiceApplication')) {
      return res.status(500).json({ 
        message: 'Модель PracticeApplication не найдена. Убедитесь, что Prisma Client был перегенерирован. Перезапустите сервер после выполнения: npx prisma generate'
      });
    }
    
    res.status(500).json({ 
      message: 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Получить заявки текущего студента
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const studentUser = await prisma.studentUser.findUnique({
      where: { id: user.id }
    });

    if (!studentUser) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    const applications = await prisma.practiceApplication.findMany({
      where: {
        studentUserId: studentUser.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ applications });
  } catch (error) {
    console.error('Ошибка получения заявок студента:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Проверяем, является ли ошибка связанной с Prisma Client
    if (error.message && error.message.includes('practiceApplication')) {
      return res.status(500).json({ 
        message: 'Модель PracticeApplication не найдена. Убедитесь, что Prisma Client был перегенерирован. Перезапустите сервер после выполнения: npx prisma generate'
      });
    }
    
    res.status(500).json({ 
      message: 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/',
  authenticateToken,
  [
    body('lastName').trim().notEmpty().withMessage('Фамилия обязательна'),
    body('firstName').trim().notEmpty().withMessage('Имя обязательно'),
    body('practiceType').isIn(['EDUCATIONAL', 'PRODUCTION', 'INTERNSHIP']).withMessage('Неверный тип практики'),
    body('institutionName').trim().notEmpty().withMessage('Название учебного заведения обязательно'),
    body('course').isInt({ min: 1, max: 10 }).withMessage('Курс должен быть между 1 и 10'),
    body('startDate').custom((value) => {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    }).withMessage('Неверная дата начала'),
    body('endDate').custom((value) => {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    }).withMessage('Неверная дата окончания')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user;
      
      if (user.role !== 'student') {
        return res.status(403).json({ message: 'Только студенты могут подавать заявки' });
      }

      const studentUser = await prisma.studentUser.findUnique({
        where: { id: user.id }
      });

      if (!studentUser) {
        return res.status(404).json({ message: 'Студент не найден' });
      }

      const {
        lastName,
        firstName,
        middleName,
        practiceType,
        institutionName,
        // Тип учреждения (колледж, вуз, школа и т.п.). В схеме обязательное поле,
        // поэтому задаём безопасное значение по умолчанию, если с фронта не пришло.
        institutionType,
        course,
        email,
        phone,
        telegramId,
        startDate,
        endDate,
        notes
      } = req.body;

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res.status(400).json({ message: 'Дата окончания должна быть после даты начала' });
      }

      const existingApplication = await prisma.practiceApplication.findFirst({
        where: {
          studentUserId: studentUser.id,
          status: 'PENDING'
        }
      });

      if (existingApplication) {
        return res.status(400).json({ message: 'У вас уже есть активная заявка на рассмотрении' });
      }

      const application = await prisma.practiceApplication.create({
        data: {
          studentUserId: studentUser.id,
          lastName,
          firstName,
          middleName,
          practiceType,
          institutionType: institutionType || 'EDUCATIONAL_INSTITUTION',
          institutionName,
          course,
          email: email || studentUser.email,
          phone,
          telegramId,
          startDate: start,
          endDate: end,
          notes,
          status: 'PENDING'
        },
        include: {
          studentUser: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });

      res.status(201).json({ message: 'Заявка успешно подана', application });
    } catch (error) {
      console.error('Ошибка создания заявки:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack
      });
      
      if (error.message && error.message.includes('practiceApplication')) {
        return res.status(500).json({ 
          message: 'Модель PracticeApplication не найдена. Убедитесь, что Prisma Client был перегенерирован.',
          hint: 'Выполните: npm run prisma:generate и перезапустите сервер'
        });
      }
      
      res.status(500).json({ 
        message: error.message || 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { 
          error: error.message,
          code: error.code 
        })
      });
    }
  }
);

router.patch('/:id/approve', authenticateToken, async (req, res) => {
  try {
    console.log('🔵 Начало одобрения заявки:', req.params.id);
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'teacher') {
      console.log('❌ Доступ запрещен для роли:', user.role);
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const { id } = req.params;
    const { notes } = req.body;

    console.log('🔍 Поиск заявки с ID:', id);
    const application = await prisma.practiceApplication.findUnique({
      where: { id },
      include: {
        studentUser: true
      }
    });

    if (!application) {
      console.log('❌ Заявка не найдена:', id);
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    console.log('✅ Заявка найдена:', {
      id: application.id,
      status: application.status,
      firstName: application.firstName,
      lastName: application.lastName
    });

    if (application.status !== 'PENDING') {
      const statusMessages = {
        'APPROVED': 'Заявка уже одобрена',
        'REJECTED': 'Заявка уже отклонена'
      };
      console.log('⚠️ Заявка уже обработана, статус:', application.status);
      return res.status(400).json({ 
        message: statusMessages[application.status] || 'Заявка уже обработана',
        currentStatus: application.status
      });
    }

    // Используем транзакцию для атомарности операции и предотвращения race conditions
    console.log('🔄 Начало транзакции для одобрения заявки');
    const result = await prisma.$transaction(async (tx) => {
      // Повторно проверяем статус в транзакции
      const currentApp = await tx.practiceApplication.findUnique({
        where: { id }
      });

      if (!currentApp) {
        throw new Error('Заявка не найдена');
      }

      if (currentApp.status !== 'PENDING') {
        const statusMessages = {
          'APPROVED': 'Заявка уже одобрена',
          'REJECTED': 'Заявка уже отклонена'
        };
        throw new Error(statusMessages[currentApp.status] || 'Заявка уже обработана');
      }

      // Создаем или находим учебное заведение
      console.log('🏫 Поиск/создание учебного заведения:', application.institutionName);
      let institution = await tx.institution.findFirst({
        where: { name: application.institutionName }
      });

      if (!institution) {
        console.log('➕ Создание нового учебного заведения:', application.institutionName);
        institution = await tx.institution.create({
          data: {
            name: application.institutionName,
            type: 'COLLEGE' 
          }
        });
        console.log('✅ Учебное заведение создано:', institution.id);
      } else {
        console.log('✅ Учебное заведение найдено:', institution.id);
      }

      // Проверяем, существует ли уже студент с таким userId или email
      let student = null;
      
      // Сначала проверяем по userId (если есть)
      if (application.studentUserId) {
        student = await tx.student.findUnique({
          where: { userId: application.studentUserId }
        });
        console.log('🔍 Поиск студента по userId:', application.studentUserId, student ? 'найден' : 'не найден');
      }
      
      // Если не найден по userId, проверяем по email (если есть)
      if (!student && application.email) {
        const studentsByEmail = await tx.student.findMany({
          where: { 
            email: application.email
          }
        });
        if (studentsByEmail.length > 0) {
          // Берем первого найденного студента
          student = studentsByEmail[0];
          console.log('🔍 Найден студент по email:', application.email, student.id);
        }
      }

      // Подготавливаем данные студента
      const studentData = {
        lastName: application.lastName,
        firstName: application.firstName,
        middleName: application.middleName,
        practiceType: application.practiceType,
        institutionId: institution.id,
        institutionName: application.institutionName,
        course: application.course,
        email: application.email,
        phone: application.phone,
        telegramId: application.telegramId,
        startDate: application.startDate,
        endDate: application.endDate,
        status: 'ACTIVE', // Статус ACTIVE, так как заявка одобрена
        supervisor: null,
        notes: notes || application.notes
      };

      // Если студент уже существует, обновляем его данные
      if (student) {
        console.log('👤 Обновление существующего студента:', student.id);
        // Если у существующего студента нет userId, но в заявке он есть - проверяем, не занят ли он
        if (!student.userId && application.studentUserId) {
          // Проверяем, не используется ли этот userId другим студентом
          const existingStudentWithUserId = await tx.student.findUnique({
            where: { userId: application.studentUserId }
          });
          if (!existingStudentWithUserId) {
            studentData.userId = application.studentUserId;
          } else if (existingStudentWithUserId.id !== student.id) {
            console.log('⚠️ userId уже используется другим студентом, пропускаем установку userId');
            // Не устанавливаем userId, если он уже используется другим студентом
            delete studentData.userId;
          }
        }
        student = await tx.student.update({
          where: { id: student.id },
          data: studentData
        });
        console.log('✅ Студент обновлен:', student.id);
      } else {
        // Создаем нового студента, сразу связывая с userId если он есть
        console.log('👤 Создание нового студента из заявки');
        
        // Дополнительная проверка: убеждаемся, что userId не занят
        if (application.studentUserId) {
          const existingStudentWithUserId = await tx.student.findUnique({
            where: { userId: application.studentUserId }
          });
          if (existingStudentWithUserId) {
            console.log('⚠️ Найден существующий студент с таким userId, обновляем его:', existingStudentWithUserId.id);
            student = existingStudentWithUserId;
          } else {
            studentData.userId = application.studentUserId;
          }
        }
        
        // Финальная проверка: если студент все еще не найден, проверяем еще раз по email перед созданием
        if (!student && application.email) {
          const finalCheck = await tx.student.findFirst({
            where: { email: application.email }
          });
          if (finalCheck) {
            console.log('⚠️ Найден существующий студент по email перед созданием, обновляем его:', finalCheck.id);
            student = finalCheck;
          }
        }
        
        // Если студент все еще не найден, создаем нового
        if (!student) {
          console.log('📝 Данные студента:', JSON.stringify(studentData, null, 2));
          
          try {
            student = await tx.student.create({
              data: studentData
            });
            console.log('✅ Студент создан:', student.id);
          } catch (createError) {
            console.error('❌ Ошибка создания студента:', createError);
            console.error('Детали ошибки:', {
              code: createError.code,
              message: createError.message,
              meta: createError.meta
            });
            
            // Если ошибка из-за дублирования данных (P2002)
            if (createError.code === 'P2002') {
              const targetField = createError.meta?.target?.[0];
              console.log('🔄 Ошибка дублирования данных в поле:', targetField);
              
              // Если конфликт по userId
              if (targetField === 'userId' && application.studentUserId) {
                console.log('🔄 Попытка найти студента по userId после ошибки дублирования...');
                const existingStudent = await tx.student.findUnique({
                  where: { userId: application.studentUserId }
                });
                if (existingStudent) {
                  console.log('✅ Найден существующий студент, обновляем:', existingStudent.id);
                  // Убираем userId из данных для обновления, так как он уже установлен
                  const updateData = { ...studentData };
                  delete updateData.userId;
                  student = await tx.student.update({
                    where: { id: existingStudent.id },
                    data: updateData
                  });
                } else {
                  // Если студент не найден, но ошибка все равно возникла - возможно race condition
                  // Пробуем еще раз найти по email
                  if (application.email) {
                    const studentsByEmail = await tx.student.findMany({
                      where: { email: application.email }
                    });
                    if (studentsByEmail.length > 0) {
                      student = studentsByEmail[0];
                      const updateData = { ...studentData };
                      delete updateData.userId;
                      student = await tx.student.update({
                        where: { id: student.id },
                        data: updateData
                      });
                    } else {
                      throw createError;
                    }
                  } else {
                    throw createError;
                  }
                }
              } else {
                // Другая ошибка дублирования - пробуем найти студента по email
                if (application.email) {
                  console.log('🔄 Попытка найти студента по email после ошибки дублирования...');
                  const studentsByEmail = await tx.student.findMany({
                    where: { email: application.email }
                  });
                  if (studentsByEmail.length > 0) {
                    student = studentsByEmail[0];
                    const updateData = { ...studentData };
                    // Не устанавливаем userId, если он уже есть у найденного студента
                    if (student.userId) {
                      delete updateData.userId;
                    }
                    student = await tx.student.update({
                      where: { id: student.id },
                      data: updateData
                    });
                  } else {
                    throw createError;
                  }
                } else {
                  throw createError;
                }
              }
            } else {
              throw createError;
            }
          }
        } else {
          // Обновляем найденного студента
          console.log('📝 Обновление найденного студента данными из заявки');
          const updateData = { ...studentData };
          // Не меняем userId, если он уже установлен
          if (student.userId) {
            delete updateData.userId;
          }
          student = await tx.student.update({
            where: { id: student.id },
            data: updateData
          });
          console.log('✅ Студент обновлен:', student.id);
        }
      }

      // Обновляем заявку
      const updatedApplication = await tx.practiceApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: user.id,
          notes: notes || application.notes
        },
        include: {
          studentUser: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });

      return { updatedApplication, student };
    });

    const { updatedApplication, student } = result;

    try {
      console.log('Отправка уведомления об одобрении заявки:', id);
      const notificationResult = await notifyApplicationStatusChange(id, 'APPROVED');
      if (notificationResult) {
        console.log('✅ Уведомление об одобрении успешно отправлено студенту');
      } else {
        console.log('⚠️ Не удалось отправить уведомление об одобрении (возможно, у студента нет telegramId)');
      }
    } catch (error) {
      console.error('Ошибка отправки уведомления об одобрении:', error);
    }

    res.json({ 
      message: 'Заявка одобрена, студент создан', 
      application: updatedApplication,
      student 
    });
  } catch (error) {
    console.error('❌ Ошибка одобрения заявки:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack?.substring(0, 1000)
    });
    
    // Если ошибка из транзакции (например, заявка уже обработана), возвращаем понятное сообщение
    if (error.message && (error.message.includes('уже одобрена') || error.message.includes('уже отклонена') || error.message.includes('уже обработана'))) {
      return res.status(400).json({ message: error.message });
    }
    
    // Более детальное сообщение об ошибке
    let errorMessage = 'Внутренняя ошибка сервера';
    if (error.code === 'P2002') {
      errorMessage = 'Ошибка: Дублирование данных. Возможно, студент с такими данными уже существует.';
    } else if (error.code === 'P2003') {
      errorMessage = 'Ошибка: Связанные данные не найдены. Проверьте корректность данных заявки.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        code: error.code 
      })
    });
  }
});

router.patch('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const { id } = req.params;
    const { rejectionReason } = req.body;

    const application = await prisma.practiceApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    if (application.status !== 'PENDING') {
      const statusMessages = {
        'APPROVED': 'Заявка уже одобрена',
        'REJECTED': 'Заявка уже отклонена'
      };
      return res.status(400).json({ 
        message: statusMessages[application.status] || 'Заявка уже обработана',
        currentStatus: application.status
      });
    }

    // Используем транзакцию для атомарности операции
    const result = await prisma.$transaction(async (tx) => {
      // Повторно проверяем статус в транзакции
      const currentApp = await tx.practiceApplication.findUnique({
        where: { id }
      });

      if (!currentApp) {
        throw new Error('Заявка не найдена');
      }

      if (currentApp.status !== 'PENDING') {
        const statusMessages = {
          'APPROVED': 'Заявка уже одобрена',
          'REJECTED': 'Заявка уже отклонена'
        };
        throw new Error(statusMessages[currentApp.status] || 'Заявка уже обработана');
      }

      const updatedApplication = await tx.practiceApplication.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Заявка отклонена'
        },
        include: {
          studentUser: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });

      return updatedApplication;
    });

    const updatedApplication = result;

    try {
      console.log('Отправка уведомления об отклонении заявки:', id);
      const notificationResult = await notifyApplicationStatusChange(id, 'REJECTED', rejectionReason || 'Заявка отклонена');
      if (notificationResult) {
        console.log('✅ Уведомление об отклонении успешно отправлено студенту');
      } else {
        console.log('⚠️ Не удалось отправить уведомление об отклонении (возможно, у студента нет telegramId)');
      }
    } catch (error) {
      console.error('Ошибка отправки уведомления об отклонении:', error);
    }

    res.json({ message: 'Заявка отклонена', application: updatedApplication });
  } catch (error) {
    console.error('Ошибка отклонения заявки:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack?.substring(0, 1000)
    });
    
    // Если ошибка из транзакции (например, заявка уже обработана), возвращаем понятное сообщение
    if (error.message && (error.message.includes('уже одобрена') || error.message.includes('уже отклонена') || error.message.includes('уже обработана'))) {
      return res.status(400).json({ message: error.message });
    }
    
    // Более детальное сообщение об ошибке
    let errorMessage = 'Внутренняя ошибка сервера';
    if (error.code === 'P2025') {
      errorMessage = 'Заявка не найдена';
    } else if (error.code === 'P2002') {
      errorMessage = 'Ошибка: Дублирование данных';
    } else if (error.code === 'P2003') {
      errorMessage = 'Ошибка: Связанные данные не найдены';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        code: error.code 
      })
    });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ DELETE запрос на удаление заявки:', req.params.id);
    const user = req.user;
    
    // Только админ может удалять заявки
    if (user.role !== 'admin') {
      console.log('❌ Доступ запрещен. Роль пользователя:', user.role);
      return res.status(403).json({ message: 'Доступ запрещен. Только администратор может удалять заявки.' });
    }

    const { id } = req.params;
    console.log('🔍 Поиск заявки с ID:', id);

    const application = await prisma.practiceApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    // Удаляем заявку
    await prisma.practiceApplication.delete({
      where: { id }
    });

    res.json({ message: 'Заявка успешно удалена' });
  } catch (error) {
    console.error('Ошибка удаления заявки:', error);
    
    let errorMessage = 'Внутренняя ошибка сервера';
    if (error.code === 'P2025') {
      errorMessage = 'Заявка не найдена';
    } else if (error.code === 'P2003') {
      errorMessage = 'Ошибка: Связанные данные не найдены. Проверьте корректность данных заявки.';
    }
    
    res.status(500).json({ message: errorMessage });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const application = await prisma.practiceApplication.findUnique({
      where: { id },
      include: {
        studentUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    if (user.role === 'student' && application.studentUserId !== user.id) {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    res.json(application);
  } catch (error) {
    console.error('Ошибка получения заявки:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;

