import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { PrismaClient } from '@prisma/client';
import studentRoutes from './routes/students.js';
import institutionRoutes from './routes/institutions.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import applicationRoutes from './routes/applications.js';
import notificationRoutes from './routes/notifications.js';
import taskRoutes from './routes/tasks.js';
import courseRoutes from './routes/courses.js';
import courseMaterialRoutes from './routes/courseMaterials.js';
import courseEnrollmentRoutes from './routes/courseEnrollments.js';
import courseChatRoutes from './routes/courseChat.js';
import teacherRoutes from './routes/teachers.js';
import webinarRoutes from './routes/webinars.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin === FRONTEND_URL || origin.startsWith('file://')) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    callback(new Error('Запрещено CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger документация
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'PracticeHub API Documentation'
}));

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Проверка состояния API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API запущено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: PracticeHub API запущен
 */
app.get('/api/health', (req, res) => {
res.json({ status: 'ok', message: 'PracticeHub API запущен' });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/course-materials', courseMaterialRoutes);
app.use('/api/course-enrollments', courseEnrollmentRoutes);
app.use('/api/course-chat', courseChatRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/webinars', webinarRoutes);


app.use(express.static(path.join(__dirname, '../public')));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Внутренняя ошибка сервера',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Маршрут не найден' });
});

app.listen(PORT, async () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  
  // Запускаем Telegram-бота (только если токен установлен)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const botModule = await import('./bot/telegramBot.js');
      // Бот инициализируется автоматически при импорте модуля
      console.log('✅ Telegram-бот модуль загружен');
    } catch (error) {
      console.error('❌ Ошибка запуска Telegram-бота:', error.message);
      console.error('Детали:', error);
    }
  } else {
    console.log('⚠️ Telegram-бот не запущен (TELEGRAM_BOT_TOKEN не установлен)');
  }
});

// Обработка необработанных ошибок промисов (чтобы ошибки бота не падали сервер)
process.on('unhandledRejection', (reason, promise) => {
  if (reason && typeof reason === 'object' && reason.code === 'ETELEGRAM') {
    const error = reason;
    if (error.response?.body?.description?.includes('blocked')) {
      console.warn('⚠️ Telegram бот заблокирован пользователем, игнорируем ошибку');
      return;
    }
  }
  console.error('❌ Необработанная ошибка промиса:', reason);
  // Не завершаем процесс, чтобы сервер продолжал работать
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

