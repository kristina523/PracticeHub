import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const token = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;
let botInfo = null;
let pollingRestartCount = 0;
let lastPollingError = null;
const MAX_POLLING_RESTARTS = 5; // Максимальное количество перезапусков подряд
const POLLING_RESTART_DELAY = 30000; // Задержка перед перезапуском (30 секунд)

// Функция инициализации бота
async function initializeBot() {
  if (!token) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN не установлен, бот не будет работать');
    return false;
  }

  try {
    console.log('🔄 Инициализация Telegram-бота...');
    console.log(`📝 Токен: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);
    

    bot = new TelegramBot(token, { 
      polling: {
        interval: 300, 
        autoStart: false,  
        params: {
          timeout: 30   // Увеличиваем таймаут для запросов
        }
      },
      request: {
        agentOptions: {
          keepAlive: true,
          keepAliveMsecs: 10000
        },
        timeout: 30000  // Таймаут для HTTP запросов
      }
    });
    

    console.log('🔍 Проверка подключения к Telegram API...');
    try {
      // Увеличиваем таймаут до 30 секунд и добавляем опции для getMe
      const getMePromise = bot.getMe();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут подключения к Telegram API (30 секунд)')), 30000)
      );
      
      botInfo = await Promise.race([getMePromise, timeoutPromise]);
      console.log(`✅ Telegram-бот подключен: @${botInfo.username}`);
      console.log(`🔗 Ссылка на бота: https://t.me/${botInfo.username}`);
    } catch (getMeError) {
      console.error('❌ Ошибка получения информации о боте:', getMeError.message);
      if (getMeError.response) {
        console.error('Ответ Telegram API:', getMeError.response.body || getMeError.response);
      }
      // Если это таймаут или сетевая ошибка, не прерываем работу сервера
      if (getMeError.message.includes('Таймаут') || getMeError.code === 'ETIMEDOUT' || getMeError.code === 'ECONNREFUSED') {
        console.warn('⚠️ Telegram API недоступен, но сервер продолжит работу без бота');
        console.warn('💡 Проверьте интернет-соединение и доступность Telegram API');
        bot = null;
        return false;
      }
      throw getMeError;
    }
    
    // Регистрируем обработчики ДО запуска polling
    console.log('📝 Регистрация обработчиков...');
    registerBotHandlers();
    
    // Теперь запускаем polling
    console.log('📡 Запуск polling...');
    try {
      await bot.startPolling();
      console.log('✅ Polling активен, бот готов к работе');
    } catch (pollingError) {
      console.error('❌ Ошибка запуска polling:', pollingError.message);
      throw pollingError;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка инициализации Telegram-бота:', error.message);
    console.error('Тип ошибки:', error.constructor.name);
    console.error('Код ошибки:', error.code);
    
    if (error.response) {
      console.error('Ответ API:', error.response.body || error.response);
    }
    
    if (error.stack) {
      console.error('Стек ошибки (первые 1000 символов):', error.stack.substring(0, 1000));
    }
    
    // Пытаемся остановить polling, если он был запущен
    if (bot) {
      try {
        await bot.stopPolling();
      } catch (stopError) {
        // Игнорируем ошибку остановки
      }
    }
    
    bot = null;
    return false;
  }
}

// Регистрация обработчиков бота
function registerBotHandlers() {
  if (!bot) {
    console.error('❌ Бот не инициализирован, обработчики не зарегистрированы');
    return;
  }

  console.log('📝 Регистрация обработчиков бота...');

    bot.on('polling_error', (error) => {
      const errorMessage = error.message || error.toString();
      const errorCode = error.code || '';
      
      // Игнорируем таймауты и сетевые ошибки - они не критичны
      if (errorCode === 'ESOCKETTIMEDOUT' || errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
        // Просто логируем, но не перезапускаем
        console.warn('⚠️ Таймаут Telegram API (не критично):', errorMessage);
        return;
      }
      
      // Для других критических ошибок
      if (errorCode === 'EFATAL') {
        // Проверяем, не слишком ли часто происходят ошибки
        const now = Date.now();
        if (lastPollingError && (now - lastPollingError) < 60000) {
          pollingRestartCount++;
        } else {
          pollingRestartCount = 1;
        }
        lastPollingError = now;
        
        if (pollingRestartCount > MAX_POLLING_RESTARTS) {
          console.error(`❌ Превышено максимальное количество перезапусков (${MAX_POLLING_RESTARTS}). Останавливаем polling.`);
          console.error('💡 Проверьте интернет-соединение и доступность Telegram API');
          if (bot) {
            bot.stopPolling().catch(() => {});
          }
          return;
        }
        
        console.error(`❌ Критическая ошибка polling (попытка ${pollingRestartCount}/${MAX_POLLING_RESTARTS}):`, errorMessage);
        console.log(`⏳ Перезапуск через ${POLLING_RESTART_DELAY / 1000} секунд...`);
        
      setTimeout(async () => {
          if (bot) {
          try {
            await bot.stopPolling();
              await new Promise(resolve => setTimeout(resolve, 2000)); // Небольшая задержка перед перезапуском
            await bot.startPolling();
              console.log('🔄 Polling перезапущен');
              // Сбрасываем счетчик после успешного перезапуска
              pollingRestartCount = 0;
          } catch (err) {
              console.error('❌ Ошибка перезапуска polling:', err.message || err);
          }
          }
        }, POLLING_RESTART_DELAY);
      } else {
        // Для некритических ошибок просто логируем
        console.warn('⚠️ Ошибка polling Telegram бота:', errorMessage);
      }
    });
    
  bot.on('error', (error) => {
    console.error('❌ Общая ошибка Telegram бота:', error.message || error);
    // Не падаем сервер при ошибках бота
    if (error.code === 'ETELEGRAM' && error.response?.body?.description?.includes('blocked')) {
      console.warn('⚠️ Бот заблокирован пользователем, игнорируем ошибку');
      return;
    }
  });
  
  // Обработка необработанных ошибок промисов в обработчиках бота
  process.on('unhandledRejection', (reason, promise) => {
    if (reason && typeof reason === 'object' && reason.code === 'ETELEGRAM') {
      const error = reason;
      if (error.response?.body?.description?.includes('blocked')) {
        console.warn('⚠️ Необработанная ошибка бота (заблокирован пользователем), игнорируем');
        return;
      }
    }
    console.error('❌ Необработанная ошибка промиса:', reason);
  });

  // Регистрируем обработчики команд
  registerCommandHandlers();
  
  console.log('✅ Все обработчики зарегистрированы');
}

const userStates = new Map();

const RegistrationState = {
  IDLE: 'idle',
  WAITING_PRIVACY_CONSENT: 'waiting_privacy_consent',
  WAITING_FIRST_NAME: 'waiting_first_name',
  WAITING_LAST_NAME: 'waiting_last_name',
  WAITING_MIDDLE_NAME: 'waiting_middle_name',
  WAITING_PRACTICE_TYPE: 'waiting_practice_type',
  WAITING_INSTITUTION_TYPE: 'waiting_institution_type',
  WAITING_INSTITUTION_NAME: 'waiting_institution_name',
  WAITING_COURSE: 'waiting_course',
  WAITING_EMAIL: 'waiting_email',
  WAITING_PHONE: 'waiting_phone',
  WAITING_START_DATE: 'waiting_start_date',
  WAITING_END_DATE: 'waiting_end_date',
  CONFIRMING: 'confirming'
};

const EditState = {
  IDLE: 'idle',
  WAITING_FIELD: 'waiting_field',
  WAITING_VALUE: 'waiting_value'
};

const TaskSubmissionState = {
  IDLE: 'idle',
  WAITING_SOLUTION: 'waiting_solution'
};

const TaskCreationState = {
  IDLE: 'idle',
  WAITING_STUDENT: 'waiting_student',
  WAITING_TITLE: 'waiting_title',
  WAITING_DESCRIPTION: 'waiting_description',
  WAITING_DEADLINE: 'waiting_deadline',
  WAITING_REFERENCE_LINK: 'waiting_reference_link',
  CONFIRMING: 'confirming'
};

const practiceTypes = [
  { text: 'Учебная', callback_data: 'EDUCATIONAL' },
  { text: 'Производственная', callback_data: 'PRODUCTION' },
  { text: 'Стажировка', callback_data: 'INTERNSHIP' }
];

const institutionTypes = [
  { text: 'Колледж', callback_data: 'COLLEGE' },
  { text: 'Университет', callback_data: 'UNIVERSITY' }
];

const practiceTypeNames = {
  EDUCATIONAL: 'Учебная',
  PRODUCTION: 'Производственная',
  INTERNSHIP: 'Стажировка'
};

const institutionTypeNames = {
  COLLEGE: 'Колледж',
  UNIVERSITY: 'Университет'
};

const SUPPORT_CONTACTS = process.env.SUPPORT_CONTACTS || 'Email: support@practicehub.local\nТелефон: +7 (999) 123-45-67';
const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_CHAT_ID || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

function initUserState(chatId) {
  if (!userStates.has(chatId)) {
    userStates.set(chatId, {
      state: RegistrationState.IDLE,
      data: {}
    });
  }
  return userStates.get(chatId);
}

function clearUserState(chatId) {
  userStates.delete(chatId);
}

function getMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '📝 Зарегистрироваться на практику' }],
        [{ text: 'ℹ️ Информация' }, { text: '📞 Контакты' }]
      ],
      resize_keyboard: true
    }
  };
}

function getRegisteredMenu() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '📅 Моя практика' }, { text: '📋 Задания' }],
        [{ text: '✏️ Редактировать данные' }, { text: '🔔 Уведомления' }],
        [{ text: 'ℹ️ Информация' }, { text: '📞 Контакты' }]
      ],
      resize_keyboard: true
    }
  };
}

async function getMenuForChat(chatId) {
  const registered = await isUserRegistered(chatId.toString());
  return registered ? getRegisteredMenu() : getMainMenu();
}

async function isUserRegistered(telegramId) {
  try {
    const studentUser = await prisma.studentUser.findFirst({
      where: { telegramId: telegramId.toString() }
    });
    return !!studentUser;
  } catch (error) {
    console.error('Ошибка проверки регистрации:', error);
    return false;
  }
}

async function getStudentPractice(telegramId) {
  try {
    console.log('Получение информации о практике для telegramId:', telegramId);
    
    const studentUser = await prisma.studentUser.findFirst({
      where: { telegramId: telegramId.toString() },
      include: {
        applications: {
          where: {
            status: { in: ['PENDING', 'APPROVED'] }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!studentUser) {
      console.log('StudentUser не найден для telegramId:', telegramId);
      return null;
    }

    console.log('Найден StudentUser:', studentUser.id, 'Заявок:', studentUser.applications.length);

    const approvedApplication = studentUser.applications.find(app => app.status === 'APPROVED');
    
    if (approvedApplication) {
      console.log('Найдена одобренная заявка:', approvedApplication.id);
      
      if (studentUser.student) {
        console.log('Ищем студента с ID:', studentUser.student.id);
        try {
          const student = await prisma.student.findUnique({
            where: { id: studentUser.student.id },
            include: {
              institution: true
            }
          });
          
          if (student) {
            console.log('Найден студент:', student.id);
            return { type: 'student', data: student, application: approvedApplication };
          } else {
            console.log('Студент не найден с ID:', studentUser.studentId, '- показываем заявку');
            return { type: 'pending', data: approvedApplication };
          }
        } catch (studentError) {
          console.error('Ошибка получения студента:', studentError);
          return { type: 'pending', data: approvedApplication };
        }
      } else {
        console.log('studentId null - показываем одобренную заявку');
        return { type: 'pending', data: approvedApplication };
      }
    }

    const pendingApplication = studentUser.applications.find(app => app.status === 'PENDING');
    if (pendingApplication) {
      console.log('Найдена заявка на рассмотрении:', pendingApplication.id);
      return { type: 'pending', data: pendingApplication };
    }
    
    const allApplications = await prisma.practiceApplication.findMany({
      where: { studentUserId: studentUser.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log('Все заявки пользователя:', allApplications.map(a => ({ id: a.id, status: a.status })));

    console.log('Пользователь зарегистрирован, но нет активных заявок');
    return { type: 'registered', data: null };
  } catch (error) {
    console.error('Ошибка получения информации о практике:', error);
    console.error('Детали ошибки:', {
      code: error.code,
      meta: error.meta,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    return null;
  }
}

function formatDate(date) {
  try {
    if (!date) {
      console.warn('formatDate: date is null or undefined');
      return 'Не указано';
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      console.warn('formatDate: invalid date:', date);
      return 'Неверная дата';
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch (error) {
    console.error('Ошибка форматирования даты:', error, 'date:', date);
    return 'Ошибка даты';
  }
}

function calculateDaysRemaining(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// Функция для экранирования специальных символов Markdown
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

function formatPracticeInfo(practiceData) {
  try {
    console.log('formatPracticeInfo вызвана с practiceData:', JSON.stringify(practiceData, null, 2));
    
    if (!practiceData) {
      console.log('formatPracticeInfo: practiceData is null');
      return null;
    }

    console.log('formatPracticeInfo: тип данных:', practiceData.type);

    if (practiceData.type === 'pending') {
      const app = practiceData.data;
      console.log('formatPracticeInfo: pending application data:', app ? 'exists' : 'null');
      
      if (!app) {
        console.log('formatPracticeInfo: pending application data is null');
        return null;
      }
      
      const practiceTypeNames = {
        EDUCATIONAL: 'Учебная',
        PRODUCTION: 'Производственная',
        INTERNSHIP: 'Стажировка'
      };
      
      try {
        let statusText = 'Ожидает рассмотрения';
        let statusMessage = 'Ваша заявка находится на рассмотрении у администратора. Вы получите уведомление о результате.';
        
        if (app.status === 'APPROVED') {
          statusText = '✅ Одобрена';
          statusMessage = 'Ваша заявка одобрена! Данные о практике будут доступны после создания записи студента администратором.';
        } else if (app.status === 'REJECTED') {
          statusText = '❌ Отклонена';
          statusMessage = app.rejectionReason 
            ? `Заявка отклонена. Причина: ${app.rejectionReason}`
            : 'Заявка отклонена администратором.';
        }
        
        let escapedStatusMessage = statusMessage;
        if (app.rejectionReason) {
          escapedStatusMessage = `Заявка отклонена\\. Причина: ${escapeMarkdown(app.rejectionReason)}`;
        }
        
        const result = `
⏳ *Информация о вашей заявке*

👤 *ФИО:*
${escapeMarkdown(app.lastName || '')} ${escapeMarkdown(app.firstName || '')}${app.middleName ? ' ' + escapeMarkdown(app.middleName) : ''}

📚 *Тип практики:* ${escapeMarkdown(practiceTypeNames[app.practiceType] || app.practiceType || 'Не указан')}
🏫 *Учебное заведение:* ${escapeMarkdown(app.institutionName || 'Не указано')}
📅 *Период:* ${escapeMarkdown(formatDate(app.startDate))} \\- ${escapeMarkdown(formatDate(app.endDate))}

📊 *Статус:* ${statusText}

${escapedStatusMessage}
        `;
        console.log('formatPracticeInfo: успешно сформировано сообщение для заявки, статус:', app.status);
        return result;
      } catch (formatError) {
        console.error('Ошибка форматирования заявки:', formatError);
        console.error('Данные заявки:', JSON.stringify(app, null, 2));
        return null;
      }
    }

    if (practiceData.type === 'student') {
      const student = practiceData.data;
      console.log('formatPracticeInfo: student data:', student ? 'exists' : 'null');
      
      if (!student) {
        console.log('formatPracticeInfo: student data is null');
        return null;
      }
      
      const practiceTypeNames = {
        EDUCATIONAL: 'Учебная',
        PRODUCTION: 'Производственная',
        INTERNSHIP: 'Стажировка'
      };
      
      const statusNames = {
        PENDING: 'Ожидает',
        ACTIVE: 'Активна',
        COMPLETED: 'Завершена'
      };

      try {
        const daysRemaining = calculateDaysRemaining(student.endDate);
        let daysText = '';
        
        if (daysRemaining > 0) {
          daysText = `\n⏰ *Осталось дней:* ${daysRemaining}`;
        } else if (daysRemaining === 0) {
          daysText = `\n⚠️ *Практика заканчивается сегодня!*`;
        } else {
          daysText = `\n✅ *Практика завершена* (${Math.abs(daysRemaining)} дней назад)`;
        }

        const result = `
📅 *Информация о вашей практике*

👤 *ФИО:*
${escapeMarkdown(student.lastName || '')} ${escapeMarkdown(student.firstName || '')}${student.middleName ? ' ' + escapeMarkdown(student.middleName) : ''}

📚 *Тип практики:* ${escapeMarkdown(practiceTypeNames[student.practiceType] || student.practiceType || 'Не указан')}
🏫 *Учебное заведение:* ${escapeMarkdown(student.institutionName || 'Не указано')}
📖 *Курс:* ${escapeMarkdown(String(student.course || 'Не указан'))}
📊 *Статус:* ${escapeMarkdown(statusNames[student.status] || student.status || 'Не указан')}

📅 *Период практики:*
Начало: ${escapeMarkdown(formatDate(student.startDate))}
Окончание: ${escapeMarkdown(formatDate(student.endDate))}
${daysText}

${student.supervisor ? `👨‍💼 *Руководитель:* ${escapeMarkdown(student.supervisor)}\n` : ''}
${student.notes ? `📝 *Заметки:* ${escapeMarkdown(student.notes)}\n` : ''}
        `;
        console.log('formatPracticeInfo: успешно сформировано сообщение для student');
        return result;
      } catch (formatError) {
        console.error('Ошибка форматирования student данных:', formatError);
        return null;
      }
    }

    if (practiceData.type === 'registered') {
      console.log('formatPracticeInfo: пользователь зарегистрирован, но нет активных заявок');
      return `
📋 *Информация о регистрации*

Вы зарегистрированы в системе PracticeHub, но у вас пока нет активных заявок на практику.

Используйте /register для подачи новой заявки на практику.
      `;
    }

    console.log('formatPracticeInfo: неизвестный тип practiceData:', practiceData.type);
    return null;
  } catch (error) {
    console.error('Ошибка форматирования информации о практике:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    return null;
  }
}

// Функция для регистрации всех обработчиков команд
function registerCommandHandlers() {
  if (!bot) {
    console.error('❌ Бот не инициализирован, обработчики не могут быть зарегистрированы');
    return;
  }

  // Регистрация всех обработчиков команд
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'Студент';
    
    initUserState(chatId);
    
    const isRegistered = await isUserRegistered(chatId.toString());
    
    if (isRegistered) {
      const practiceData = await getStudentPractice(chatId.toString());
      
      let welcomeMessage = `👋 Добро пожаловать обратно, ${firstName}!\n\nВы уже зарегистрированы в системе PracticeHub.\n\n`;
      
      if (practiceData && practiceData.type !== 'registered') {
        welcomeMessage += `Используйте кнопку "📅 Моя практика" или команду /my_practice для просмотра информации о вашей практике.`;
      } else {
        welcomeMessage += `Используйте кнопку "📅 Моя практика" для просмотра ваших заявок.`;
      }
      
      await bot.sendMessage(chatId, welcomeMessage, getRegisteredMenu());
    } else {
      const welcomeMessage = `
👋 Добро пожаловать, ${firstName}!

Я бот системы управления практикантами PracticeHub.

📋 Что я умею:
• Регистрация на практику
• Получение информации о практике
• Уведомления о важных событиях

Выберите действие из меню ниже или используйте команды:
/register - Начать регистрацию
/info - Информация о системе
/link - Получить ссылку на бота
/help - Справка
      `;
      
      await bot.sendMessage(chatId, welcomeMessage, getMainMenu());
    }
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    const practiceData = await getStudentPractice(chatId.toString());
    
    let helpMessage = `
📚 Справка по использованию бота:

/start - Главное меню
/info - Информация о системе
/link - Получить ссылку на бота
/help - Эта справка
    `;
    
    if (practiceData) {
      helpMessage += `
/my_practice - Просмотр информации о вашей практике
/tasks - Просмотр ваших заданий
/edit - Редактировать данные заявки
/notifications - Настройки уведомлений
      `;
    }
    
    // Админские команды
    if (ADMIN_CHAT_IDS.includes(chatId.toString())) {
      helpMessage += `
      
👑 *Админские команды:*
/admin - Админская панель
/pending - Заявки на рассмотрении
/create_task - Создать задание для студента
      `;
    } else {
      helpMessage += `
/register - Начать регистрацию на практику
/cancel - Отменить текущую операцию

💡 Для регистрации вам понадобится:
• ФИО
• Тип практики
• Название учебного заведения
• Курс обучения
• Даты начала и окончания практики
• Контактные данные (email, телефон)
      `;
    }
    
    await bot.sendMessage(chatId, helpMessage);
  });

  async function handleInfoCommand(msg) {
    const chatId = msg.chat.id;
    
    const infoMessage = `
ℹ️ О системе PracticeHub:

PracticeHub - это система управления практикантами, которая помогает:
• Регистрировать студентов на различные виды практики
• Отслеживать сроки практики
• Получать уведомления о важных событиях
• Управлять информацию о практикантах

📞 По вопросам обращайтесь к администратору системы.
    `;
    
    const menu = await getMenuForChat(chatId);
    await bot.sendMessage(chatId, infoMessage, menu);
  }

  bot.onText(/\/info/, handleInfoCommand);

  bot.onText(/\/link/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      const info = await bot.getMe();
      const botLink = `https://t.me/${info.username}`;
      
      const linkMessage = `
🔗 *Ссылка на бота:*

${botLink}

📋 *Поделитесь этой ссылкой со студентами для регистрации на практику.*

Или просто найдите бота в Telegram по имени: @${info.username}
      `;
      
      await bot.sendMessage(chatId, linkMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Ошибка получения информации о боте:', error);
      await bot.sendMessage(chatId, '❌ Не удалось получить информацию о боте.');
    }
  });

  bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id;
    const startTime = Date.now();
    
    try {
      await bot.sendChatAction(chatId, 'typing');
      const responseTime = Date.now() - startTime;
      
      await bot.sendMessage(chatId, 
        `✅ *Бот работает!*\n\n` +
        `⏱ Время отклика: ${responseTime}ms\n` +
        `📡 Polling активен\n` +
        `🤖 Бот готов к работе`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Ошибка тестовой команды:', error);
      await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  });


  bot.onText(/\/edit/, async (msg) => {
    await handleEditData(msg.chat.id);
  });

  bot.onText(/\/notifications/, async (msg) => {
    await handleNotificationsSettings(msg.chat.id);
  });

  bot.onText(/\/tasks/, async (msg) => {
    await handleTasksList(msg.chat.id);
  });

  // Админские команды
  bot.onText(/\/admin/, async (msg) => {
    await handleAdminCommand(msg);
  });

  bot.onText(/\/pending/, async (msg) => {
    await handlePendingApplications(msg);
  });

  bot.onText(/\/my_practice/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await bot.sendChatAction(chatId, 'typing');
      
      console.log('Команда /my_practice для chatId:', chatId);
      
      const [practiceData, isRegistered] = await Promise.all([
        getStudentPractice(chatId.toString()),
        isUserRegistered(chatId.toString())
      ]);
      
      console.log('practiceData:', practiceData ? practiceData.type : 'null', 'isRegistered:', isRegistered);
      
      if (!practiceData || practiceData.type === 'registered') {
        if (!isRegistered) {
          await bot.sendMessage(chatId, 
            '❌ У вас нет активной практики или заявки.\n\n' +
            'Используйте /register для регистрации на практику.',
            getMainMenu()
          );
        } else {
          await bot.sendMessage(chatId, 
            '📋 У вас пока нет активных заявок на практику.\n\n' +
            'Ваша предыдущая заявка может быть рассмотрена или завершена.\n\n' +
            'Используйте /register для подачи новой заявки.',
            getRegisteredMenu()
          );
        }
        return;
      }
      
      console.log('Форматирование информации о практике...');
      console.log('practiceData перед форматированием:', JSON.stringify(practiceData, null, 2));
      
      const practiceInfo = formatPracticeInfo(practiceData);
      console.log('practiceInfo после форматирования:', practiceInfo ? 'получено' : 'null');
      
      if (practiceInfo) {
        console.log('Отправка информации о практике...');
        try {
          await bot.sendMessage(chatId, practiceInfo, { 
            parse_mode: 'Markdown',
            ...getRegisteredMenu()
          });
          console.log('Информация о практике успешно отправлена');
        } catch (sendError) {
          console.error('Ошибка отправки сообщения:', sendError);
          await bot.sendMessage(chatId, 
            '❌ Ошибка отправки информации. Пожалуйста, попробуйте позже.',
            getRegisteredMenu()
          );
        }
      } else {
        console.log('practiceInfo is null, отправляем сообщение об ошибке');
        console.log('practiceData была:', JSON.stringify(practiceData, null, 2));
        
        let errorMessage = '❌ Не удалось получить информацию о практике.';
        
        if (practiceData && practiceData.type === 'registered') {
          errorMessage = '📋 У вас пока нет активных заявок на практику.\n\nИспользуйте /register для подачи новой заявки.';
        }
        
        await bot.sendMessage(chatId, errorMessage, getRegisteredMenu());
      }
    } catch (error) {
      console.error('Ошибка получения информации о практике:', error);
      console.error('Детали ошибки:', {
        code: error.code,
        meta: error.meta,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      });
      
      try {
        await bot.sendMessage(chatId, 
          '❌ Произошла ошибка при получении информации о практике.\n\n' +
          'Пожалуйста, попробуйте позже или свяжитесь с администратором.',
          getRegisteredMenu()
        );
      } catch (sendError) {
        console.error('Ошибка отправки сообщения об ошибке:', sendError);
      }
    }
  });

  async function handleRegisterCommand(msg) {
    const chatId = msg.chat.id;
    
    try {
      const existingUser = await prisma.studentUser.findFirst({
        where: { telegramId: chatId.toString() },
        include: {
          applications: {
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        }
      });

      if (existingUser) {
        const activeApplication = existingUser.applications?.find(app => ['PENDING', 'APPROVED'].includes(app.status));
        if (activeApplication) {
          await bot.sendMessage(chatId, '⚠️ У вас уже есть активная или одобренная заявка. Используйте /my_practice для просмотра статуса.');
          return;
        }
      }
      
      // Начинаем процесс регистрации с запроса согласия
      const state = initUserState(chatId);
      state.state = RegistrationState.WAITING_PRIVACY_CONSENT;
      state.data = { 
        telegramId: chatId.toString(),
        telegramUsername: msg.from?.username || null
      };
      
      // Кнопки для согласия
      const consentKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Да, принимаю', callback_data: 'privacy_accept' },
              { text: '❌ Нет, отказываюсь', callback_data: 'privacy_decline' }
            ]
          ]
        }
      };
      
      const privacyMessage = `
📋 *Согласие на обработку персональных данных*

Перед регистрацией в системе PracticeHub необходимо ознакомиться и принять:

1. *Политику конфиденциальности*
   - Ваши персональные данные используются только для организации практики
   - Мы храним данные в течение срока, необходимого для выполнения обязательств
   - Вы можете запросить удаление своих данных

2. *Согласие на обработку персональных данных*
   - Мы собираем данные для оформления документов на практику
   - Данные передаются только учебному заведению и администрации
   - Вы можете отозвать согласие в любой момент

*Ссылка на полную версию документов:* ${process.env.PRIVACY_POLICY_URL || 'https://your-domain.com/privacy'}

*Нажимая "Да, принимаю", вы подтверждаете:*
• Ознакомление с политикой конфиденциальности
• Согласие на обработку персональных данных
• Согласие на хранение и использование данных для организации практики

Вы принимаете политику конфиденциальности и соглашаетесь на обработку персональных данных?
      `;
      
      await bot.sendMessage(chatId, privacyMessage, { 
        parse_mode: 'Markdown',
        ...consentKeyboard 
      });
    } catch (error) {
      console.error('Ошибка в handleRegisterCommand:', error.message);
      // Не падаем сервер, просто логируем ошибку
      if (error.code === 'ETELEGRAM' && error.response?.body?.description?.includes('blocked')) {
        console.warn(`Бот заблокирован пользователем ${chatId}`);
      }
    }
  }

  bot.onText(/\/register/, handleRegisterCommand);

  bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    clearUserState(chatId);
    
    await bot.sendMessage(chatId, 
      '❌ Регистрация отменена.\n\n' +
      'Вы можете начать заново командой /register',
      getMainMenu()
    );
  });

  bot.on('message', async (msg) => {
    if (!msg.text) {
      return;
    }
    
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (text.startsWith('/')) {
      return;
    }
    
    const state = userStates.get(chatId);
    if (!state || state.state === RegistrationState.IDLE) {
      if (text === '📝 Зарегистрироваться на практику') {
        await handleRegisterCommand(msg);
        return;
      }
      if (text === '📅 Моя практика') {
        const chatId = msg.chat.id;
        try {
          await bot.sendChatAction(chatId, 'typing');
          
          console.log('Обработка кнопки "📅 Моя практика" для chatId:', chatId);
          
          const [practiceData, isRegistered] = await Promise.all([
            getStudentPractice(chatId.toString()),
            isUserRegistered(chatId.toString())
          ]);
          
          console.log('practiceData:', practiceData ? practiceData.type : 'null', 'isRegistered:', isRegistered);
          
          if (!practiceData || practiceData.type === 'registered') {
            if (!isRegistered) {
              await bot.sendMessage(chatId, 
                '❌ У вас нет активной практики или заявки.\n\n' +
                'Используйте /register для регистрации на практику.',
                getMainMenu()
              );
            } else {
              await bot.sendMessage(chatId, 
                '📋 У вас пока нет активных заявок на практику.\n\n' +
                'Ваша предыдущая заявка может быть рассмотрена или завершена.\n\n' +
                'Используйте /register для подачи новой заявки.',
                getRegisteredMenu()
              );
            }
            return;
          }
          
          console.log('Форматирование информации о практике...');
          console.log('practiceData перед форматированием:', JSON.stringify(practiceData, null, 2));
          
          const practiceInfo = formatPracticeInfo(practiceData);
          console.log('practiceInfo после форматирования:', practiceInfo ? 'получено' : 'null');
          
          if (practiceInfo) {
            console.log('Отправка информации о практике...');
            try {
              await bot.sendMessage(chatId, practiceInfo, { 
                parse_mode: 'Markdown',
                ...getRegisteredMenu()
              });
              console.log('Информация о практике успешно отправлена');
            } catch (sendError) {
              console.error('Ошибка отправки сообщения:', sendError);
              await bot.sendMessage(chatId, 
                '❌ Ошибка отправки информации. Пожалуйста, попробуйте позже.',
                getRegisteredMenu()
              );
            }
          } else {
            console.log('practiceInfo is null, отправляем сообщение об ошибке');
            console.log('practiceData была:', JSON.stringify(practiceData, null, 2));
            
            let errorMessage = '❌ Не удалось получить информацию о практике.';
            
            if (practiceData && practiceData.type === 'registered') {
              errorMessage = '📋 У вас пока нет активных заявок на практику.\n\nИспользуйте /register для подачи новой заявки.';
            }
            
            await bot.sendMessage(chatId, errorMessage, getRegisteredMenu());
          }
        } catch (error) {
          console.error('Ошибка получения информации о практике:', error);
          console.error('Детали ошибки:', {
            code: error.code,
            meta: error.meta,
            message: error.message,
            stack: error.stack?.substring(0, 500)
          });
          
          try {
            await bot.sendMessage(chatId, 
              '❌ Произошла ошибка при получении информации о практике.\n\n' +
              'Пожалуйста, попробуйте позже или свяжитесь с администратором.',
              getRegisteredMenu()
            );
          } catch (sendError) {
            console.error('Ошибка отправки сообщения об ошибке:', sendError);
          }
        }
        return;
      }
      if (text === '✏️ Редактировать данные') {
        await handleEditData(chatId);
        return;
      }
      if (text === '🔔 Уведомления') {
        await handleNotificationsSettings(chatId);
        return;
      }
      if (text === '📋 Задания') {
        await handleTasksList(chatId);
        return;
      }
      if (text === 'ℹ️ Информация') {
        await handleInfoCommand(msg);
        return;
      }
      if (text === '📞 Контакты') {
        const menu = await getMenuForChat(chatId);
        await bot.sendMessage(chatId, 
          '📞 *Контакты*\n\n' +
          `${SUPPORT_CONTACTS}`,
          { parse_mode: 'Markdown', ...menu }
        );
        return;
      }
      // Админские кнопки
      if (ADMIN_CHAT_IDS.includes(chatId.toString())) {
        if (text === '📋 Заявки на рассмотрении') {
          await handlePendingApplications(msg);
          return;
        }
        if (text === '📊 Статистика') {
          await handleAdminCommand(msg);
          return;
        }
        if (text === '🔙 Главное меню') {
          await bot.sendMessage(chatId, 'Главное меню', getMainMenu());
          return;
        }
      }
      return;
    }
    
    try {
      switch (state.state) {
        case RegistrationState.WAITING_PRIVACY_CONSENT:
          // Обработка текстового ответа на вопрос о согласии (резервный вариант)
          if (text.toLowerCase().includes('да') || text.toLowerCase().includes('принимаю') || text === '✅') {
            state.data.privacyAccepted = true;
            state.data.privacyAcceptedAt = new Date();
            state.state = RegistrationState.WAITING_FIRST_NAME;
            await bot.sendMessage(chatId, '✅ Спасибо за согласие!\n\nТеперь начнем регистрацию.\n\nВведите ваше *имя*:', { parse_mode: 'Markdown' });
          } else if (text.toLowerCase().includes('нет') || text.toLowerCase().includes('отказываюсь') || text === '❌') {
            clearUserState(chatId);
            await bot.sendMessage(chatId, 
              '❌ Регистрация отменена.\n\n' +
              'Для регистрации на практику необходимо принять политику конфиденциальности и согласие на обработку персональных данных.\n\n' +
              'Если у вас есть вопросы, обратитесь к администратору.',
              getMainMenu()
            );
          } else {
            await bot.sendMessage(chatId, 'Пожалуйста, ответьте "Да" или "Нет" на вопрос о согласии с политикой конфиденциальности.');
          }
          break;
          
        case RegistrationState.WAITING_FIRST_NAME:
          if (!text || text.trim().length < 2) {
            await bot.sendMessage(chatId, '❌ Имя должно содержать минимум 2 символа. Попробуйте еще раз:');
            return;
          }
          state.data.firstName = text.trim();
          state.state = RegistrationState.WAITING_LAST_NAME;
          await bot.sendMessage(chatId, 'Введите вашу *фамилию*:', { parse_mode: 'Markdown' });
          break;
          
        case RegistrationState.WAITING_LAST_NAME:
          if (!text || text.trim().length < 2) {
            await bot.sendMessage(chatId, '❌ Фамилия должна содержать минимум 2 символа. Попробуйте еще раз:');
            return;
          }
          state.data.lastName = text.trim();
          state.state = RegistrationState.WAITING_MIDDLE_NAME;
          await bot.sendMessage(chatId, 
            'Введите ваше *отчество* (или отправьте "-" если отчества нет):',
            { parse_mode: 'Markdown' }
          );
          break;
          
        case RegistrationState.WAITING_MIDDLE_NAME:
          state.data.middleName = text.trim() === '-' ? null : text.trim();
          state.state = RegistrationState.WAITING_PRACTICE_TYPE;
          const practiceKeyboard = {
            reply_markup: {
              inline_keyboard: [
                practiceTypes.map(type => ({ text: type.text, callback_data: `practice_${type.callback_data}` }))
              ]
            }
          };
          await bot.sendMessage(chatId, 
            'Выберите *тип практики*:',
            { parse_mode: 'Markdown', ...practiceKeyboard }
          );
          break;

        case RegistrationState.WAITING_PRACTICE_TYPE: {
          const textValue = text.trim().toLowerCase();
          const mapping = {
            'учебная': 'EDUCATIONAL',
            'учебная практика': 'EDUCATIONAL',
            'производственная': 'PRODUCTION',
            'производственная практика': 'PRODUCTION',
            'стажировка': 'INTERNSHIP',
            'стажерская': 'INTERNSHIP',
            '1': 'EDUCATIONAL',
            '2': 'PRODUCTION',
            '3': 'INTERNSHIP'
          };

          const practiceType = mapping[textValue];

          if (!practiceType) {
            await bot.sendMessage(chatId,
              '❌ Пожалуйста, выберите тип практики кнопками ниже или отправьте: 1 — Учебная, 2 — Производственная, 3 — Стажировка.',
              {
                reply_markup: {
                  inline_keyboard: [
                    practiceTypes.map(type => ({ text: type.text, callback_data: `practice_${type.callback_data}` }))
                  ]
                }
              }
            );
            return;
          }

          state.data.practiceType = practiceType;
          state.state = RegistrationState.WAITING_INSTITUTION_TYPE;

          const institutionKeyboard = {
            reply_markup: {
              inline_keyboard: [
                institutionTypes.map(type => ({ text: type.text, callback_data: `institution_${type.callback_data}` }))
              ]
            }
          };

          await bot.sendMessage(chatId,
            'Выберите *тип учебного заведения*:',
            { parse_mode: 'Markdown', ...institutionKeyboard }
          );
          break;
        }
          
        case RegistrationState.WAITING_INSTITUTION_TYPE:
          break;
          
        case RegistrationState.WAITING_INSTITUTION_NAME:
          if (!text || text.trim().length < 3) {
            await bot.sendMessage(chatId, '❌ Название учебного заведения должно содержать минимум 3 символа. Попробуйте еще раз:');
            return;
          }
          state.data.institutionName = text.trim();
          state.state = RegistrationState.WAITING_COURSE;
          await bot.sendMessage(chatId, 'Введите ваш курс:', { parse_mode: 'Markdown' });
          break;
          
        case RegistrationState.WAITING_COURSE:
          const course = parseInt(text);
          if (isNaN(course) || course < 1 || course > 10) {
            await bot.sendMessage(chatId, '❌ Курс должен быть числом от 1 до 4. Попробуйте еще раз:');
            return;
          }
          state.data.course = course;
          state.state = RegistrationState.WAITING_EMAIL;
          await bot.sendMessage(chatId, 
            'Введите ваш *email* (или отправьте "-" если email нет):',
            { parse_mode: 'Markdown' }
          );
          break;
          
        case RegistrationState.WAITING_EMAIL:
          if (text.trim() === '-') {
            state.data.email = null;
          } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(text.trim())) {
              await bot.sendMessage(chatId, '❌ Неверный формат email. Попробуйте еще раз или отправьте "-":');
              return;
            }
            state.data.email = text.trim();
          }
          state.state = RegistrationState.WAITING_PHONE;
          await bot.sendMessage(chatId, 
            'Введите ваш *телефон* (или отправьте "-" если телефона нет):',
            { parse_mode: 'Markdown' }
          );
          break;
          
        case RegistrationState.WAITING_PHONE:
          state.data.phone = text.trim() === '-' ? null : text.trim();
          state.state = RegistrationState.WAITING_START_DATE;
          await bot.sendMessage(chatId, 
            'Введите *дату начала практики* в формате ДД.ММ.ГГГГ (например, 01.09.2024):',
            { parse_mode: 'Markdown' }
          );
          break;
          
        case RegistrationState.WAITING_START_DATE:
          const startDate = parseDate(text.trim());
          if (!startDate) {
            await bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 01.09.2024):');
            return;
          }
          state.data.startDate = startDate;
          state.state = RegistrationState.WAITING_END_DATE;
          await bot.sendMessage(chatId, 
            'Введите *дату окончания практики* в формате ДД.ММ.ГГГГ (например, 30.12.2024):',
            { parse_mode: 'Markdown' }
          );
          break;
          
        case RegistrationState.WAITING_END_DATE:
          const endDate = parseDate(text.trim());
          if (!endDate) {
            await bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 30.12.2024):');
            return;
          }
          if (endDate <= state.data.startDate) {
            await bot.sendMessage(chatId, '❌ Дата окончания должна быть позже даты начала. Попробуйте еще раз:');
            return;
          }
          state.data.endDate = endDate;
          state.state = RegistrationState.CONFIRMING;
          await showConfirmation(chatId, state.data);
          break;
          
        case EditState.WAITING_VALUE:
          await handleEditValue(chatId, text, state.data);
          break;
        case TaskSubmissionState.WAITING_SOLUTION:
          await handleTaskSubmitSolution(chatId, text, state.data);
          break;
        case TaskCreationState.WAITING_STUDENT:
          await handleTaskCreationStudent(chatId, text, state.data);
          break;
        case TaskCreationState.WAITING_TITLE:
          state.data.title = text.trim();
          state.state = TaskCreationState.WAITING_DESCRIPTION;
          await bot.sendMessage(chatId, 
            'Введите *описание задания*:',
            { parse_mode: 'Markdown' }
          );
          break;
        case TaskCreationState.WAITING_DESCRIPTION:
          state.data.description = text.trim();
          state.state = TaskCreationState.WAITING_DEADLINE;
          await bot.sendMessage(chatId, 
            'Введите *дедлайн задания* в формате ДД.ММ.ГГГГ (например, 31.12.2024):',
            { parse_mode: 'Markdown' }
          );
          break;
        case TaskCreationState.WAITING_DEADLINE:
          const deadline = parseDate(text.trim());
          if (!deadline) {
            await bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 31.12.2024):');
            return;
          }
          if (deadline < new Date()) {
            await bot.sendMessage(chatId, '❌ Дедлайн не может быть в прошлом. Попробуйте еще раз:');
            return;
          }
          state.data.deadline = deadline;
          state.state = TaskCreationState.WAITING_REFERENCE_LINK;
          await bot.sendMessage(chatId, 
            'Введите *ссылку на материалы* (GitHub, документация и т.д.) или отправьте "-" чтобы пропустить:',
            { parse_mode: 'Markdown' }
          );
          break;
        case TaskCreationState.WAITING_REFERENCE_LINK:
          if (text.trim() !== '-') {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = text.match(urlRegex);
            if (!urls || urls.length === 0) {
              await bot.sendMessage(chatId, '❌ Некорректная ссылка. Попробуйте еще раз или отправьте "-":');
              return;
            }
            state.data.referenceLink = urls[0];
          } else {
            state.data.referenceLink = null;
          }
          state.state = TaskCreationState.CONFIRMING;
          await showTaskConfirmation(chatId, state.data);
          break;
          
        default:
          break;
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
      await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте начать заново командой /register');
      clearUserState(chatId);
    }
  });

  // Обработка callback-кнопок
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    console.log(`🔔 Callback query получен: chatId=${chatId}, data="${data}"`);

    // Для редактирования не отвечаем здесь, ответим в handleEditCallback
    // Для остальных callback-запросов отвечаем сразу
    if (!data.startsWith('edit_')) {
      try {
        await bot.answerCallbackQuery(query.id);
      } catch (err) {
        console.warn('Ошибка answerCallbackQuery (обычно из‑за старой кнопки):', err?.message || err);
      }
    }
    
    // Получаем состояние (будет использоваться ниже для callback-запросов, требующих состояния)
    let state = userStates.get(chatId);
    
    // Обработка админских кнопок по заявкам
    if (data.startsWith('app_approve_') || data.startsWith('app_reject_')) {
      try {
        if (!ADMIN_CHAT_IDS.includes(chatId.toString())) {
          await bot.sendMessage(chatId, '❌ Недостаточно прав для обработки заявок.');
          return;
        }

        const action = data.startsWith('app_approve_') ? 'APPROVE' : 'REJECT';
        const appId = data.replace(action === 'APPROVE' ? 'app_approve_' : 'app_reject_', '');

        if (action === 'APPROVE') {
          await approveApplicationFromBot(appId, chatId);
        } else {
          await rejectApplicationFromBot(appId, chatId);
        }

        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch (error) {
        console.error('Ошибка обработки админского решения:', error);
        await bot.sendMessage(chatId, '❌ Не удалось обработать заявку. Попробуйте позже.');
      }
      return;
    }
    
    // Обработка согласия на политику конфиденциальности
    if (data === 'privacy_accept') {
      if (state && state.state === RegistrationState.WAITING_PRIVACY_CONSENT) {
        // Сохраняем согласие
        state.data.privacyAccepted = true;
        state.data.privacyAcceptedAt = new Date();
        state.data.privacyAcceptedIp = query.from?.id?.toString() || 'telegram';
        
        state.state = RegistrationState.WAITING_FIRST_NAME;
        
        // Отправляем сообщение о начале регистрации
        await bot.editMessageText(
          '✅ Спасибо за согласие!\n\nТеперь начнем регистрацию.\n\nВведите ваше *имя*:',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
          }
        );
      }
      return;
    }
    
    if (data === 'privacy_decline') {
      clearUserState(chatId);
      
      await bot.editMessageText(
        '❌ Регистрация отменена.\n\n' +
        'Для регистрации на практику необходимо принять политику конфиденциальности и согласие на обработку персональных данных.\n\n' +
        'Если у вас есть вопросы, обратитесь к администратору.',
        {
          chat_id: chatId,
          message_id: query.message.message_id
        }
      );
      
      await bot.sendMessage(chatId, 
        'Вы можете ознакомиться с документами по ссылке: ' + 
        (process.env.PRIVACY_POLICY_URL || 'https://your-domain.com/privacy') + 
        '\n\nДля повторной попытки регистрации используйте /register',
        getMainMenu()
      );
      return;
    }
    
    // Обработка кнопок заданий (не требует состояния регистрации)
    if (data.startsWith('task_view_')) {
      console.log(`📋 Обработка task_view_: taskId=${data.replace('task_view_', '')}`);
      const taskId = data.replace('task_view_', '');
      try {
        await handleTaskView(chatId, taskId);
      } catch (error) {
        console.error('Ошибка в handleTaskView:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при просмотре задания.', getRegisteredMenu());
      }
      return;
    }
    
    if (data.startsWith('task_submit_')) {
      console.log(`📤 Обработка task_submit_: taskId=${data.replace('task_submit_', '')}`);
      const taskId = data.replace('task_submit_', '');
      try {
        await handleTaskSubmitStart(chatId, taskId);
      } catch (error) {
        console.error('Ошибка в handleTaskSubmitStart:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при отправке решения.', getRegisteredMenu());
      }
      return;
    }
    
    if (data === 'tasks_list') {
      console.log(`📋 Обработка tasks_list`);
      try {
        await handleTasksList(chatId);
      } catch (error) {
        console.error('Ошибка в handleTasksList:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при получении списка заданий.', getRegisteredMenu());
      }
      return;
    }
    
    if (data === 'task_submit_cancel') {
      const state = userStates.get(chatId);
      if (state) {
        state.state = TaskSubmissionState.IDLE;
        state.data = {};
      }
      await bot.sendMessage(chatId, '❌ Отправка решения отменена.', getRegisteredMenu());
      return;
    }
    
    // Обработка редактирования - должна быть ДО проверки state, так как редактирование не требует состояния регистрации
    if (data.startsWith('edit_approved_')) {
      const appId = data.replace('edit_approved_', '');
      // Закрываем предыдущее сообщение с предупреждением
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch (err) {
        console.warn('Не удалось закрыть предыдущее сообщение:', err.message);
      }
      await handleEditApprovedApplication(chatId, appId);
      return;
    }
    
    if (data.startsWith('edit_')) {
      // Обрабатываем редактирование - не требуется состояние регистрации
      console.log(`🔧 Вызов handleEditCallback для data="${data}"`);
      try {
        await handleEditCallback(query, data, chatId);
        console.log(`✅ handleEditCallback успешно выполнен для data="${data}"`);
      } catch (error) {
        console.error(`❌ Ошибка в handleEditCallback:`, error);
        console.error('Stack:', error.stack);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при обработке редактирования. Попробуйте позже.', getRegisteredMenu());
      }
      return; // Важно: возвращаемся, чтобы не проверять state ниже
    }
    
    if (data === 'edit_cancel') {
      clearUserState(chatId);
      await bot.sendMessage(chatId, '❌ Редактирование отменено.', getRegisteredMenu());
      return;
    }
    
    // Для остальных callback-запросов требуется состояние
    // state уже объявлен выше, просто проверяем его наличие
    if (!state) return;
    
    try {
      if (data.startsWith('practice_')) {
        const practiceType = data.replace('practice_', '');
        state.data.practiceType = practiceType;
        state.state = RegistrationState.WAITING_INSTITUTION_TYPE;
        
        const institutionKeyboard = {
          reply_markup: {
            inline_keyboard: [
              institutionTypes.map(type => ({ text: type.text, callback_data: `institution_${type.callback_data}` }))
            ]
          }
        };
        
        await bot.editMessageText(
          'Выберите *тип учебного заведения*:',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            ...institutionKeyboard
          }
        );
      } else if (data.startsWith('institution_')) {
        const institutionType = data.replace('institution_', '');
        state.data.institutionType = institutionType;
        state.state = RegistrationState.WAITING_INSTITUTION_NAME;
        
        await bot.editMessageText(
          'Введите *название учебного заведения*:',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
          }
        );
      } else if (data === 'confirm_registration') {
        await confirmRegistration(chatId, state.data);
      } else if (data === 'cancel_registration') {
        clearUserState(chatId);
        await bot.sendMessage(chatId, '❌ Регистрация отменена.', getMainMenu());
        return;
      } else if (data === 'task_confirm_create') {
        const state = userStates.get(chatId);
        if (state && state.state === TaskCreationState.CONFIRMING) {
          await confirmTaskCreation(chatId, state.data);
        }
      } else if (data === 'task_cancel_create') {
        const state = userStates.get(chatId);
        if (state) {
          state.state = TaskCreationState.IDLE;
          state.data = {};
        }
        await bot.sendMessage(chatId, '❌ Создание задания отменено.', getMainMenu());
      }
    } catch (error) {
      console.error('❌ Ошибка обработки callback:', error);
      console.error('Stack:', error.stack);
      try {
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте начать заново командой /register');
      } catch (sendError) {
        console.error('Ошибка отправки сообщения об ошибке:', sendError);
      }
      clearUserState(chatId);
    }
  });

  startDailyNotifications();
  
  console.log('✅ Все обработчики Telegram-бота зарегистрированы');
}

  // Показать подтверждение данных
  async function showConfirmation(chatId, data) {
    try {
      // Используем простой текст без Markdown, чтобы избежать проблем с парсингом
      const confirmationText = `✅ Проверьте ваши данные:\n\n` +
        `👤 ФИО:\n` +
        `${data.lastName || ''} ${data.firstName || ''}${data.middleName ? ' ' + data.middleName : ''}\n\n` +
        `📚 Практика:\n` +
        `Тип: ${practiceTypeNames[data.practiceType] || data.practiceType || 'Не указан'}\n` +
        `Учебное заведение: ${institutionTypeNames[data.institutionType] || ''} ${data.institutionName || ''}\n` +
        `Курс: ${data.course || 'Не указан'}\n\n` +
        `📅 Даты:\n` +
        `Начало: ${formatDate(data.startDate)}\n` +
        `Окончание: ${formatDate(data.endDate)}\n\n` +
        `📧 Контакты:\n` +
        `Email: ${data.email || 'Не указан'}\n` +
        `Телефон: ${data.phone || 'Не указан'}\n\n` +
        `Подтвердите регистрацию:`;
      
      const confirmKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Подтвердить', callback_data: 'confirm_registration' }],
            [{ text: '❌ Отменить', callback_data: 'cancel_registration' }]
          ]
        }
      };
      
      // Отправляем без parse_mode, чтобы избежать проблем с парсингом Markdown
      await bot.sendMessage(chatId, confirmationText, { ...confirmKeyboard });
    } catch (error) {
      console.error('Ошибка отправки сообщения подтверждения:', error);
      console.error('Детали ошибки:', {
        code: error.code,
        message: error.message,
        response: error.response?.body
      });
      
      // Если ошибка парсинга, отправляем упрощенную версию без форматирования
      try {
        const simpleText = `✅ Проверьте ваши данные:\n\n` +
          `ФИО: ${data.lastName || ''} ${data.firstName || ''}${data.middleName ? ' ' + data.middleName : ''}\n` +
          `Тип практики: ${practiceTypeNames[data.practiceType] || data.practiceType || 'Не указан'}\n` +
          `Учебное заведение: ${data.institutionName || 'Не указано'}\n` +
          `Курс: ${data.course || 'Не указан'}\n` +
          `Начало: ${formatDate(data.startDate)}\n` +
          `Окончание: ${formatDate(data.endDate)}\n` +
          `Email: ${data.email || 'Не указан'}\n` +
          `Телефон: ${data.phone || 'Не указан'}\n\n` +
          `Подтвердите регистрацию:`;
        
        const confirmKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Подтвердить', callback_data: 'confirm_registration' }],
              [{ text: '❌ Отменить', callback_data: 'cancel_registration' }]
            ]
          }
        };
        
        await bot.sendMessage(chatId, simpleText, { ...confirmKeyboard });
      } catch (fallbackError) {
        console.error('Ошибка отправки упрощенного сообщения:', fallbackError);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при отображении данных. Пожалуйста, попробуйте заново /register');
      }
    }
  }

  // Подтверждение и сохранение регистрации
  async function confirmRegistration(chatId, data) {
    try {
      console.log('Начало сохранения регистрации для chatId:', chatId);
      console.log('Данные:', JSON.stringify(data, null, 2));
      
      if (!data.privacyAccepted) {
        await bot.sendMessage(chatId, 
          '❌ Ошибка: Согласие на обработку персональных данных не получено.\n\n' +
          'Пожалуйста, начните регистрацию заново.',
          getMainMenu()
        );
        clearUserState(chatId);
        return;
      }

      if (!data.practiceType) {
        data.practiceType = 'EDUCATIONAL';
      }
      if (!data.institutionType) {
        data.institutionType = 'UNIVERSITY';
      }
      if (!data.course || Number.isNaN(Number(data.course))) {
        data.course = 1;
      }
      if (!data.startDate || !data.endDate || !(data.startDate instanceof Date) || !(data.endDate instanceof Date)) {
        await bot.sendMessage(chatId, '❌ Ошибка: даты начала/окончания не заданы или некорректны. Попробуйте заново /register');
        clearUserState(chatId);
        return;
      }
      if (data.endDate <= data.startDate) {
        await bot.sendMessage(chatId, '❌ Ошибка: дата окончания должна быть позже даты начала. Попробуйте заново /register');
        clearUserState(chatId);
        return;
      }

      // Если пользователь с таким telegramId уже есть, мы НЕ выходим,
      // а позволяем повторно создать заявку. Старый аккаунт ниже будет очищен.
      const existingUser = await prisma.studentUser.findFirst({
        where: {
          telegramId: data.telegramId
        }
      });

      let institution = await prisma.institution.findFirst({
        where: {
          name: data.institutionName,
          type: data.institutionType
        }
      });
      
      if (!institution) {
        console.log('Создание нового учебного заведения:', data.institutionName);
        institution = await prisma.institution.create({
          data: {
            name: data.institutionName,
            type: data.institutionType
          }
        });
      } else {
        console.log('Найдено существующее учебное заведение:', institution.id);
      }
      
      const username = `${data.lastName} ${data.firstName}`.trim();
      let email = data.email || `telegram_${chatId}@practicehub.local`;

      // Проверяем, есть ли уже пользователь с таким telegramId.
      // Используем findFirst, так как в актуальной схеме Prisma
      // уникальным полем может быть только telegramId, а не email/username.
      const existingByTelegram = await prisma.studentUser.findFirst({
        where: { telegramId: data.telegramId }
      });
      if (existingByTelegram) {
        try {
          console.log('Удаляем старый аккаунт по telegramId для повторной регистрации:', existingByTelegram.id);
          await prisma.studentUser.delete({ where: { id: existingByTelegram.id } });
        } catch (err) {
          console.warn('Не удалось удалить по telegramId:', err?.message);
        }
      }

      // В схеме StudentUser email не помечен как @unique,
      // поэтому используем findFirst вместо findUnique, чтобы избежать
      // ошибки "needs at least one of `id` or `telegramId` arguments".
      const existingByEmail = await prisma.studentUser.findFirst({ where: { email } });
      if (existingByEmail) {
        try {
          console.log('Удаляем старый аккаунт по email для повторной регистрации:', existingByEmail.id);
          await prisma.studentUser.delete({ where: { id: existingByEmail.id } });
        } catch (err) {
          console.warn('Не удалось удалить по email:', err?.message);
        }
      }

      const existingByUsernameList = await prisma.studentUser.findMany({ where: { username } });
      for (const u of existingByUsernameList) {
        try {
          console.log('Удаляем старый аккаунт по username для повторной регистрации:', u.id);
          await prisma.studentUser.delete({ where: { id: u.id } });
        } catch (err) {
          console.warn('Не удалось удалить по username:', err?.message);
        }
      }
      
      console.log('Создание StudentUser...');
      try {
        // Если existingUser был, после очистки дублей он уже удалён,
        // поэтому просто создаём (или, если хочешь, можно было бы reuse).
        const studentUser = await prisma.studentUser.create({
          data: {
            username,
            email,
            telegramId: data.telegramId,
            privacyAccepted: data.privacyAccepted,
            privacyAcceptedAt: data.privacyAcceptedAt
          }
        });
        console.log('StudentUser создан:', studentUser.id);
        
        console.log('Создание PracticeApplication...');
        const application = await prisma.practiceApplication.create({
          data: {
            studentUserId: studentUser.id,
            lastName: data.lastName,
            firstName: data.firstName,
            middleName: data.middleName,
            practiceType: data.practiceType,
            institutionType: data.institutionType,
            institutionName: data.institutionName,
            course: data.course,
            email: data.email,
            phone: data.phone,
            telegramId: data.telegramId,
            startDate: data.startDate,
            endDate: data.endDate,
            status: 'PENDING',
            notes: 'Зарегистрировано через Telegram-бота',
            privacyAccepted: data.privacyAccepted,
            privacyAcceptedAt: data.privacyAcceptedAt
          }
        });
        console.log('PracticeApplication создана:', application.id);
        
        clearUserState(chatId);
        
        const usernameLine = data.telegramUsername 
          ? `Ваш Telegram: @${data.telegramUsername}` 
          : `Ваш chatId: ${chatId}`;

        const successMessage = `🎉 *Регистрация успешно завершена\\!*\n\n` +
          `✅ Ваша заявка на практику отправлена на рассмотрение\\.\n\n` +
          `📋 *Детали заявки:*\n` +
          `🆔 ID: ${escapeMarkdown(application.id.substring(0, 8))}\\.\\.\\.\n` +
          `👤 ${escapeMarkdown(usernameLine)}\n` +
          `📚 Тип практики: ${escapeMarkdown(practiceTypeNames[data.practiceType] || data.practiceType)}\n` +
          `🏫 Учебное заведение: ${escapeMarkdown(data.institutionName)}\n` +
          `📅 Период: ${escapeMarkdown(formatDate(data.startDate))} \\- ${escapeMarkdown(formatDate(data.endDate))}\n\n` +
          `💡 *Что дальше\\?*\n` +
          `• Нажмите "📅 Моя практика" или используйте /my_practice, чтобы увидеть статус заявки\n` +
          `• Мы пришлём уведомление, когда администратор рассмотрит заявку`;
        
        await bot.sendMessage(chatId, successMessage, { 
          parse_mode: 'Markdown',
          ...getRegisteredMenu()
        });
        
        if (ADMIN_CHAT_IDS.length) {
          const adminMessageLines = [
            '🔔 Новая заявка на практику',
            '',
            `Студент: ${escapeMarkdown(data.lastName || '')} ${escapeMarkdown(data.firstName || '')}${data.middleName ? ' ' + escapeMarkdown(data.middleName) : ''}`,
            `Тип: ${escapeMarkdown(practiceTypeNames[data.practiceType] || data.practiceType)}`,
            `Учебное заведение: ${escapeMarkdown(data.institutionName || '')}`,
            `Период: ${escapeMarkdown(formatDate(data.startDate))} \\- ${escapeMarkdown(formatDate(data.endDate))}`,
            `ID заявки: ${escapeMarkdown(application.id)}`,
            `Согласие на обработку данных: ${data.privacyAccepted ? '✅ Да' : '❌ Нет'}`,
            '',
            'Одобрить или отклонить заявку\\?'
          ];
          const adminMessage = adminMessageLines.join('\n');

          const adminKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Одобрить', callback_data: `app_approve_${application.id}` },
                  { text: '❌ Отклонить', callback_data: `app_reject_${application.id}` }
                ]
              ]
            }
          };

          for (const adminChatId of ADMIN_CHAT_IDS) {
            try {
              await bot.sendMessage(adminChatId, adminMessage, adminKeyboard);
            } catch (err) {
              console.error('Ошибка отправки уведомления админу:', adminChatId, err.message);
            }
          }
        }
      } catch (userError) {
        console.error('Ошибка создания StudentUser:', userError);
        if (userError.code === 'P2002') {
          if (userError.meta?.target?.includes('telegramId')) {
            await bot.sendMessage(chatId, 
              '⚠️ Вы уже зарегистрированы в системе!\n\n' +
              'Используйте команду /my_practice для просмотра ваших заявок.',
              getRegisteredMenu()
            );
          } else if (userError.meta?.target?.includes('email')) {
            await bot.sendMessage(chatId, 
              '❌ Ошибка: Email уже используется. Пожалуйста, используйте другой email или начните регистрацию заново.',
              getMainMenu()
            );
          } else {
            throw userError;
          }
          clearUserState(chatId);
          return;
        }
        throw userError;
      }
    } catch (error) {
      console.error('Ошибка сохранения регистрации:', error);
      console.error('Детали ошибки:', {
        code: error.code,
        meta: error.meta,
        message: error.message,
        stack: error.stack?.substring(0, 500) 
      });
      
      let errorMessage = '❌ Произошла ошибка при сохранении данных.';
      
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('telegramId')) {
          errorMessage = '⚠️ Вы уже зарегистрированы в системе!\n\nИспользуйте команду /my_practice для просмотра ваших заявок.';
        } else if (error.meta?.target?.includes('email')) {
          errorMessage = '❌ Ошибка: Email уже используется. Пожалуйста, используйте другой email.';
        } else if (error.meta?.target?.includes('username')) {
          errorMessage = '❌ Ошибка: Имя пользователя уже занято. Пожалуйста, попробуйте еще раз.';
        } else {
          errorMessage = '❌ Ошибка: Данные уже существуют в системе. Возможно, вы уже зарегистрированы.';
        }
      } else if (error.code === 'P2003') {
        errorMessage = '❌ Ошибка: Связанные данные не найдены. Пожалуйста, попробуйте еще раз.';
      } else if (error.message?.includes('Unique constraint')) {
        errorMessage = '❌ Ошибка: Вы уже зарегистрированы в системе. Используйте /my_practice для просмотра заявок.';
      } else if (error.message?.includes('Invalid value')) {
        errorMessage = '❌ Ошибка: Некорректные данные. Пожалуйста, начните регистрацию заново.';
      }

      try {
        await bot.sendMessage(chatId, `${errorMessage}\n\n[${error.code || 'NO_CODE'}] ${error.message || ''}`, getMainMenu());
      } catch (sendErr) {
        console.error('Ошибка отправки сообщения об ошибке:', sendErr);
      }
      
      clearUserState(chatId);
    }
  }

  async function approveApplicationFromBot(appId, adminChatId) {
    const application = await prisma.practiceApplication.findUnique({
      where: { id: appId },
      include: {
        studentUser: true
      }
    });

    if (!application) {
      await bot.sendMessage(adminChatId, '❌ Заявка не найдена.');
      return;
    }

    if (application.status !== 'PENDING') {
      await bot.sendMessage(adminChatId, '⚠️ Заявка уже обработана.');
      return;
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
        notes: application.notes,
        privacyAccepted: application.privacyAccepted,
        privacyAcceptedAt: application.privacyAcceptedAt
      }
    });

    await prisma.practiceApplication.update({
      where: { id: appId },
      data: {
        status: 'APPROVED',
        approvedBy: adminChatId.toString(),
        notes: application.notes
      }
    });

    // Связываем созданного студента с учетной записью StudentUser через поле userId в Student
    if (application.studentUserId) {
      await prisma.student.update({
        where: { id: student.id },
        data: { userId: application.studentUserId }
      });
    }

    await bot.sendMessage(adminChatId, `✅ Заявка одобрена. Студент создан (ID: ${student.id}).`);
    await notifyApplicationStatusChange(appId, 'APPROVED');
  }

  async function rejectApplicationFromBot(appId, adminChatId) {
    const application = await prisma.practiceApplication.findUnique({
      where: { id: appId }
    });

    if (!application) {
      await bot.sendMessage(adminChatId, '❌ Заявка не найдена.');
      return;
    }

    if (application.status !== 'PENDING') {
      await bot.sendMessage(adminChatId, '⚠️ Заявка уже обработана.');
      return;
    }

    const rejectionReason = 'Отклонено администратором через бота.';

    await prisma.practiceApplication.update({
      where: { id: appId },
      data: {
        status: 'REJECTED',
        rejectionReason
      }
    });

    await bot.sendMessage(adminChatId, '✅ Заявка отклонена.');
    await notifyApplicationStatusChange(appId, 'REJECTED', rejectionReason);
  }

  function parseDate(dateString) {
    if (!dateString) return null;

    const normalized = dateString.trim().replace(/\s+/g, '');
    const match = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; 
    const year = parseInt(match[3], 10);

    if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900 || year > 2100) return null;

    const date = new Date(year, month, day);
    if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
        return null; 
    }

    return date;
  }


// Функция для редактирования данных
async function handleEditData(chatId) {
  try {
    await bot.sendChatAction(chatId, 'typing');
    
    const studentUser = await prisma.studentUser.findFirst({
      where: { telegramId: chatId.toString() },
      include: {
        applications: {
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!studentUser || studentUser.applications.length === 0) {
      await bot.sendMessage(chatId, 
        '❌ У вас нет активной заявки для редактирования.\n\n' +
        'Сначала подайте заявку через /register',
        getRegisteredMenu()
      );
      return;
    }

    const application = studentUser.applications[0];
    
    // Разрешаем редактирование даже одобренных заявок, но с предупреждением
    if (application.status === 'APPROVED') {
      const confirmKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Да, редактировать', callback_data: `edit_approved_${application.id}` },
              { text: '❌ Отмена', callback_data: 'edit_cancel' }
            ]
          ]
        }
      };
      
      await bot.sendMessage(chatId, 
        '⚠️ *Внимание\\!*\n\n' +
        'Ваша заявка уже одобрена\\. Редактирование может потребовать повторного рассмотрения администратором\\.\n\n' +
        'Продолжить редактирование\\?',
        { parse_mode: 'Markdown', ...confirmKeyboard }
      );
      return;
    }

    const editKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📧 Email', callback_data: `edit_email_${application.id}` }],
          [{ text: '📱 Телефон', callback_data: `edit_phone_${application.id}` }],
          [{ text: '📅 Даты практики', callback_data: `edit_dates_${application.id}` }],
          [{ text: '🏫 Учебное заведение', callback_data: `edit_institution_${application.id}` }],
          [{ text: '📚 Курс', callback_data: `edit_course_${application.id}` }],
          [{ text: '❌ Отмена', callback_data: 'edit_cancel' }]
        ]
      }
    };

    const currentInfo = `
✏️ *Редактирование заявки*

Текущие данные:
📧 Email: ${escapeMarkdown(application.email || 'Не указан')}
📱 Телефон: ${escapeMarkdown(application.phone || 'Не указан')}
📅 Период: ${escapeMarkdown(formatDate(application.startDate))} \\- ${escapeMarkdown(formatDate(application.endDate))}
🏫 Учебное заведение: ${escapeMarkdown(application.institutionName || 'Не указано')}
📚 Курс: ${escapeMarkdown(String(application.course || 'Не указан'))}

Выберите, что хотите изменить:
    `;

    await bot.sendMessage(chatId, currentInfo, {
      parse_mode: 'Markdown',
      ...editKeyboard
    });
  } catch (error) {
    console.error('Ошибка редактирования данных:', error);
    await bot.sendMessage(chatId, 
      '❌ Произошла ошибка.\n\n' +
      'Пожалуйста, попробуйте позже.',
      getRegisteredMenu()
    );
  }
}

// Функция для настроек уведомлений
async function handleNotificationsSettings(chatId) {
  try {
    await bot.sendChatAction(chatId, 'typing');
    
    const studentUser = await prisma.studentUser.findFirst({
      where: { telegramId: chatId.toString() }
    });

    if (!studentUser) {
      await bot.sendMessage(chatId, 
        '❌ Вы не зарегистрированы в системе.\n\n' +
        'Используйте /register для регистрации.',
        getMainMenu()
      );
      return;
    }

    const notificationsInfo = `
🔔 *Настройки уведомлений*

Вы будете получать уведомления о:
✅ Изменении статуса заявки
✅ Одобрении или отклонении заявки
⏰ Ежедневные напоминания о сроках практики (за 30 дней до окончания)
📅 Напоминания о важных событиях

*Текущие настройки:*
🔔 Уведомления: Включены
📧 Email уведомления: ${studentUser.email ? 'Настроен' : 'Не настроен'}

*Примечание:* Настройки уведомлений управляются администратором системы. Если вы хотите изменить настройки, обратитесь к администратору.
    `;

    await bot.sendMessage(chatId, notificationsInfo, {
      parse_mode: 'Markdown',
      ...getRegisteredMenu()
    });
  } catch (error) {
    console.error('Ошибка настроек уведомлений:', error);
    await bot.sendMessage(chatId, 
      '❌ Произошла ошибка.\n\n' +
      'Пожалуйста, попробуйте позже.',
      getRegisteredMenu()
    );
  }
}

// Сохранение отредактированного значения
async function handleEditValue(chatId, text, editData) {
  try {
    console.log(`💾 Начало сохранения изменений: chatId=${chatId}, field=${editData.field}, applicationId=${editData.applicationId}`);
    console.log(`📝 Данные для сохранения:`, JSON.stringify(editData, null, 2));
    console.log(`📝 Введенный текст: "${text}"`);
    
    const { field, applicationId } = editData;
    
    if (!applicationId) {
      throw new Error('ApplicationId не указан в editData');
    }
    
    let updateData = {};
    let validationError = null;

    switch (field) {
      case 'email':
        if (text.trim() === '-') {
          updateData.email = null;
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(text.trim())) {
            validationError = '❌ Неверный формат email. Попробуйте еще раз или отправьте "-":';
          } else {
            updateData.email = text.trim();
          }
        }
        break;

      case 'phone':
        updateData.phone = text.trim() === '-' ? null : text.trim();
        break;

      case 'course':
        const course = parseInt(text);
        if (isNaN(course) || course < 1 || course > 10) {
          validationError = '❌ Курс должен быть числом от 1 до 10. Попробуйте еще раз:';
        } else {
          updateData.course = course;
        }
        break;

      case 'institutionName':
        if (!text || text.trim().length < 3) {
          validationError = '❌ Название учебного заведения должно содержать минимум 3 символа. Попробуйте еще раз:';
        } else {
          updateData.institutionName = text.trim();
        }
        break;

      case 'startDate':
        const startDate = parseDate(text.trim());
        if (!startDate) {
          validationError = '❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 01.09.2024):';
        } else {
          // Получаем текущую заявку для проверки endDate
          const application = await prisma.practiceApplication.findUnique({
            where: { id: applicationId }
          });
          
          if (application && application.endDate && startDate >= application.endDate) {
            validationError = '❌ Дата начала должна быть раньше даты окончания. Попробуйте еще раз:';
          } else {
            updateData.startDate = startDate;
            // Сохраняем startDate для следующего шага
            editData.startDate = startDate;
            // Запрашиваем endDate
            editData.field = 'endDate';
            const state = userStates.get(chatId);
            if (state) {
              state.data = editData;
            }
            await bot.sendMessage(chatId, 
              'Теперь введите новую *дату окончания практики* в формате ДД.ММ.ГГГГ:',
              { parse_mode: 'Markdown' }
            );
            return;
          }
        }
        break;

      case 'endDate':
        const endDate = parseDate(text.trim());
        if (!endDate) {
          validationError = '❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 30.12.2024):';
        } else {
          // Получаем текущую заявку или используем сохраненный startDate
          let startDate = editData.startDate;
          if (!startDate) {
            const application = await prisma.practiceApplication.findUnique({
              where: { id: applicationId }
            });
            startDate = application?.startDate;
          }
          
          if (startDate && endDate <= startDate) {
            validationError = '❌ Дата окончания должна быть позже даты начала. Попробуйте еще раз:';
          } else {
            updateData.endDate = endDate;
            // Если был обновлен startDate, добавляем его тоже
            if (editData.startDate) {
              updateData.startDate = editData.startDate;
            }
          }
        }
        break;
    }

    if (validationError) {
      await bot.sendMessage(chatId, validationError);
      return;
    }

    // Получаем текущую заявку для проверки статуса
    console.log(`🔍 Поиск заявки с ID: ${applicationId}`);
    const currentApplication = await prisma.practiceApplication.findUnique({
      where: { id: applicationId }
    });

    if (!currentApplication) {
      throw new Error(`Заявка с ID ${applicationId} не найдена`);
    }
    
    console.log(`✅ Заявка найдена:`, {
      id: currentApplication.id,
      status: currentApplication.status,
      firstName: currentApplication.firstName,
      lastName: currentApplication.lastName
    });

    // Если заявка была одобрена, переводим её обратно в PENDING для повторного рассмотрения
    if (currentApplication && currentApplication.status === 'APPROVED') {
      updateData.status = 'PENDING';
      updateData.notes = (currentApplication.notes || '') + '\n[Заявка отредактирована после одобрения, требуется повторное рассмотрение]';
    }

    // Сохраняем изменения в базу данных
    console.log(`💾 Сохранение изменений в БД:`, JSON.stringify(updateData, null, 2));
    const updatedApplication = await prisma.practiceApplication.update({
      where: { id: applicationId },
      data: updateData
    });
    console.log(`✅ Изменения успешно сохранены`);

    // Очищаем состояние редактирования
    const state = userStates.get(chatId);
    if (state) {
      state.state = RegistrationState.IDLE;
      state.data = {};
    }

    // Формируем понятное название поля
    const fieldNames = {
      email: 'Email',
      phone: 'Телефон',
      course: 'Курс',
      institutionName: 'Учебное заведение',
      startDate: 'Дата начала',
      endDate: 'Дата окончания'
    };

    const fieldName = fieldNames[field] || field;
    let newValue = updateData[field];
    
    if (field === 'startDate' || field === 'endDate') {
      newValue = formatDate(newValue);
    } else if (newValue === null || newValue === undefined) {
      newValue = 'Не указано';
    }
    
    // Преобразуем newValue в строку и экранируем
    const newValueStr = String(newValue || 'Не указано');

    // Отправляем уведомление пользователю
    let statusMessage = '';
    if (currentApplication && currentApplication.status === 'APPROVED' && updatedApplication.status === 'PENDING') {
      statusMessage = `\n⚠️ *Внимание\\:* Заявка переведена в статус "На рассмотрении" для повторного рассмотрения администратором\\.\n\n`;
    }
    
    const statusText = updatedApplication.status === 'PENDING' ? '⏳ На рассмотрении' : 
                      updatedApplication.status === 'APPROVED' ? '✅ Одобрена' : 
                      '❌ Отклонена';

    // Формируем сообщение об успешном обновлении
    const successMessage = `✅ Данные успешно обновлены!\n\n` +
      `📝 Изменено поле: ${fieldName}\n` +
      `🆕 Новое значение: ${newValueStr}\n\n` +
      `📋 Детали заявки:\n` +
      `ID: ${applicationId.substring(0, 8)}...\n` +
      `Статус: ${statusText}` +
      (statusMessage ? statusMessage.replace(/\*/g, '').replace(/\\/g, '') : '') +
      `\nИспользуйте /my_practice для просмотра обновленной информации.`;
    
    // Отправляем без Markdown, чтобы избежать проблем с парсингом
    await bot.sendMessage(chatId, successMessage, getRegisteredMenu());

    // Уведомляем администраторов об изменении заявки
    if (ADMIN_CHAT_IDS.length > 0) {
      const studentUser = await prisma.studentUser.findFirst({
        where: { telegramId: chatId.toString() }
      });

      let adminStatusNote = '';
      if (currentApplication && currentApplication.status === 'APPROVED' && updatedApplication.status === 'PENDING') {
        adminStatusNote = `\n⚠️ *Важно\\:* Заявка была одобрена, но после редактирования переведена в статус "На рассмотрении"\\. Требуется повторное рассмотрение\\.\n\n`;
      }
      
      const adminStatusText = updatedApplication.status === 'PENDING' ? '⏳ На рассмотрении' : 
                             updatedApplication.status === 'APPROVED' ? '✅ Одобрена' : 
                             '❌ Отклонена';

      const adminMessage = `🔔 *Заявка была отредактирована*\n\n` +
        `👤 *Студент\\:* ${escapeMarkdown(updatedApplication.lastName || '')} ${escapeMarkdown(updatedApplication.firstName || '')}\n` +
        `📝 *Изменено поле\\:* ${escapeMarkdown(fieldName)}\n` +
        `🆕 *Новое значение\\:* ${escapeMarkdown(newValueStr)}\n` +
        `📋 *ID заявки\\:* ${escapeMarkdown(applicationId)}\n` +
        `📊 *Статус\\:* ${adminStatusText}` +
        adminStatusNote +
        `Рекомендуется проверить изменения в заявке\\.`;

      const adminKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Одобрить', callback_data: `app_approve_${applicationId}` },
              { text: '❌ Отклонить', callback_data: `app_reject_${applicationId}` }
            ]
          ]
        }
      };

      for (const adminChatId of ADMIN_CHAT_IDS) {
        try {
          await bot.sendMessage(adminChatId, adminMessage, {
            parse_mode: 'Markdown',
            ...adminKeyboard
          });
        } catch (err) {
          console.error('Ошибка отправки уведомления админу:', adminChatId, err.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Ошибка сохранения изменений:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack?.substring(0, 1000)
    });
    
    let errorMessage = '❌ Произошла ошибка при сохранении изменений.\n\n';
    
    if (error.code === 'P2025') {
      errorMessage += 'Заявка не найдена. Возможно, она была удалена.';
    } else if (error.code === 'P2002') {
      errorMessage += 'Данные уже существуют в системе.';
    } else if (error.message?.includes('не найдена')) {
      errorMessage += 'Заявка не найдена.';
    } else {
      errorMessage += 'Пожалуйста, попробуйте позже.';
      if (process.env.NODE_ENV === 'development') {
        // Экранируем техническую информацию, чтобы избежать проблем с Markdown
        const techInfo = error.message || 'Неизвестная ошибка';
        errorMessage += `\n\nТехническая информация: ${techInfo.replace(/[*_`\[\]()~>#+=|{}.!-]/g, '\\$&')}`;
      }
    }
    
    // Отправляем сообщение об ошибке БЕЗ parse_mode, чтобы избежать проблем с парсингом
    await bot.sendMessage(chatId, errorMessage, getRegisteredMenu());
    
    // Очищаем состояние при ошибке
    const state = userStates.get(chatId);
    if (state) {
      state.state = RegistrationState.IDLE;
      state.data = {};
    }
  }
}

// Обработка редактирования одобренной заявки
async function handleEditApprovedApplication(chatId, appId) {
  try {
    const application = await prisma.practiceApplication.findUnique({
      where: { id: appId }
    });

    if (!application) {
      await bot.sendMessage(chatId, '❌ Заявка не найдена.', getRegisteredMenu());
      return;
    }

    const editKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📧 Email', callback_data: `edit_email_${application.id}` }],
          [{ text: '📱 Телефон', callback_data: `edit_phone_${application.id}` }],
          [{ text: '📅 Даты практики', callback_data: `edit_dates_${application.id}` }],
          [{ text: '🏫 Учебное заведение', callback_data: `edit_institution_${application.id}` }],
          [{ text: '📚 Курс', callback_data: `edit_course_${application.id}` }],
          [{ text: '❌ Отмена', callback_data: 'edit_cancel' }]
        ]
      }
    };

    const currentInfo = `
✏️ *Редактирование одобренной заявки*

⚠️ *Внимание:* После редактирования заявка может потребовать повторного рассмотрения\\.

Текущие данные:
📧 Email: ${escapeMarkdown(application.email || 'Не указан')}
📱 Телефон: ${escapeMarkdown(application.phone || 'Не указан')}
📅 Период: ${escapeMarkdown(formatDate(application.startDate))} \\- ${escapeMarkdown(formatDate(application.endDate))}
🏫 Учебное заведение: ${escapeMarkdown(application.institutionName || 'Не указано')}
📚 Курс: ${escapeMarkdown(String(application.course || 'Не указан'))}

Выберите, что хотите изменить:
    `;

    await bot.sendMessage(chatId, currentInfo, {
      parse_mode: 'Markdown',
      ...editKeyboard
    });
  } catch (error) {
    console.error('Ошибка редактирования одобренной заявки:', error);
    await bot.sendMessage(chatId, 
      '❌ Произошла ошибка.\n\n' +
      'Пожалуйста, попробуйте позже.',
      getRegisteredMenu()
    );
  }
}

// Админская команда
async function handleAdminCommand(msg) {
  const chatId = msg.chat.id;
  
  if (!ADMIN_CHAT_IDS.includes(chatId.toString())) {
    await bot.sendMessage(chatId, 
      '❌ У вас нет прав администратора.\n\n' +
      'Эта команда доступна только администраторам системы.',
      getMainMenu()
    );
    return;
  }

  try {
    await bot.sendChatAction(chatId, 'typing');

    const pendingCount = await prisma.practiceApplication.count({
      where: { status: 'PENDING' }
    });

    const approvedCount = await prisma.practiceApplication.count({
      where: { status: 'APPROVED' }
    });

    const rejectedCount = await prisma.practiceApplication.count({
      where: { status: 'REJECTED' }
    });

    const activeStudents = await prisma.student.count({
      where: { status: 'ACTIVE' }
    });

    const adminMessage = `👨‍💼 *Панель администратора*\n\n` +
      `📊 *Статистика заявок:*\n` +
      `⏳ На рассмотрении: ${pendingCount}\n` +
      `✅ Одобрено: ${approvedCount}\n` +
      `❌ Отклонено: ${rejectedCount}\n\n` +
      `👥 *Активных студентов:* ${activeStudents}\n\n` +
      `*Доступные команды:*\n` +
      `/pending - Просмотр заявок на рассмотрении\n` +
      `/admin - Эта панель\n\n` +
      `При новой заявке вы получите уведомление с кнопками для одобрения/отклонения.`;

    const adminKeyboard = {
      reply_markup: {
        keyboard: [
          [{ text: '📋 Заявки на рассмотрении' }],
          [{ text: '📊 Статистика' }],
          [{ text: '🔙 Главное меню' }]
        ],
        resize_keyboard: true
      }
    };

    await bot.sendMessage(chatId, adminMessage, {
      parse_mode: 'Markdown',
      ...adminKeyboard
    });
  } catch (error) {
    console.error('Ошибка админской команды:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка.', getMainMenu());
  }
}

// Просмотр заявок на рассмотрении
async function handlePendingApplications(msg) {
  const chatId = msg.chat.id;
  
  if (!ADMIN_CHAT_IDS.includes(chatId.toString())) {
    await bot.sendMessage(chatId, 
      '❌ У вас нет прав администратора.',
      getMainMenu()
    );
    return;
  }

  try {
    await bot.sendChatAction(chatId, 'typing');

    const pendingApplications = await prisma.practiceApplication.findMany({
      where: { status: 'PENDING' },
      include: {
        studentUser: {
          select: {
            username: true,
            email: true,
            telegramId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (pendingApplications.length === 0) {
      await bot.sendMessage(chatId, 
        '✅ Нет заявок на рассмотрении.',
        getMainMenu()
      );
      return;
    }

    const practiceTypeNames = {
      EDUCATIONAL: 'Учебная',
      PRODUCTION: 'Производственная',
      INTERNSHIP: 'Стажировка'
    };

    let message = `📋 *Заявки на рассмотрении*\n\n`;
    message += `Всего: ${pendingApplications.length}\n\n`;

    for (const app of pendingApplications) {
      const practiceType = practiceTypeNames[app.practiceType] || app.practiceType;
      const date = formatDate(app.createdAt);
      
      message += `*${app.lastName} ${app.firstName}*\n`;
      message += `Тип: ${practiceType}\n`;
      message += `Учебное заведение: ${app.institutionName}\n`;
      message += `Период: ${formatDate(app.startDate)} - ${formatDate(app.endDate)}\n`;
      message += `Дата подачи: ${date}\n`;
      
      const adminKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Одобрить', callback_data: `app_approve_${app.id}` },
              { text: '❌ Отклонить', callback_data: `app_reject_${app.id}` }
            ]
          ]
        }
      };
      
      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...adminKeyboard
      });
      
      message = ''; // Очищаем для следующей заявки
    }
  } catch (error) {
    console.error('Ошибка получения заявок:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка.', getMainMenu());
  }
}

// Обработка callback для редактирования
async function handleEditCallback(query, data, chatId) {
  try {
    console.log(`✏️ Обработка редактирования: field=${data}, chatId=${chatId}`);
    
    // Подтверждаем нажатие кнопки (если еще не было подтверждено)
    try {
      await bot.answerCallbackQuery(query.id, { text: 'Ожидаю ввода нового значения...', show_alert: false });
    } catch (err) {
      console.warn('Callback уже был обработан:', err.message);
    }
    
    // Инициализируем состояние, если его нет
    let state = userStates.get(chatId);
    if (!state) {
      state = initUserState(chatId);
      userStates.set(chatId, state);
      console.log(`✅ Инициализировано новое состояние для chatId=${chatId}`);
    }
    
    console.log(`📝 Устанавливаем состояние редактирования: field будет определен ниже`);
    
    if (data.startsWith('edit_email_')) {
      const appId = data.replace('edit_email_', '');
      state.state = EditState.WAITING_VALUE;
      state.data = { field: 'email', applicationId: appId };
      
      // Закрываем клавиатуру предыдущего сообщения
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch (err) {
        // Игнорируем ошибку, если сообщение уже было изменено
      }
      
      // Отправляем новое сообщение с инструкцией
      console.log(`📧 Отправка сообщения для редактирования email, appId=${appId}`);
      await bot.sendMessage(
        chatId,
        '✏️ *Редактирование Email*\n\n' +
        'Введите новый email адрес:\n' +
        '(или отправьте "-" чтобы оставить пустым)',
        { parse_mode: 'Markdown' }
      );
      console.log(`✅ Сообщение для редактирования email отправлено`);
    } else if (data.startsWith('edit_phone_')) {
      const appId = data.replace('edit_phone_', '');
      state.state = EditState.WAITING_VALUE;
      state.data = { field: 'phone', applicationId: appId };
      
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch (err) {}
      
      await bot.sendMessage(
        chatId,
        '✏️ *Редактирование Телефона*\n\n' +
        'Введите новый номер телефона:\n' +
        '(или отправьте "-" чтобы оставить пустым)',
        { parse_mode: 'Markdown' }
      );
    } else if (data.startsWith('edit_course_')) {
      const appId = data.replace('edit_course_', '');
      state.state = EditState.WAITING_VALUE;
      state.data = { field: 'course', applicationId: appId };
      
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch (err) {}
      
      await bot.sendMessage(
        chatId,
        '✏️ *Редактирование Курса*\n\n' +
        'Введите новый курс (от 1 до 10):',
        { parse_mode: 'Markdown' }
      );
    } else if (data.startsWith('edit_institution_')) {
      const appId = data.replace('edit_institution_', '');
      state.state = EditState.WAITING_VALUE;
      state.data = { field: 'institutionName', applicationId: appId };
      
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch (err) {}
      
      await bot.sendMessage(
        chatId,
        '✏️ *Редактирование Учебного заведения*\n\n' +
        'Введите новое название учебного заведения:',
        { parse_mode: 'Markdown' }
      );
    } else if (data.startsWith('edit_dates_')) {
      const appId = data.replace('edit_dates_', '');
      state.state = EditState.WAITING_VALUE;
      state.data = { field: 'startDate', applicationId: appId };
      
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch (err) {}
      
      await bot.sendMessage(
        chatId,
        '✏️ *Редактирование Дат практики*\n\n' +
        'Введите новую дату начала практики в формате ДД.ММ.ГГГГ:\n' +
        'Например: 01.09.2024',
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('❌ Ошибка обработки редактирования:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 500)
    });
    try {
      await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка', show_alert: true });
      await bot.sendMessage(chatId, 
        '❌ Произошла ошибка при редактировании.\n\n' +
        'Пожалуйста, попробуйте позже.',
        getRegisteredMenu()
      );
    } catch (sendError) {
      console.error('Ошибка отправки сообщения об ошибке:', sendError);
    }
  }
}

// Функция для просмотра списка заданий
async function handleTasksList(chatId) {
  try {
    await bot.sendChatAction(chatId, 'typing');

    const studentUser = await prisma.studentUser.findFirst({
      where: { telegramId: chatId.toString() },
      include: {
        student: true
      }
    });

    if (!studentUser || !studentUser.student) {
      await bot.sendMessage(chatId, 
        '❌ Вы не зарегистрированы как студент.\n\n' +
        'Используйте /register для регистрации.',
        getMainMenu()
      );
      return;
    }

    const tasks = await prisma.task.findMany({
      where: {
        studentId: studentUser.student.id,
        status: { notIn: ['DELETED'] }
      },
      include: {
        submissions: {
          where: {
            studentId: studentUser.student.id
          },
          orderBy: {
            submittedAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        deadline: 'asc'
      }
    });

    if (tasks.length === 0) {
      await bot.sendMessage(chatId, 
        '📋 У вас пока нет заданий.\n\n' +
        'Задания будут появляться здесь, когда администратор их назначит.',
        getRegisteredMenu()
      );
      return;
    }

    let message = `📋 *Ваши задания*\n\n`;
    message += `Всего заданий: ${tasks.length}\n\n`;

    for (const task of tasks) {
      const deadlineFormatted = formatDate(task.deadline);
      const daysRemaining = calculateDaysRemaining(task.deadline);
      
      let statusIcon = '⏳';
      let statusText = 'Ожидает выполнения';
      if (task.submissions && task.submissions.length > 0) {
        const submission = task.submissions[0];
        if (submission.status === 'COMPLETED') {
          statusIcon = '✅';
          statusText = 'Выполнено';
        } else if (submission.status === 'UNDER_REVIEW') {
          statusIcon = '🔍';
          statusText = 'На проверке';
        } else if (submission.status === 'REJECTED') {
          statusIcon = '❌';
          statusText = 'Отклонено';
        } else {
          statusIcon = '📤';
          statusText = 'Отправлено';
        }
      } else if (daysRemaining < 0) {
        statusIcon = '⚠️';
        statusText = 'Просрочено';
      }

      message += `${statusIcon} *${escapeMarkdown(task.title)}*\n`;
      message += `📅 Дедлайн: ${escapeMarkdown(deadlineFormatted)}`;
      if (daysRemaining >= 0) {
        message += ` (осталось ${daysRemaining} дн.)`;
      } else {
        message += ` (просрочено на ${Math.abs(daysRemaining)} дн.)`;
      }
      message += `\n📊 Статус: ${statusText}\n\n`;
    }

    // Создаем клавиатуру: для каждого задания отдельная строка с кнопками
    const keyboardRows = [];
    
    for (const task of tasks) {
      const hasSubmission = task.submissions && task.submissions.length > 0;
      const submission = hasSubmission ? task.submissions[0] : null;
      
      // Определяем, можно ли отправить решение
      let canSubmit = true;
      if (hasSubmission && submission) {
        canSubmit = submission.status === 'REJECTED';
      }
      
      // Первая строка: название задания (кликабельное)
      const taskTitle = task.title.length > 35 ? task.title.substring(0, 35) + '...' : task.title;
      keyboardRows.push([
        { 
          text: `📋 ${taskTitle}`, 
          callback_data: `task_view_${task.id}` 
        }
      ]);
      
      // Вторая строка: кнопка отправки решения (ВСЕГДА показываем для заданий без решения)
      if (canSubmit) {
        // Можно отправить решение - большая заметная кнопка
        keyboardRows.push([
          { 
            text: '📤 Отправить решение', 
            callback_data: `task_submit_${task.id}` 
          }
        ]);
      } else if (hasSubmission && submission) {
        // Показываем статус решения
        const statusText = {
          'SUBMITTED': '📤 Решение отправлено',
          'UNDER_REVIEW': '🔍 На проверке',
          'COMPLETED': '✅ Решение принято',
          'REJECTED': '❌ Решение отклонено'
        };
        const statusButtonText = statusText[submission.status] || '📊 Статус';
        keyboardRows.push([
          { 
            text: statusButtonText, 
            callback_data: `task_view_${task.id}` 
          }
        ]);
        // Если отклонено, можно отправить заново
        if (submission.status === 'REJECTED') {
          keyboardRows.push([
            { 
              text: '🔄 Отправить заново', 
              callback_data: `task_submit_${task.id}` 
            }
          ]);
        }
      } else {
        // На всякий случай, если что-то пошло не так - все равно показываем кнопку
        keyboardRows.push([
          { 
            text: '📤 Отправить решение', 
            callback_data: `task_submit_${task.id}` 
          }
        ]);
      }
    }
    
    // Проверяем, что кнопки созданы
    if (keyboardRows.length === 0) {
      console.warn('⚠️ Не создано ни одной кнопки для заданий!');
    } else {
      console.log(`✅ Создано ${keyboardRows.length} строк кнопок для ${tasks.length} заданий`);
    }
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: keyboardRows
      }
    };

    // Разбиваем сообщение на части, если оно слишком длинное
    if (message.length > 4096) {
      const parts = message.match(/[\s\S]{1,4000}/g) || [];
      for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) {
          // В последней части добавляем кнопки
          await bot.sendMessage(chatId, parts[i], { 
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup
          });
        } else {
          await bot.sendMessage(chatId, parts[i], { 
            parse_mode: 'Markdown'
          });
        }
      }
    } else {
      // Отправляем сообщение с кнопками
      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    }
  } catch (error) {
    console.error('Ошибка получения заданий:', error);
    await bot.sendMessage(chatId, 
      '❌ Произошла ошибка при получении заданий.\n\n' +
      'Пожалуйста, попробуйте позже.',
      getRegisteredMenu()
    );
  }
}

// Функция для просмотра деталей задания
async function handleTaskView(chatId, taskId) {
  try {
    await bot.sendChatAction(chatId, 'typing');

    const studentUser = await prisma.studentUser.findFirst({
      where: { telegramId: chatId.toString() },
      include: {
        student: true
      }
    });

    if (!studentUser || !studentUser.student) {
      await bot.sendMessage(chatId, '❌ Студент не найден.', getRegisteredMenu());
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        submissions: {
          where: {
            studentId: studentUser.student.id
          },
          orderBy: {
            submittedAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!task) {
      await bot.sendMessage(chatId, '❌ Задание не найдено.', getRegisteredMenu());
      return;
    }

    if (task.studentId !== studentUser.student.id) {
      await bot.sendMessage(chatId, '❌ Это задание не назначено вам.', getRegisteredMenu());
      return;
    }

    const deadlineFormatted = formatDate(task.deadline);
    const daysRemaining = calculateDaysRemaining(task.deadline);
    
    let message = `📋 *${escapeMarkdown(task.title)}*\n\n`;
    message += `${escapeMarkdown(task.description)}\n\n`;
    message += `📅 *Дедлайн:* ${escapeMarkdown(deadlineFormatted)}\n`;
    
    if (daysRemaining >= 0) {
      message += `⏰ *Осталось:* ${daysRemaining} ${daysRemaining === 1 ? 'день' : daysRemaining < 5 ? 'дня' : 'дней'}\n`;
    } else {
      message += `⚠️ *Просрочено на:* ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'день' : Math.abs(daysRemaining) < 5 ? 'дня' : 'дней'}\n`;
    }

    if (task.referenceLink) {
      message += `🔗 *Ссылка:* ${escapeMarkdown(task.referenceLink)}\n`;
    }

    if (task.submissions && task.submissions.length > 0) {
      const submission = task.submissions[0];
      message += `\n📊 *Статус решения:*\n`;
      
      const statusMessages = {
        'SUBMITTED': '📤 Отправлено',
        'UNDER_REVIEW': '🔍 На проверке',
        'COMPLETED': '✅ Принято',
        'REJECTED': '❌ Отклонено'
      };
      
      message += `${statusMessages[submission.status] || submission.status}\n`;
      
      if (submission.solutionLink) {
        message += `🔗 *Ваше решение:* ${escapeMarkdown(submission.solutionLink)}\n`;
      }
      
      if (submission.solutionDescription) {
        message += `📝 *Описание:* ${escapeMarkdown(submission.solutionDescription.substring(0, 200))}${submission.solutionDescription.length > 200 ? '...' : ''}\n`;
      }
      
      if (submission.grade) {
        message += `⭐ *Оценка:* ${submission.grade}/10\n`;
      }
      
      if (submission.reviewComment) {
        message += `💬 *Комментарий:* ${escapeMarkdown(submission.reviewComment)}\n`;
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Отправить заново', callback_data: `task_submit_${taskId}` }],
            [{ text: '◀️ Назад к списку', callback_data: 'tasks_list' }]
          ]
        }
      };

      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } else {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `💡 *Чтобы отправить решение, нажмите кнопку ниже*`;
      
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📤 Отправить решение', callback_data: `task_submit_${taskId}` }],
            [{ text: '◀️ Назад к списку', callback_data: 'tasks_list' }]
          ]
        }
      };

      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    }
  } catch (error) {
    console.error('Ошибка просмотра задания:', error);
    await bot.sendMessage(chatId, 
      '❌ Произошла ошибка.\n\n' +
      'Пожалуйста, попробуйте позже.',
      getRegisteredMenu()
    );
  }
}

// Начало отправки решения задания
async function handleTaskSubmitStart(chatId, taskId) {
  try {
    console.log(`📤 handleTaskSubmitStart вызван: chatId=${chatId}, taskId=${taskId}`);
    // Получаем информацию о задании для отображения
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      await bot.sendMessage(chatId, '❌ Задание не найдено.', getRegisteredMenu());
      return;
    }

    const state = userStates.get(chatId) || initUserState(chatId);
    state.state = TaskSubmissionState.WAITING_SOLUTION;
    state.data = { taskId };

    const deadlineFormatted = formatDate(task.deadline);
    
    await bot.sendMessage(chatId,
      `📤 *Отправка решения задания*\n\n` +
      `*${escapeMarkdown(task.title)}*\n\n` +
      `📅 Дедлайн: ${escapeMarkdown(deadlineFormatted)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*Что нужно отправить?*\n\n` +
      `Вы можете отправить:\n` +
      `• 🔗 Ссылку на репозиторий (GitHub, GitLab и т.д.)\n` +
      `• 📎 Ссылку на файл или документ (Google Drive, Dropbox и т.д.)\n` +
      `• 📝 Текстовое описание решения\n\n` +
      `*Примеры:*\n` +
      `• https://github.com/username/repo\n` +
      `• https://drive.google.com/file/...\n` +
      `• Описание: Реализовал калькулятор с функциями...\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Просто отправьте ссылку или текст в следующем сообщении\\.\n` +
      `Используйте /cancel для отмены\\.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Ошибка начала отправки решения:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка.', getRegisteredMenu());
  }
}

// Обработка отправки решения задания
async function handleTaskSubmitSolution(chatId, text, submitData) {
  try {
    const { taskId } = submitData;

    // Проверяем, является ли текст URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    const solutionLink = urls && urls.length > 0 ? urls[0] : null;
    const solutionDescription = solutionLink ? text.replace(urlRegex, '').trim() || null : text.trim();

    if (!solutionLink && !solutionDescription) {
      await bot.sendMessage(chatId,
        '❌ Пожалуйста, отправьте ссылку на решение или описание.\n\n' +
        'Используйте /cancel для отмены.',
        getRegisteredMenu()
      );
      return;
    }

    const studentUser = await prisma.studentUser.findFirst({
      where: { telegramId: chatId.toString() },
      include: {
        student: true
      }
    });

    if (!studentUser || !studentUser.student) {
      await bot.sendMessage(chatId, '❌ Студент не найден.', getRegisteredMenu());
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task || task.studentId !== studentUser.student.id) {
      await bot.sendMessage(chatId, '❌ Задание не найдено или не назначено вам.', getRegisteredMenu());
      return;
    }

    // Проверяем существующее решение
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: {
        taskId_studentId: {
          taskId,
          studentId: studentUser.student.id
        }
      }
    });

    let submission;
    if (existingSubmission) {
      submission = await prisma.taskSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          solutionLink,
          solutionDescription,
          status: 'SUBMITTED',
          submittedAt: new Date()
        }
      });
    } else {
      submission = await prisma.taskSubmission.create({
        data: {
          taskId,
          studentId: studentUser.student.id,
          solutionLink,
          solutionDescription,
          status: 'SUBMITTED'
        }
      });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'SUBMITTED'
      }
    });

    // Очищаем состояние
    const state = userStates.get(chatId);
    if (state) {
      state.state = TaskSubmissionState.IDLE;
      state.data = {};
    }

    await bot.sendMessage(chatId,
      `✅ *Решение отправлено\\!*\n\n` +
      `Ваше решение отправлено на проверку администратору\\.\n\n` +
      (solutionLink ? `🔗 *Ссылка:* ${escapeMarkdown(solutionLink)}\n` : '') +
      (solutionDescription ? `📝 *Описание:* ${escapeMarkdown(solutionDescription.substring(0, 100))}${solutionDescription.length > 100 ? '...' : ''}\n` : '') +
      `\nВы получите уведомление, когда администратор проверит решение\\.`,
      { parse_mode: 'Markdown', ...getRegisteredMenu() }
    );

    // Уведомляем админов
    const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_CHAT_ID || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (ADMIN_CHAT_IDS.length > 0) {
      const studentName = `${studentUser.student.lastName} ${studentUser.student.firstName}${studentUser.student.middleName ? ' ' + studentUser.student.middleName : ''}`;
      const message = `📥 *Новое решение задания*\n\n` +
        `👤 *Студент:* ${escapeMarkdown(studentName)}\n` +
        `📋 *Задание:* ${escapeMarkdown(task.title)}\n` +
        `📅 *Отправлено:* ${new Date(submission.submittedAt).toLocaleString('ru-RU')}\n\n` +
        (solutionLink ? `🔗 *Ссылка:* ${escapeMarkdown(solutionLink)}\n` : '') +
        (solutionDescription ? `📝 *Описание:* ${escapeMarkdown(solutionDescription.substring(0, 200))}${solutionDescription.length > 200 ? '...' : ''}\n` : '') +
        `\nПроверьте решение на панели администратора\\.`;

      for (const adminChatId of ADMIN_CHAT_IDS) {
        try {
          await sendNotification(adminChatId, message);
        } catch (error) {
          console.error('Ошибка отправки уведомления админу:', error);
        }
      }
    }
  } catch (error) {
    console.error('Ошибка отправки решения:', error);
    await bot.sendMessage(chatId,
      '❌ Произошла ошибка при отправке решения\\.\n\n' +
      'Пожалуйста, попробуйте позже\\.',
      getRegisteredMenu()
    );
  }
}

function startDailyNotifications() {
  if (!bot) return;

  async function sendDailyNotifications() {
    try {
      const activeStudents = await prisma.student.findMany({
        where: {
          status: { in: ['ACTIVE', 'PENDING'] },
          telegramId: { not: null },
          endDate: { gte: new Date() }
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const student of activeStudents) {
        const daysRemaining = calculateDaysRemaining(student.endDate);
        
        if (daysRemaining >= 0 && daysRemaining <= 30) {
          let message = '';
          
          if (daysRemaining === 0) {
            message = `⚠️ *Сегодня последний день вашей практики!*\n\n` +
                     `Практика завершается сегодня (${formatDate(student.endDate)}).\n\n` +
                     `Убедитесь, что все задачи выполнены.`;
          } else if (daysRemaining === 1) {
            message = `⏰ *Напоминание:* До окончания практики остался *1 день*!\n\n` +
                     `Практика завершается завтра (${formatDate(student.endDate)}).`;
          } else {
            let daysWord = 'дней';
            const lastDigit = daysRemaining % 10;
            const lastTwoDigits = daysRemaining % 100;
            
            if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
              daysWord = 'дней';
            } else if (lastDigit === 1) {
              daysWord = 'день';
            } else if (lastDigit >= 2 && lastDigit <= 4) {
              daysWord = 'дня';
            }
            
            message = `⏰ *Ежедневное напоминание*\n\n` +
                     `До окончания практики осталось *${daysRemaining} ${daysWord}*.\n\n` +
                     `Дата окончания: ${formatDate(student.endDate)}`;
          }

          try {
            await sendNotification(student.telegramId, message);
            console.log(`Отправлено уведомление студенту ${student.telegramId} (осталось ${daysRemaining} дней)`);
          } catch (error) {
            console.error(`Ошибка отправки уведомления студенту ${student.telegramId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка отправки ежедневных уведомлений:', error);
    }

    try {
      const adminChatIds = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_CHAT_ID || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

      if (adminChatIds.length) {
        const now = new Date();
        const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
        const endOfToday = new Date(now); endOfToday.setHours(23,59,59,999);
        const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
        const endOfTomorrow = new Date(endOfToday); endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

        const [activeCount, startsToday, startsTomorrow, endsToday, endsTomorrow] = await Promise.all([
          prisma.student.count({
            where: {
              status: 'ACTIVE',
              startDate: { lte: now },
              endDate: { gte: now }
            }
          }),
          prisma.student.findMany({
            where: { startDate: { gte: startOfToday, lte: endOfToday } },
            select: { lastName: true, firstName: true, practiceType: true, institutionName: true }
          }),
          prisma.student.findMany({
            where: { startDate: { gte: startOfTomorrow, lte: endOfTomorrow } },
            select: { lastName: true, firstName: true, practiceType: true, institutionName: true }
          }),
          prisma.student.findMany({
            where: {
              endDate: { gte: startOfToday, lte: endOfToday },
              status: { in: ['PENDING', 'ACTIVE'] }
            },
            select: { lastName: true, firstName: true, practiceType: true, institutionName: true }
          }),
          prisma.student.findMany({
            where: {
              endDate: { gte: startOfTomorrow, lte: endOfTomorrow },
              status: { in: ['PENDING', 'ACTIVE'] }
            },
            select: { lastName: true, firstName: true, practiceType: true, institutionName: true }
          })
        ]);

        const practiceTypeNames = {
          EDUCATIONAL: 'Учебная',
          PRODUCTION: 'Производственная',
          INTERNSHIP: 'Стажировка'
        };

        const formatList = (items) => items.map(s =>
          `• ${s.lastName} ${s.firstName} — ${practiceTypeNames[s.practiceType] || s.practiceType} (${s.institutionName || '—'})`
        ).join('\n');

        const digest = `
📊 Ежедневный дайджест PracticeHub

• Активных сейчас: ${activeCount}

🟢 Начинают сегодня: ${startsToday.length}
${startsToday.length ? formatList(startsToday) : '—'}

🟢 Начинают завтра: ${startsTomorrow.length}
${startsTomorrow.length ? formatList(startsTomorrow) : '—'}

🔴 Заканчивают сегодня: ${endsToday.length}
${endsToday.length ? formatList(endsToday) : '—'}

🔴 Заканчивают завтра: ${endsTomorrow.length}
${endsTomorrow.length ? formatList(endsTomorrow) : '—'}
        `;

        for (const chatId of adminChatIds) {
          await sendNotification(chatId, digest);
        }
      }
    } catch (error) {
      console.error('Ошибка отправки дайджеста администратору:', error);
    }
  }

  const now = new Date();
  const nextRun = new Date();
  nextRun.setHours(9, 0, 0, 0);
  
  if (now > nextRun) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const msUntilNextRun = nextRun - now;
  
  console.log(`📅 Ежедневные уведомления будут отправляться в 9:00. Следующий запуск через ${Math.round(msUntilNextRun / 1000 / 60)} минут`);

  setTimeout(() => {
    sendDailyNotifications();
    
    setInterval(sendDailyNotifications, 24 * 60 * 60 * 1000);
  }, msUntilNextRun);
}

export async function notifyApplicationStatusChange(applicationId, newStatus, rejectionReason = null) {
  if (!bot) {
    console.warn('Бот не инициализирован, уведомление не отправлено');
    return false;
  }

  try {
    console.log('Получение информации о заявке для уведомления:', applicationId);
    
    const application = await prisma.practiceApplication.findUnique({
      where: { id: applicationId },
      include: {
        studentUser: true
      }
    });

    if (!application) {
      console.log('Заявка не найдена:', applicationId);
      return false;
    }

    let telegramId = null;
    
    if (application.studentUser && application.studentUser.telegramId) {
      telegramId = application.studentUser.telegramId;
      console.log('Найден telegramId в studentUser:', telegramId);
    } else if (application.telegramId) {
      telegramId = application.telegramId;
      console.log('Найден telegramId в заявке:', telegramId);
    }

    if (!telegramId) {
      console.log('Не найден telegramId для заявки', applicationId);
      console.log('studentUser:', application.studentUser ? 'exists' : 'null');
      console.log('application.telegramId:', application.telegramId);
      return false;
    }
    let message = '';

    const practiceTypeNames = {
      EDUCATIONAL: 'Учебная',
      PRODUCTION: 'Производственная',
      INTERNSHIP: 'Стажировка'
    };

    if (newStatus === 'APPROVED') {
      message = `✅ *Ваша заявка одобрена\\!*\n\n` +
               `Администратор рассмотрел вашу заявку на практику и одобрил её\\.\n\n` +
               `📋 *Детали заявки:*\n` +
               `👤 *Студент:* ${escapeMarkdown(application.lastName || '')} ${escapeMarkdown(application.firstName || '')}${application.middleName ? ' ' + escapeMarkdown(application.middleName) : ''}\n` +
               `📚 *Тип практики:* ${escapeMarkdown(practiceTypeNames[application.practiceType] || application.practiceType || 'Не указан')}\n` +
               `🏫 *Учебное заведение:* ${escapeMarkdown(application.institutionName || 'Не указано')}\n` +
               `📅 *Период практики:*\n` +
               `   Начало: ${escapeMarkdown(formatDate(application.startDate))}\n` +
               `   Окончание: ${escapeMarkdown(formatDate(application.endDate))}\n\n` +
               `💡 *Что дальше\\?*\n` +
               `• Используйте кнопку "📅 Моя практика" или команду /my_practice для просмотра подробной информации\n` +
               `• Вы будете получать ежедневные напоминания о количестве оставшихся дней до окончания практики\n\n` +
               `Поздравляем\\! 🎉`;
    } else if (newStatus === 'REJECTED') {
      message = `❌ *Ваша заявка отклонена*\n\n` +
               `К сожалению, администратор отклонил вашу заявку на практику.\n\n`;
      
      if (rejectionReason) {
        message += `📝 *Причина отклонения:*\n${escapeMarkdown(rejectionReason)}\n\n`;
      } else {
        message += `*Причина:* Не указана\n\n`;
      }
      
      message += `📋 *Детали заявки:*\n` +
               `👤 *Студент:* ${escapeMarkdown(application.lastName || '')} ${escapeMarkdown(application.firstName || '')}${application.middleName ? ' ' + escapeMarkdown(application.middleName) : ''}\n` +
               `📚 *Тип практики:* ${escapeMarkdown(practiceTypeNames[application.practiceType] || application.practiceType || 'Не указан')}\n` +
               `🏫 *Учебное заведение:* ${escapeMarkdown(application.institutionName || 'Не указано')}\n` +
               `📅 *Период:* ${escapeMarkdown(formatDate(application.startDate))} \\- ${escapeMarkdown(formatDate(application.endDate))}\n\n` +
               `💡 *Что дальше\\?*\n` +
               `• Если у вас есть вопросы, обратитесь к администратору системы\n` +
               `• Вы можете подать новую заявку, исправив указанные проблемы\n` +
               `• Используйте команду /register для подачи новой заявки`;
    }

    if (message) {
      const success = await sendNotification(telegramId, message);
      if (success) {
        console.log(`Отправлено уведомление о статусе заявки ${applicationId} пользователю ${telegramId}`);
      }
      return success;
    }

    return false;
  } catch (error) {
    console.error('Ошибка отправки уведомления об изменении статуса:', error);
    return false;
  }
}


export default bot;


export async function sendNotification(telegramId, message) {
  if (!bot) {
    console.warn('Бот не инициализирован, уведомление не отправлено');
    return false;
  }
  try {
    await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    return true;
  } catch (error) {
    console.error(`Ошибка отправки уведомления пользователю ${telegramId}:`, error);
    return false;
  }
}


export async function sendBulkNotifications(telegramIds, message) {
  if (!bot) {
    console.warn('Бот не инициализирован, уведомления не отправлены');
    return telegramIds.map(id => ({ telegramId: id, success: false }));
  }
  const results = [];
  for (const telegramId of telegramIds) {
    const success = await sendNotification(telegramId, message);
    results.push({ telegramId, success });
  }
  return results;
}

// Инициализация бота при загрузке модуля
if (token) {
  initializeBot().then((success) => {
    if (success) {
      console.log('✅ Telegram-бот полностью инициализирован и готов к работе');
    } else {
      console.warn('⚠️ Telegram-бот не инициализирован, но сервер продолжит работу');
      console.warn('💡 Функции уведомлений через Telegram будут недоступны');
      console.warn('💡 Проверьте интернет-соединение и доступность Telegram API');
    }
  }).catch((error) => {
    console.error('❌ Критическая ошибка инициализации бота:', error.message);
    console.warn('⚠️ Сервер продолжит работу без Telegram-бота');
  });
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN не установлен, бот не будет работать');
}