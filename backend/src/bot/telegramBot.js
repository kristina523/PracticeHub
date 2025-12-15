import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const token = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;
let botInfo = null;

if (token) {
  try {
    bot = new TelegramBot(token, { 
      polling: {
        interval: 300, 
        autoStart: true,
        params: {
          timeout: 10   
        }
      }
    });
    
    console.log('🔄 Инициализация Telegram-бота...');
    
    bot.getMe().then((info) => {
      botInfo = info;
      console.log(`✅ Telegram-бот инициализирован: @${info.username}`);
      console.log(`🔗 Ссылка на бота: https://t.me/${info.username}`);
      console.log(`📡 Polling активен, бот готов к работе`);
    }).catch((error) => {
      console.error('❌ Ошибка получения информации о боте:', error.message);
      console.error('Детали ошибки:', error);
    });

    bot.on('polling_error', (error) => {
      console.error('❌ Ошибка polling Telegram бота:', error.message || error);
      if (error.code === 'EFATAL') {
        console.error('Критическая ошибка polling, перезапуск...');
        setTimeout(() => {
          if (bot) {
            bot.stopPolling().then(() => {
              bot.startPolling();
              console.log('🔄 Polling перезапущен');
            }).catch(err => {
              console.error('Ошибка перезапуска polling:', err);
            });
          }
        }, 5000);
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка инициализации Telegram-бота:', error.message);
    console.error('Детали ошибки:', error);
    bot = null;
  }
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN не установлен, бот не будет работать');
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
        [{ text: '📅 Моя практика' }],
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
    console.log('studentId:', studentUser.studentId);

    const approvedApplication = studentUser.applications.find(app => app.status === 'APPROVED');
    
    if (approvedApplication) {
      console.log('Найдена одобренная заявка:', approvedApplication.id);
      
      if (studentUser.studentId) {
        console.log('Ищем студента с ID:', studentUser.studentId);
        try {
          const student = await prisma.student.findUnique({
            where: { id: studentUser.studentId },
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
        
        const result = `
⏳ *Информация о вашей заявке*

👤 *ФИО:*
${app.lastName || ''} ${app.firstName || ''}${app.middleName ? ' ' + app.middleName : ''}

📚 *Тип практики:* ${practiceTypeNames[app.practiceType] || app.practiceType || 'Не указан'}
🏫 *Учебное заведение:* ${app.institutionName || 'Не указано'}
📅 *Период:* ${formatDate(app.startDate)} - ${formatDate(app.endDate)}

📊 *Статус:* ${statusText}

${statusMessage}
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
${student.lastName || ''} ${student.firstName || ''}${student.middleName ? ' ' + student.middleName : ''}

📚 *Тип практики:* ${practiceTypeNames[student.practiceType] || student.practiceType || 'Не указан'}
🏫 *Учебное заведение:* ${student.institutionName || 'Не указано'}
📖 *Курс:* ${student.course || 'Не указан'}
📊 *Статус:* ${statusNames[student.status] || student.status || 'Не указан'}

📅 *Период практики:*
Начало: ${formatDate(student.startDate)}
Окончание: ${formatDate(student.endDate)}
${daysText}

${student.supervisor ? `👨‍💼 *Руководитель:* ${student.supervisor}\n` : ''}
${student.notes ? `📝 *Заметки:* ${student.notes}\n` : ''}
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

if (bot) {
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
            reply_markup: {
              keyboard: [
                [{ text: '📅 Моя практика' }],
                [{ text: 'ℹ️ Информация' }, { text: '📞 Контакты' }]
              ],
              resize_keyboard: true
            }
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
                reply_markup: {
                  keyboard: [
                    [{ text: '📅 Моя практика' }],
                    [{ text: 'ℹ️ Информация' }, { text: '📞 Контакты' }]
                  ],
                  resize_keyboard: true
                }
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
    
    await bot.answerCallbackQuery(query.id);
    
    const state = userStates.get(chatId);
    
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
      }
    } catch (error) {
      console.error('Ошибка обработки callback:', error);
      await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте начать заново командой /register');
      clearUserState(chatId);
    }
  });

  // Показать подтверждение данных
  async function showConfirmation(chatId, data) {
    const confirmationText = [
      '✅ Проверьте ваши данные:',
      '',
      '👤 ФИО:',
      `${data.lastName} ${data.firstName}${data.middleName ? ' ' + data.middleName : ''}`,
      '',
      '📚 Практика:',
      `Тип: ${practiceTypeNames[data.practiceType]}`,
      `Учебное заведение: ${institutionTypeNames[data.institutionType]} "${data.institutionName}"`,
      `Курс: ${data.course}`,
      '',
      '📅 Даты:',
      `Начало: ${formatDate(data.startDate)}`,
      `Окончание: ${formatDate(data.endDate)}`,
      '',
      '📧 Контакты:',
      `Email: ${data.email || 'Не указан'}`,
      `Телефон: ${data.phone || 'Не указан'}`,
      '',
      'Подтвердите регистрацию:'
    ].join('\n');
    
    const confirmKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Подтвердить', callback_data: 'confirm_registration' }],
          [{ text: '❌ Отменить', callback_data: 'cancel_registration' }]
        ]
      }
    };
    
    await bot.sendMessage(chatId, confirmationText, { ...confirmKeyboard });
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

      const existingUser = await prisma.studentUser.findFirst({
        where: {
          telegramId: data.telegramId
        }
      });
      
      if (existingUser) {
        console.log('Пользователь уже зарегистрирован:', existingUser.id);
        await bot.sendMessage(chatId, 
          '⚠️ Вы уже зарегистрированы в системе!\n\n' +
          'Используйте команду /my_practice для просмотра ваших заявок.',
          getRegisteredMenu()
        );
        clearUserState(chatId);
        return;
      }
      
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

      const existingByTelegram = await prisma.studentUser.findUnique({
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

      const existingByEmail = await prisma.studentUser.findUnique({ where: { email } });
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
      
      const randomPassword = Math.random().toString(36).slice(-12);
      const bcrypt = (await import('bcryptjs')).default;
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      console.log('Создание StudentUser...');
      try {
        const studentUser = await prisma.studentUser.create({
          data: {
            username,
            email,
            password: hashedPassword,
            studentId: null,
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

        const successLines = [
          '🎉 Регистрация успешно завершена!',
          '',
          'Ваша заявка на практику отправлена на рассмотрение.',
          '',
          'Детали заявки:',
          `ID: ${application.id.substring(0, 8)}...`,
          usernameLine,
          '',
          'Что дальше?',
          '• Нажмите "📅 Моя практика" или используйте /my_practice, чтобы увидеть статус заявки',
          '• Мы пришлём уведомление, когда администратор рассмотрит заявку'
        ];

        const successMessage = successLines.join('\n');
        
        await bot.sendMessage(chatId, successMessage, { 
          reply_markup: {
            keyboard: [
              [{ text: '📅 Моя практика' }],
              [{ text: 'ℹ️ Информация' }, { text: '📞 Контакты' }]
            ],
            resize_keyboard: true
          }
        });
        
        if (ADMIN_CHAT_IDS.length) {
          const adminMessageLines = [
            '🔔 Новая заявка на практику',
            '',
            `Студент: ${data.lastName} ${data.firstName}${data.middleName ? ' ' + data.middleName : ''}`,
            `Тип: ${practiceTypeNames[data.practiceType]}`,
            `Учебное заведение: ${data.institutionName}`,
            `Период: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`,
            `ID заявки: ${application.id}`,
            `Согласие на обработку данных: ${data.privacyAccepted ? '✅ Да' : '❌ Нет'}`,
            '',
            'Одобрить или отклонить заявку?'
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

    if (application.studentUser && application.studentUser.studentId === null) {
      await prisma.studentUser.update({
        where: { id: application.studentUserId },
        data: { studentId: student.id }
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

  startDailyNotifications();
  
  console.log('✅ Все обработчики Telegram-бота зарегистрированы');
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
      message = `✅ *Ваша заявка одобрена!*\n\n` +
               `Администратор рассмотрел вашу заявку на практику и одобрил её.\n\n` +
               `📋 *Детали заявки:*\n` +
               `👤 *Студент:* ${application.lastName} ${application.firstName}${application.middleName ? ' ' + application.middleName : ''}\n` +
               `📚 *Тип практики:* ${practiceTypeNames[application.practiceType] || application.practiceType}\n` +
               `🏫 *Учебное заведение:* ${application.institutionName}\n` +
               `📅 *Период практики:*\n` +
               `   Начало: ${formatDate(application.startDate)}\n` +
               `   Окончание: ${formatDate(application.endDate)}\n\n` +
               `💡 *Что дальше?*\n` +
               `• Используйте кнопку "📅 Моя практика" или команду /my_practice для просмотра подробной информации\n` +
               `• Вы будете получать ежедневные напоминания о количестве оставшихся дней до окончания практики\n\n` +
               `Поздравляем! 🎉`;
    } else if (newStatus === 'REJECTED') {
      message = `❌ *Ваша заявка отклонена*\n\n` +
               `К сожалению, администратор отклонил вашу заявку на практику.\n\n`;
      
      if (rejectionReason) {
        message += `📝 *Причина отклонения:*\n${rejectionReason}\n\n`;
      } else {
        message += `*Причина:* Не указана\n\n`;
      }
      
      message += `📋 *Детали заявки:*\n` +
               `👤 *Студент:* ${application.lastName} ${application.firstName}${application.middleName ? ' ' + application.middleName : ''}\n` +
               `📚 *Тип практики:* ${practiceTypeNames[application.practiceType] || application.practiceType}\n` +
               `🏫 *Учебное заведение:* ${application.institutionName}\n` +
               `📅 *Период:* ${formatDate(application.startDate)} - ${formatDate(application.endDate)}\n\n` +
               `💡 *Что дальше?*\n` +
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