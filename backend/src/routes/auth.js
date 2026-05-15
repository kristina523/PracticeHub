import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { notifyAdminsAboutNewApplication } from '../bot/telegramBot.js';

const router = express.Router();
const prisma = new PrismaClient();

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 час

function hashResetToken(rawToken) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Для StudentUser без связанного Student — нужна одобренная заявка (как при входе).
 * @returns {null} если доступ разрешён
 * @returns {'STUDENT_PENDING_APPROVAL'|'STUDENT_APPLICATION_REJECTED'|'STUDENT_NO_PROFILE'|'NOT_FOUND'} иначе
 */
async function getStudentGateCodeIfBlocked(studentUserId) {
  const su = await prisma.studentUser.findUnique({
    where: { id: studentUserId },
    select: { id: true, student: { select: { id: true } } }
  });
  if (!su) return 'NOT_FOUND';
  if (su.student?.id) return null;
  const pendingApp = await prisma.practiceApplication.findFirst({
    where: { studentUserId, status: 'PENDING' }
  });
  if (pendingApp) return 'STUDENT_PENDING_APPROVAL';
  const rejectedApp = await prisma.practiceApplication.findFirst({
    where: { studentUserId, status: 'REJECTED' },
    orderBy: { updatedAt: 'desc' }
  });
  if (rejectedApp) return 'STUDENT_APPLICATION_REJECTED';
  return 'STUDENT_NO_PROFILE';
}

const STUDENT_GATE_MESSAGES = {
  login: {
    STUDENT_PENDING_APPROVAL:
      'Вход недоступен: заявка на практику ожидает подтверждения администратором. После одобрения вы сможете войти в систему.',
    STUDENT_APPLICATION_REJECTED:
      'Вход недоступен: заявка была отклонена. Для уточнений обратитесь к администратору.',
    STUDENT_NO_PROFILE:
      'Вход недоступен: учётная запись не привязана к карточке практиканта. Обратитесь к администратору.'
  },
  password: {
    STUDENT_PENDING_APPROVAL:
      'Восстановление пароля недоступно: заявка на практику ещё не одобрена администратором. После одобрения запросите ссылку снова.',
    STUDENT_APPLICATION_REJECTED:
      'Восстановление пароля недоступно: заявка была отклонена. Обратитесь к администратору.',
    STUDENT_NO_PROFILE:
      'Восстановление пароля недоступно: учётная запись не привязана к карточке практиканта. Обратитесь к администратору.'
  }
};

/** Ответ API для StudentUser (как в GET /auth/me). */
function serializeStudentUserForClient(user) {
  const s = user.student;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: 'student',
    studentId: s?.id || null,
    telegramId: user.telegramId || null,
    createdAt: user.createdAt,
    student: s
      ? {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          middleName: s.middleName,
          phone: s.phone,
          email: s.email,
          course: s.course,
          practiceType: s.practiceType,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          supervisor: s.supervisor,
          notes: s.notes,
          institutionName: s.institution?.name || s.institutionName || null
        }
      : null
  };
}

const STUDENT_SELF_PRACTICE_TYPES = new Set(['EDUCATIONAL', 'PRODUCTION', 'INTERNSHIP']);

/**
 * Студент правит свою карточку Student (по userId). Статус, руководитель, примечания — только админ.
 */
async function applyStudentPracticeSelfUpdateFromBody(studentUserId, sp) {
  if (!sp || typeof sp !== 'object' || Array.isArray(sp)) {
    return { ok: true };
  }

  const linkedStudent = await prisma.student.findUnique({ where: { userId: studentUserId } });
  if (!linkedStudent) {
    return { ok: false, status: 400, message: 'Запись о практике не найдена' };
  }

  const lastName = String(sp.lastName ?? '').trim();
  const firstName = String(sp.firstName ?? '').trim();
  if (!lastName || !firstName) {
    return { ok: false, status: 400, message: 'Укажите фамилию и имя' };
  }

  const practiceType = String(sp.practiceType ?? '').trim();
  if (!STUDENT_SELF_PRACTICE_TYPES.has(practiceType)) {
    return { ok: false, status: 400, message: 'Некорректный тип практики' };
  }

  let course = null;
  if (sp.course !== undefined && sp.course !== null && sp.course !== '') {
    const n = typeof sp.course === 'number' ? sp.course : parseInt(String(sp.course), 10);
    if (Number.isNaN(n) || n < 1 || n > 4) {
      return { ok: false, status: 400, message: 'Курс должен быть числом от 1 до 4' };
    }
    course = n;
  }

  const middleName = String(sp.middleName ?? '').trim() || null;

  const phone = String(sp.phone ?? '').trim();
  if (!phone) {
    return { ok: false, status: 400, message: 'Укажите телефон' };
  }

  const practiceEmail = String(sp.email ?? '').trim();
  if (!practiceEmail) {
    return { ok: false, status: 400, message: 'Укажите email' };
  }
  const emailSimple = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailSimple.test(practiceEmail)) {
    return { ok: false, status: 400, message: 'Некорректный email' };
  }

  let newStart = linkedStudent.startDate;
  let newEnd = linkedStudent.endDate;
  if (sp.startDate !== undefined) {
    if (sp.startDate === null || sp.startDate === '') {
      newStart = null;
    } else {
      const d = new Date(sp.startDate);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, status: 400, message: 'Некорректная дата начала' };
      }
      newStart = d;
    }
  }
  if (sp.endDate !== undefined) {
    if (sp.endDate === null || sp.endDate === '') {
      newEnd = null;
    } else {
      const d = new Date(sp.endDate);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, status: 400, message: 'Некорректная дата окончания' };
      }
      newEnd = d;
    }
  }
  if (newStart && newEnd && newStart >= newEnd) {
    return { ok: false, status: 400, message: 'Дата окончания должна быть после даты начала' };
  }

  const instRaw = String(sp.institutionName ?? '').trim();
  let institutionId = null;
  let institutionName = null;
  if (instRaw) {
    institutionName = instRaw;
    let institution = await prisma.institution.findFirst({ where: { name: instRaw } });
    if (!institution) {
      institution = await prisma.institution.create({
        data: { name: instRaw, type: 'COLLEGE' }
      });
    }
    institutionId = institution.id;
  }

  const data = {
    lastName,
    firstName,
    middleName,
    practiceType,
    course,
    phone,
    email: practiceEmail,
    startDate: newStart,
    endDate: newEnd,
    institutionId,
    institutionName
  };

  await prisma.student.update({
    where: { id: linkedStudent.id },
    data
  });

  return { ok: true };
}

/** Поиск аккаунта по email без учёта регистра (SQLite). */
async function findAccountByEmail(email) {
  const e = (email || '').trim();
  if (!e) return null;
  const rows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT 'admin' AS role, id FROM Admin WHERE email IS NOT NULL AND lower(email) = lower(${e})
      UNION ALL
      SELECT 'teacher' AS role, id FROM Teacher WHERE email IS NOT NULL AND lower(email) = lower(${e})
      UNION ALL
      SELECT 'student' AS role, id FROM StudentUser WHERE email IS NOT NULL AND lower(email) = lower(${e})
      LIMIT 1
    `
  );
  return rows?.[0] || null;
}

async function getEmailForAccount(userId, role) {
  if (role === 'admin') {
    const u = await prisma.admin.findUnique({ where: { id: userId }, select: { email: true } });
    return u?.email || null;
  }
  if (role === 'teacher') {
    const u = await prisma.teacher.findUnique({ where: { id: userId }, select: { email: true } });
    return u?.email || null;
  }
  if (role === 'student') {
    const u = await prisma.studentUser.findUnique({ where: { id: userId }, select: { email: true } });
    return u?.email || null;
  }
  return null;
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) return { sent: false, reason: 'smtp_not_configured' };

  try {
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(process.env.SMTP_PORT || '587');
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined
    });

    const subject = 'PracticeHub — восстановление пароля';
    const text = `Вы запросили сброс пароля.\n\nПерейдите по ссылке (действует 1 час):\n${resetUrl}\n\nЕсли это были не вы, проигнорируйте письмо.`;
    const html = `<p>Вы запросили сброс пароля.</p><p><a href="${resetUrl}">Установить новый пароль</a> (ссылка действует 1 час).</p><p>Если это были не вы, проигнорируйте письмо.</p>`;

    await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('Ошибка отправки письма сброса пароля:', err);
    return { sent: false, reason: 'send_failed', error: err?.message };
  }
}

/**
 * @swagger
 * /api/auth/register/teacher:
 *   post:
 *     summary: Регистрация преподавателя
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 example: "teacher1"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "teacher@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               firstName:
 *                 type: string
 *                 example: "Иван"
 *               lastName:
 *                 type: string
 *                 example: "Иванов"
 *               middleName:
 *                 type: string
 *                 example: "Иванович"
 *               phone:
 *                 type: string
 *                 example: "+79001234567"
 *     responses:
 *       201:
 *         description: Преподаватель успешно зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Преподаватель успешно зарегистрирован"
 *                 teacher:
 *                   type: object
 *       400:
 *         description: Ошибка валидации или пользователь уже существует
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.post('/register/teacher',
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Имя пользователя должно содержать не менее 3 символов'),
    body('email').isEmail().withMessage('Неверный адрес электронной почты'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов'),
    body('firstName').notEmpty().withMessage('Требуется имя'),
    body('lastName').notEmpty().withMessage('Требуется фамилия')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, firstName, lastName, middleName, phone } = req.body;

      // Проверка на существование пользователя в любой из таблиц
      const existingUser = await prisma.teacher.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Пользователь с таким именем пользователя или электронной почтой уже существует' });
      }

      // Проверка в других таблицах
      const existingAdmin = await prisma.admin.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      const existingStudent = await prisma.studentUser.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      if (existingAdmin || existingStudent) {
        return res.status(400).json({ message: 'Пользователь с таким именем пользователя или электронной почтой уже существует' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const teacher = await prisma.teacher.create({
        data: {
          username,
          email,
          password: hashedPassword,
          firstName,
          lastName,
          middleName,
          phone
        },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          middleName: true,
          phone: true,
          createdAt: true
        }
      });

      res.status(201).json({ message: 'Преподаватель успешно зарегистрирован', teacher });
    } catch (error) {
      console.error('Ошибка регистрации преподавателя:', error);
      console.error('Детали ошибки:', {
        code: error.code,
        message: error.message,
        meta: error.meta,
        stack: error.stack
      });
      
      // Обработка специфических ошибок Prisma
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'поле';
        return res.status(400).json({ 
          message: `Пользователь с таким ${field === 'username' ? 'именем пользователя' : field === 'email' ? 'email' : field} уже существует` 
        });
      }
      
      // Обработка ошибки отсутствия модели
      if (error.message && error.message.includes('teacher')) {
        return res.status(500).json({ 
          message: 'Модель Teacher не найдена. Убедитесь, что Prisma Client был перегенерирован после изменений схемы.',
          hint: 'Выполните: npm run prisma:generate и перезапустите сервер'
        });
      }
      
      res.status(500).json({ 
        message: error.message || 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { 
          error: error.message,
          code: error.code,
          stack: error.stack 
        })
      });
    }
  }
);

/**
 * @swagger
 * /api/auth/register/admin:
 *   post:
 *     summary: Регистрация администратора
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 example: "admin"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: Администратор успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Администратор успешно создан"
 *                 admin:
 *                   type: object
 *       400:
 *         description: Ошибка валидации или пользователь уже существует
 *       500:
 *         description: Внутренняя ошибка сервера
 */
// Регистрация администратора
router.post('/register/admin',
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Имя пользователя должно содержать не менее 3 символов'),
    body('email').isEmail().withMessage('Неверный адрес электронной почты'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password } = req.body;

      // Проверка на существование пользователя в любой из таблиц
      const existingAdmin = await prisma.admin.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      if (existingAdmin) {
        return res.status(400).json({ message: 'Администратор с таким именем пользователя или электронной почтой уже существует' });
      }

      // Проверка в других таблицах
      const existingTeacher = await prisma.teacher.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      const existingStudent = await prisma.studentUser.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      if (existingTeacher || existingStudent) {
        return res.status(400).json({ message: 'Пользователь с таким именем пользователя или электронной почтой уже существует' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const admin = await prisma.admin.create({
        data: {
          username,
          email,
          password: hashedPassword
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true
        }
      });

      res.status(201).json({ message: 'Администратор успешно создан', admin });
    } catch (error) {
      console.error('Ошибка регистрации администратора:', error);
      
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'поле';
        return res.status(400).json({ 
          message: `Пользователь с таким ${field === 'username' ? 'именем пользователя' : field === 'email' ? 'email' : field} уже существует` 
        });
      }
      
      res.status(500).json({ 
        message: error.message || 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация администратора (устаревший эндпоинт)
 *     tags: [Auth]
 *     deprecated: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: Администратор успешно создан
 *       400:
 *         description: Ошибка валидации
 */
// Регистрация администратора (оставляем для обратной совместимости)
router.post('/register',
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Имя пользователя должно содержать не менее 3 символов'),
    body('email').isEmail().withMessage('Неверный адрес электронной почты'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password } = req.body;

      const existingAdmin = await prisma.admin.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      if (existingAdmin) {
        return res.status(400).json({ message: 'Администратор с таким именем пользователя или электронной почтой уже существует' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const admin = await prisma.admin.create({
        data: {
          username,
          email,
          password: hashedPassword
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true
        }
      });

      res.status(201).json({ message: 'Администратор успешно создан', admin });
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

/**
 * @swagger
 * /api/auth/register/student:
 *   post:
 *     summary: Регистрация студента
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 example: "student1"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "student@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               studentId:
 *                 type: string
 *                 nullable: true
 *                 description: ID существующей записи студента для связи
 *                 example: "clx1234567890"
 *     responses:
 *       201:
 *         description: Студент успешно зарегистрирован
 *       400:
 *         description: Ошибка валидации или пользователь уже существует
 *       404:
 *         description: Студент с указанным ID не найден
 *       500:
 *         description: Внутренняя ошибка сервера
 */
// Регистрация студента
router.post('/register/student',
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Имя пользователя должно содержать не менее 3 символов'),
    body('email').isEmail().withMessage('Неверный адрес электронной почты'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов'),
    body('studentId').optional({ nullable: true, checkFalsy: true }).custom((value) => {
      // Разрешаем null, undefined, пустую строку или валидную строку
      if (value === null || value === undefined || value === '') {
        return true;
      }
      return typeof value === 'string';
    }).withMessage('ID студента должен быть строкой или пустым')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, studentId: rawStudentId } = req.body;
      
      // Нормализуем studentId: пустая строка, null или undefined становятся null
      const studentId = (rawStudentId && rawStudentId.trim() !== '') ? rawStudentId.trim() : null;

      // Проверка на существование пользователя в любой из таблиц
      const existingStudent = await prisma.studentUser.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      if (existingStudent) {
        return res.status(400).json({ message: 'Студент с таким именем пользователя или электронной почтой уже существует' });
      }

      // Проверка в других таблицах
      const existingAdmin = await prisma.admin.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      const existingTeacher = await prisma.teacher.findFirst({
        where: {
          OR: [{ username }, { email }]
        }
      });

      if (existingAdmin || existingTeacher) {
        return res.status(400).json({ message: 'Пользователь с таким именем пользователя или электронной почтой уже существует' });
      }

      // Если указан studentId, проверяем, что студент существует
      if (studentId) {
        const student = await prisma.student.findUnique({
          where: { id: studentId }
        });

        if (!student) {
          return res.status(404).json({ message: 'Студент с указанным ID не найден' });
        }

        // Проверяем, что для этого студента еще нет аккаунта
        const studentRecord = await prisma.student.findUnique({
          where: { id: studentId },
          select: { userId: true }
        });

        if (studentRecord?.userId) {
          return res.status(400).json({ message: 'Для этого студента уже создан аккаунт' });
        }
      }
      
      // Хэшируем пароль
      const hashedPassword = await bcrypt.hash(password, 10);

      // Генерируем telegramId, если он не предоставлен (используем уникальный ID на основе email/username)
      const telegramId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();

      const { studentUser, registrationApplication } = await prisma.$transaction(async (tx) => {
        const su = await tx.studentUser.create({
          data: {
            username: username.trim(),
            email: email.trim(),
            password: hashedPassword,
            telegramId,
            privacyAccepted: true,
            privacyAcceptedAt: now
          },
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
          }
        });

        if (studentId) {
          await tx.student.update({
            where: { id: studentId },
            data: { userId: su.id }
          });
          return { studentUser: su, registrationApplication: null };
        }

        const app = await tx.practiceApplication.create({
          data: {
            studentUserId: su.id,
            lastName: username.trim(),
            firstName: '',
            middleName: null,
            practiceType: 'EDUCATIONAL',
            institutionType: 'EDUCATIONAL_INSTITUTION',
            institutionName: 'Не указано',
            course: null,
            email: email.trim(),
            phone: '—',
            telegramId: null,
            startDate: null,
            endDate: null,
            status: 'PENDING',
            notes:
              'Заявка создана при регистрации на сайте. При одобрении уточните ФИО, вуз и период практики при необходимости.',
            privacyAccepted: true,
            privacyAcceptedAt: now
          },
          select: { id: true }
        });

        return { studentUser: su, registrationApplication: app };
      });

      if (registrationApplication?.id) {
        notifyAdminsAboutNewApplication(registrationApplication.id).catch((err) => {
          console.error('Не удалось уведомить администраторов о заявке после регистрации:', err);
        });
      }

      const message = studentId
        ? 'Студент успешно зарегистрирован'
        : 'Аккаунт создан. Заявка на практику отправлена на рассмотрение; войти в систему можно после одобрения администратором.';

      res.status(201).json({ message, student: studentUser });
    } catch (error) {
      console.error('Ошибка регистрации студента:', error);
      
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'поле';
        return res.status(400).json({ 
          message: `Пользователь с таким ${field === 'username' ? 'именем пользователя' : field === 'email' ? 'email' : field === 'studentId' ? 'ID студента' : field} уже существует` 
        });
      }
      
      res.status(500).json({ 
        message: error.message || 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               role:
 *                 type: string
 *                 enum: [admin, teacher, student]
 *                 description: Опциональная роль для ускорения поиска пользователя
 *                 example: "admin"
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT токен для аутентификации
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [admin, teacher, student]
 *       401:
 *         description: Неверные учетные данные
 *       400:
 *         description: Ошибка валидации
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.post('/login',
  [
    body('username').notEmpty().withMessage('Требуется имя пользователя'),
    body('password').notEmpty().withMessage('Требуется ввести пароль'),
    body('role').optional({ nullable: true, checkFalsy: true }).isIn(['admin', 'teacher', 'student']).withMessage('Неверная роль')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const rawUsername = (req.body.username || '').trim();
      const password = req.body.password;
      const role = req.body.role;
      const login = rawUsername;
      const loginLower = login.toLowerCase();

      let user = null;
      let userRole = null;
      let userData = null;

      // Регистронечувствительный поиск (SQLite '=' чувствителен к регистру),
      // плюс позволяет вход и по username, и по email.
      const matches = (a, b) => (a || '').toString().trim().toLowerCase() === (b || '').toString().trim().toLowerCase();

      const findAdmin = async () => {
        const candidates = await prisma.admin.findMany({
          where: { OR: [{ username: login }, { email: login }] }
        });
        if (candidates.length) return candidates[0];
        const all = await prisma.admin.findMany();
        return all.find((u) => matches(u.username, login) || matches(u.email, login)) || null;
      };

      const findTeacher = async () => {
        const candidates = await prisma.teacher.findMany({
          where: { OR: [{ username: login }, { email: login }] }
        });
        if (candidates.length) return candidates[0];
        const all = await prisma.teacher.findMany();
        return all.find((u) => matches(u.username, login) || matches(u.email, login)) || null;
      };

      const findStudent = async () => {
        const candidates = await prisma.studentUser.findMany({
          where: { OR: [{ username: login }, { email: login }] },
          include: { student: { select: { id: true } } }
        });
        if (candidates.length) return candidates[0];
        const all = await prisma.studentUser.findMany({
          include: { student: { select: { id: true } } }
        });
        return all.find((u) => matches(u.username, login) || matches(u.email, login)) || null;
      };

      const buildAdminData = (u) => ({ id: u.id, username: u.username, email: u.email, role: 'admin' });
      const buildTeacherData = (u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        middleName: u.middleName,
        phone: u.phone,
        role: 'teacher'
      });
      const buildStudentData = (u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: 'student',
        studentId: u.student?.id || null
      });

      if (role === 'admin') {
        user = await findAdmin();
        if (user) { userRole = 'admin'; userData = buildAdminData(user); }
      } else if (role === 'teacher') {
        user = await findTeacher();
        if (user) { userRole = 'teacher'; userData = buildTeacherData(user); }
      } else if (role === 'student') {
        if (!login) {
          return res.status(400).json({ message: 'Имя пользователя обязательно' });
        }
        user = await findStudent();
        if (user) { userRole = 'student'; userData = buildStudentData(user); }
      } else {
        user = await findAdmin();
        if (user) { userRole = 'admin'; userData = buildAdminData(user); }
        else {
          user = await findTeacher();
          if (user) { userRole = 'teacher'; userData = buildTeacherData(user); }
          else {
            user = await findStudent();
            if (user) { userRole = 'student'; userData = buildStudentData(user); }
          }
        }
      }

      console.log('Login attempt:', { login, foundRole: userRole, foundId: user?.id || null });

      if (!user) {
        console.error('Пользователь не найден:', { login, role });
        return res.status(401).json({ message: 'Неверные учетные данные' });
      }
      
      // Проверяем, что у пользователя есть пароль
      if (!user.password) {
        console.error('У пользователя отсутствует пароль:', { userId: user.id, username: user.username, email: user.email });
        return res.status(401).json({ message: 'Ошибка аутентификации: пароль не установлен' });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        console.error('Неверный пароль для пользователя:', { userId: user.id, username: user.username, email: user.email });
        return res.status(401).json({ message: 'Неверные учетные данные' });
      }

      if (userRole === 'student' && !user.student?.id) {
        const gate = await getStudentGateCodeIfBlocked(user.id);
        if (gate === 'NOT_FOUND') {
          return res.status(401).json({ message: 'Неверные учетные данные' });
        }
        if (gate) {
          return res.status(403).json({
            message: STUDENT_GATE_MESSAGES.login[gate],
            code: gate
          });
        }
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username || user.email || user.id, // Используем email или id, если username отсутствует
          role: userRole 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        token,
        user: userData
      });
    } catch (error) {
      console.error('Ошибка входа в систему:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      res.status(500).json({ 
        message: 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
);

router.post(
  '/set-password-direct',
  [
    body('login').trim().notEmpty().withMessage('Укажите имя пользователя или email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Пароли не совпадают')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const login = String(req.body.login || '').trim();
      const password = req.body.password;
      const matches = (a, b) =>
        (a || '').toString().trim().toLowerCase() === (b || '').toString().trim().toLowerCase();

      const findAdmin = async () => {
        const candidates = await prisma.admin.findMany({
          where: { OR: [{ username: login }, { email: login }] }
        });
        if (candidates.length) return candidates[0];
        const all = await prisma.admin.findMany();
        return all.find((u) => matches(u.username, login) || matches(u.email, login)) || null;
      };

      const findTeacher = async () => {
        const candidates = await prisma.teacher.findMany({
          where: { OR: [{ username: login }, { email: login }] }
        });
        if (candidates.length) return candidates[0];
        const all = await prisma.teacher.findMany();
        return all.find((u) => matches(u.username, login) || matches(u.email, login)) || null;
      };

      const findStudent = async () => {
        const candidates = await prisma.studentUser.findMany({
          where: { OR: [{ username: login }, { email: login }] },
          include: { student: { select: { id: true } } }
        });
        if (candidates.length) return candidates[0];
        const all = await prisma.studentUser.findMany({
          include: { student: { select: { id: true } } }
        });
        return all.find((u) => matches(u.username, login) || matches(u.email, login)) || null;
      };

      let user = await findAdmin();
      let userRole = user ? 'admin' : null;
      if (!user) {
        user = await findTeacher();
        userRole = user ? 'teacher' : null;
      }
      if (!user) {
        user = await findStudent();
        userRole = user ? 'student' : null;
      }

      if (!user) {
        return res.status(400).json({
          message: 'Учётная запись не найдена. Проверьте имя пользователя или email.'
        });
      }

      if (userRole === 'student') {
        const gate = await getStudentGateCodeIfBlocked(user.id);
        if (gate === 'NOT_FOUND') {
          return res.status(400).json({ message: 'Учётная запись не найдена.' });
        }
        if (gate) {
          return res.status(403).json({
            message: STUDENT_GATE_MESSAGES.password[gate],
            code: gate
          });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      if (userRole === 'admin') {
        await prisma.admin.update({ where: { id: user.id }, data: { password: hashedPassword } });
      } else if (userRole === 'teacher') {
        await prisma.teacher.update({ where: { id: user.id }, data: { password: hashedPassword } });
      } else {
        await prisma.studentUser.update({ where: { id: user.id }, data: { password: hashedPassword } });
      }

      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, role: userRole }
      });

      return res.json({
        message: 'Пароль успешно изменён. Теперь можно войти с новым паролем.'
      });
    } catch (error) {
      console.error('Ошибка set-password-direct:', error);
      return res.status(500).json({
        message: 'Не удалось сменить пароль. Попробуйте позже.',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
);

router.post(
  '/forgot-password',
  [body('email').trim().isEmail().withMessage('Укажите корректный email')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const email = req.body.email;
      const account = await findAccountByEmail(email);

      const genericMessage =
        'Если указанный email зарегистрирован в системе, на него отправлены инструкции по восстановлению пароля.';

      if (!account) {
        return res.json({ message: genericMessage });
      }

      const { id: userId, role } = account;
      if (!['admin', 'teacher', 'student'].includes(role)) {
        return res.json({ message: genericMessage });
      }

      const toEmail = await getEmailForAccount(userId, role);
      if (!toEmail) {
        return res.json({ message: genericMessage });
      }

      if (role === 'student') {
        const gate = await getStudentGateCodeIfBlocked(userId);
        if (gate === 'NOT_FOUND') {
          return res.json({ message: genericMessage });
        }
        if (gate) {
          return res.status(403).json({
            message: STUDENT_GATE_MESSAGES.password[gate],
            code: gate
          });
        }
      }

      await prisma.passwordResetToken.deleteMany({
        where: { userId, role }
      });

      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await prisma.passwordResetToken.create({
        data: { tokenHash, userId, role, expiresAt }
      });

      const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;

      const mailResult = await sendPasswordResetEmail(toEmail, resetUrl);

      if (mailResult.sent) {
        console.log(`[auth] Сброс пароля: письмо отправлено на ${toEmail}`);
      } else {
        console.warn(
          `[auth] Сброс пароля для ${toEmail}: SMTP не настроен или ошибка отправки. Ссылка (действует 1 ч): ${resetUrl}`
        );
      }

      const payload = { message: genericMessage };

      if (process.env.NODE_ENV === 'development' && !mailResult.sent) {
        payload.devResetUrl = resetUrl;
        payload.devHint =
          'В режиме разработки ссылка также возвращается в ответе API (поле devResetUrl), так как письмо не отправлено.';
      }

      return res.json(payload);
    } catch (error) {
      console.error('Ошибка forgot-password:', error);
      return res.status(500).json({
        message: 'Не удалось обработать запрос. Попробуйте позже.',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
);

router.post(
  '/reset-password',
  [
    body('token').trim().notEmpty().withMessage('Требуется токен'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const rawToken = String(req.body.token || '').trim();
      const password = req.body.password;
      const tokenHash = hashResetToken(rawToken);

      const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash }
      });

      if (!record || record.expiresAt < new Date()) {
        return res.status(400).json({
          message: 'Ссылка недействительна или истекла. Запросите восстановление пароля снова.'
        });
      }

      const { userId, role } = record;

      if (role === 'student') {
        const gate = await getStudentGateCodeIfBlocked(userId);
        if (gate === 'NOT_FOUND') {
          return res.status(400).json({
            message: 'Ссылка недействительна или истекла. Запросите восстановление пароля снова.'
          });
        }
        if (gate) {
          await prisma.passwordResetToken.deleteMany({ where: { userId, role } });
          return res.status(403).json({
            message: STUDENT_GATE_MESSAGES.password[gate],
            code: gate
          });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      if (role === 'admin') {
        await prisma.admin.update({ where: { id: userId }, data: { password: hashedPassword } });
      } else if (role === 'teacher') {
        await prisma.teacher.update({ where: { id: userId }, data: { password: hashedPassword } });
      } else if (role === 'student') {
        await prisma.studentUser.update({ where: { id: userId }, data: { password: hashedPassword } });
      } else {
        return res.status(400).json({ message: 'Некорректный тип учётной записи' });
      }

      await prisma.passwordResetToken.deleteMany({ where: { userId, role } });

      return res.json({ message: 'Пароль успешно изменён. Теперь можно войти с новым паролем.' });
    } catch (error) {
      console.error('Ошибка reset-password:', error);
      return res.status(500).json({
        message: 'Не удалось сменить пароль. Попробуйте позже.',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
);

router.put(
  '/profile',
  authenticateToken,
  [
    body('username')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 3 })
      .withMessage('Имя пользователя должно содержать не менее 3 символов'),
    body('email')
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage('Неверный адрес электронной почты'),
    body('firstName')
      .optional({ checkFalsy: true })
      .trim()
      .notEmpty()
      .withMessage('Имя не может быть пустым'),
    body('lastName')
      .optional({ checkFalsy: true })
      .trim()
      .notEmpty()
      .withMessage('Фамилия не может быть пустой'),
    body('middleName').optional({ checkFalsy: true }).trim(),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage('Пароль должен содержать не менее 6 символов')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id, role } = req.user;

      if (!['admin', 'teacher', 'student'].includes(role)) {
        return res.status(403).json({ message: 'Недостаточно прав' });
      }

      let currentUser = null;
      if (role === 'admin') {
        currentUser = await prisma.admin.findUnique({ where: { id } });
      } else if (role === 'teacher') {
        currentUser = await prisma.teacher.findUnique({ where: { id } });
      } else {
        currentUser = await prisma.studentUser.findUnique({ where: { id } });
      }

      if (!currentUser) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      const username = req.body.username?.trim();
      const email = req.body.email?.trim();
      const password = req.body.password;

      if (username && username !== currentUser.username) {
        const [adminWithUsername, teacherWithUsername, studentWithUsername] = await Promise.all([
          prisma.admin.findFirst({ where: { username } }),
          prisma.teacher.findFirst({ where: { username } }),
          prisma.studentUser.findFirst({ where: { username } })
        ]);

        const usernameTaken =
          (adminWithUsername && !(role === 'admin' && adminWithUsername.id === id)) ||
          (teacherWithUsername && !(role === 'teacher' && teacherWithUsername.id === id)) ||
          (studentWithUsername && !(role === 'student' && studentWithUsername.id === id));

        if (usernameTaken) {
          return res.status(400).json({ message: 'Имя пользователя уже занято' });
        }
      }

      if (email && email !== currentUser.email) {
        const [adminWithEmail, teacherWithEmail, studentWithEmail] = await Promise.all([
          prisma.admin.findFirst({ where: { email } }),
          prisma.teacher.findFirst({ where: { email } }),
          prisma.studentUser.findFirst({ where: { email } })
        ]);

        const emailTaken =
          (adminWithEmail && !(role === 'admin' && adminWithEmail.id === id)) ||
          (teacherWithEmail && !(role === 'teacher' && teacherWithEmail.id === id)) ||
          (studentWithEmail && !(role === 'student' && studentWithEmail.id === id));

        if (emailTaken) {
          return res.status(400).json({ message: 'Email уже занят' });
        }
      }

      const updateData = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      if (role === 'teacher') {
        if (req.body.firstName !== undefined) updateData.firstName = req.body.firstName?.trim();
        if (req.body.lastName !== undefined) updateData.lastName = req.body.lastName?.trim();
        if (req.body.middleName !== undefined) {
          const middleName = req.body.middleName?.trim();
          updateData.middleName = middleName || null;
        }
        const teacherPhone = String(req.body.phone ?? '').trim();
        if (!teacherPhone) {
          return res.status(400).json({ message: 'Укажите телефон' });
        }
        updateData.phone = teacherPhone;
      }

      let updatedUser;
      if (role === 'admin') {
        updatedUser = await prisma.admin.update({
          where: { id },
          data: updateData,
          select: { id: true, username: true, email: true, createdAt: true }
        });
      } else if (role === 'teacher') {
        updatedUser = await prisma.teacher.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            createdAt: true
          }
        });
      } else {
        const linkedStudent = await prisma.student.findUnique({ where: { userId: id } });
        if (linkedStudent) {
          if (
            req.body.studentPractice &&
            typeof req.body.studentPractice === 'object' &&
            !Array.isArray(req.body.studentPractice)
          ) {
            const r = await applyStudentPracticeSelfUpdateFromBody(id, req.body.studentPractice);
            if (!r.ok) {
              return res.status(r.status).json({ message: r.message });
            }
          } else if (req.body.phone !== undefined) {
            const phoneVal = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
            if (!phoneVal) {
              return res.status(400).json({ message: 'Укажите телефон' });
            }
            await prisma.student.update({
              where: { id: linkedStudent.id },
              data: { phone: phoneVal }
            });
          }
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.studentUser.update({
            where: { id },
            data: updateData,
            select: { id: true, username: true, email: true, createdAt: true }
          });
        }

        const full = await prisma.studentUser.findUnique({
          where: { id },
          include: {
            student: {
              include: {
                institution: { select: { id: true, name: true } }
              }
            }
          }
        });

        return res.json({
          message: 'Профиль успешно обновлен',
          user: serializeStudentUserForClient(full)
        });
      }

      res.json({
        message: 'Профиль успешно обновлен',
        user: {
          ...updatedUser,
          role
        }
      });
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      res.status(500).json({
        message: 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
);
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить информацию о текущем пользователе
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Информация о пользователе
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [admin, teacher, student]
 *       401:
 *         description: Не авторизован или токен недействителен
 *       404:
 *         description: Пользователь не найден
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Требуется токен доступа' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const role = decoded.role || 'admin';
    
    let user = null;
    let userData = null;

    if (role === 'admin') {
      user = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true
        }
      });
      if (user) {
        userData = { ...user, role: 'admin' };
      }
    } else if (role === 'teacher') {
      user = await prisma.teacher.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          middleName: true,
          phone: true,
          createdAt: true
        }
      });
      if (user) {
        userData = { ...user, role: 'teacher' };
      }
    } else if (role === 'student') {
      user = await prisma.studentUser.findUnique({
        where: { id: decoded.id },
        include: {
          student: {
            include: {
              institution: { select: { id: true, name: true } }
            }
          }
        }
      });
      if (user) {
        userData = serializeStudentUserForClient(user);
      }
    } else {
      // Обратная совместимость - ищем как админа
      user = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true
        }
      });
      if (user) {
        userData = { ...user, role: 'admin' };
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json({ user: userData });
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Недействительный или просроченный токен' });
    }
    console.error('Ошибка /auth/me:', error);
    return res.status(500).json({
      message: 'Внутренняя ошибка сервера',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});
export default router;

