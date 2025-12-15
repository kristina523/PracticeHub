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
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
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
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
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
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const { id } = req.params;
    const { notes } = req.body;

    const application = await prisma.practiceApplication.findUnique({
      where: { id },
      include: {
        studentUser: true
      }
    });

    if (!application) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    if (application.status !== 'PENDING') {
      return res.status(400).json({ message: 'Заявка уже обработана' });
    }
    let institution = await prisma.institution.findFirst({
      where: { name: application.institutionName }
    });

    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: application.institutionName,
          type: 'COLLEGE' 
        }
      });
    }

    const student = await prisma.student.create({
      data: {
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
        status: 'PENDING',
        supervisor: null,
        notes: notes || application.notes
      }
    });

    const updatedApplication = await prisma.practiceApplication.update({
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

    if (application.studentUser.studentId === null) {
      await prisma.studentUser.update({
        where: { id: application.studentUserId },
        data: { studentId: student.id }
      });
    }

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
    console.error('Ошибка одобрения заявки:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
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
      return res.status(400).json({ message: 'Заявка уже обработана' });
    }

    const updatedApplication = await prisma.practiceApplication.update({
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
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
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

