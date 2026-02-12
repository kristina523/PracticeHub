import express from 'express';
import bcrypt from 'bcryptjs'; 
import jwt from 'jsonwebtoken'; 
import { PrismaClient } from '@prisma/client'; 
import { body, validationResult } from 'express-validator';

const router = express.Router();
const prisma = new PrismaClient();

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
        const existingStudent = await prisma.student.findUnique({
          where: { id: studentId },
          select: { userId: true }
        });
        
        if (existingStudent && existingStudent.userId) {
          return res.status(400).json({ message: 'Для этого студента уже создан аккаунт' });
        }

        if (existingStudentUser) {
          return res.status(400).json({ message: 'Для этого студента уже создан аккаунт' });
        }
      }
      
      // Хэшируем пароль
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Генерируем telegramId, если он не предоставлен (используем уникальный ID на основе email/username)
      const telegramId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Создаем StudentUser
      const studentUser = await prisma.studentUser.create({
        data: {
          username: username.trim(),
          email: email.trim(),
          password: hashedPassword,
          telegramId: telegramId
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true
        }
      });
      
      // Если указан studentId, связываем StudentUser со Student
      if (studentId) {
        await prisma.student.update({
          where: { id: studentId },
          data: { userId: studentUser.id }
        });
      }

      res.status(201).json({ message: 'Студент успешно зарегистрирован', student: studentUser });
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
router.post('/login',
  [
    body('username').notEmpty().withMessage('Требуется имя пользователя'),
    body('password').notEmpty().withMessage('Требуется ввести пароль'),
    body('role').optional().isIn(['admin', 'teacher', 'student']).withMessage('Неверная роль')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password, role } = req.body;
      
      let user = null;
      let userRole = null;
      let userData = null;

      // Если указана роль, ищем только в соответствующей таблице
      if (role === 'admin') {
        user = await prisma.admin.findUnique({ where: { username } });
        if (user) {
          userRole = 'admin';
          userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: 'admin'
          };
        }
      } else if (role === 'teacher') {
        user = await prisma.teacher.findUnique({ where: { username } });
        if (user) {
          userRole = 'teacher';
          userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            middleName: user.middleName,
            phone: user.phone,
            role: 'teacher'
          };
        }
      } else if (role === 'student') {
        // Ищем студента по username или email, так как оба поля опциональные
        console.log('Поиск студента:', { username, role });
        
        // Строим условие поиска, исключая null значения
        const whereConditions = [];
        if (username) {
          whereConditions.push({ username: username });
          whereConditions.push({ email: username });
        }
        
        if (whereConditions.length === 0) {
          console.error('Username не указан для поиска студента');
          return res.status(400).json({ message: 'Имя пользователя обязательно' });
        }
        
        user = await prisma.studentUser.findFirst({
          where: {
            OR: whereConditions
          },
          include: {
            student: {
              select: {
                id: true
              }
            }
          }
        });
        console.log('Найден студент:', user ? { id: user.id, username: user.username, email: user.email, hasPassword: !!user.password } : null);
        if (user) {
          userRole = 'student';
          userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: 'student',
            studentId: user.student?.id || null
          };
        }
      } else {
        // Если роль не указана, ищем во всех таблицах
        user = await prisma.admin.findUnique({ where: { username } });
        if (user) {
          userRole = 'admin';
          userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: 'admin'
          };
        } else {
          user = await prisma.teacher.findUnique({ where: { username } });
          if (user) {
            userRole = 'teacher';
            userData = {
              id: user.id,
              username: user.username,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              middleName: user.middleName,
              phone: user.phone,
              role: 'teacher'
            };
          } else {
            // Ищем студента по username или email
            user = await prisma.studentUser.findFirst({
              where: {
                OR: [
                  { username: username },
                  { email: username } // Позволяем вводить email вместо username
                ]
              },
              include: {
                student: {
                  select: {
                    id: true
                  }
                }
              }
            });
            if (user) {
              userRole = 'student';
              userData = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: 'student',
                studentId: user.student?.id || null
              };
            }
          }
        }
      }

      if (!user) {
        console.error('Пользователь не найден:', { username, role });
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
            select: {
              id: true
            }
          }
        }
      });
      if (user) {
        userData = { 
          id: user.id,
          username: user.username,
          email: user.email,
          role: 'student',
          studentId: user.student?.id || null,
          createdAt: user.createdAt
        };
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
    res.status(401).json({ message: 'Недействительный или просроченный токен' });
  }
});
export default router;

