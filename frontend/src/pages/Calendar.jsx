import { useState, useEffect, useCallback } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ru';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../utils/api';
import { Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';


const getFullName = (student) => {
  const parts = [student.lastName, student.firstName];
  if (student.middleName) parts.push(student.middleName);
  return parts.join(' ');
};

moment.locale('ru');
const localizer = momentLocalizer(moment);

const practiceTypeColors = {
  EDUCATIONAL: '#3b82f6', 
  PRODUCTION: '#10b981', 
  INTERNSHIP: '#f59e0b'  
};

const practiceTypeLabels = {
  EDUCATIONAL: 'Учебная',
  PRODUCTION: 'Производственная',
  INTERNSHIP: 'Стажировка'
};

function Calendar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isStudentCalendar = location.pathname.startsWith('/student');
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    practiceType: '',
    status: '',
    institutionId: ''
  });
  const [institutions, setInstitutions] = useState([]);

  const fetchInstitutions = async () => {
    try {
      const response = await api.get('/institutions');
      setInstitutions(response.data);
    } catch (error) {
      console.error('Ошибка получения институтов:', error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 1000,
        ...(filters.practiceType && { practiceType: filters.practiceType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.institutionId && { institutionId: filters.institutionId })
      };

      const response = await api.get('/students', { params });
      setStudents(response.data.students);
    } catch (error) {
      console.error('Ошибка получения студентов:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentRes, tasksRes, webinarsRes] = await Promise.all([
        api.get('/students', { params: { limit: 1000, userOnly: true } }),
        api.get('/tasks', { params: { page: 1, limit: 1000 } }),
        // Загружаем все вебинары (не только предстоящие), чтобы показать все зарегистрированные
        api.get('/webinars').catch(() => ({ data: { webinars: [] } }))
      ]);

      const studentsData = studentRes.data.students || studentRes.data || [];
      const tasksData = tasksRes.data.tasks || tasksRes.data || [];
      const webinarsData = webinarsRes.data?.webinars || [];
      
      // Отладочная информация для вебинаров
      console.log('Загруженные вебинары для календаря:', webinarsData);
      console.log('Вебинары с isRegistered:', webinarsData.filter(w => w.isRegistered === true));
      
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setWebinars(Array.isArray(webinarsData) ? webinarsData : []);
    } catch (error) {
      console.error('Ошибка получения данных студента для календаря:', error);
      setStudents([]);
      setTasks([]);
      setWebinars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isStudentCalendar) {
      fetchInstitutions();
    }
  }, [isStudentCalendar]);

  useEffect(() => {
    if (isStudentCalendar) {
      fetchStudentData();
    } else {
      fetchStudents();
    }
  }, [filters, isStudentCalendar, fetchStudentData]);

  // Обновляем календарь при фокусе на окне (когда пользователь возвращается на страницу)
  useEffect(() => {
    if (!isStudentCalendar) return;

    const handleFocus = () => {
      fetchStudentData();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isStudentCalendar, fetchStudentData]);

  // Обновляем календарь при изменении storage (для синхронизации между вкладками)
  useEffect(() => {
    if (!isStudentCalendar) return;

    const handleStorageChange = (e) => {
      if (e.key === 'webinarRegistrationChanged') {
        fetchStudentData();
        localStorage.removeItem('webinarRegistrationChanged');
      }
    };

    // Обработчик для событий на этой же вкладке
    const handleCustomStorage = () => {
      fetchStudentData();
      localStorage.removeItem('webinarRegistrationChanged');
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('webinarRegistrationChanged', handleCustomStorage);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('webinarRegistrationChanged', handleCustomStorage);
    };
  }, [isStudentCalendar, fetchStudentData]);

  const practiceEvents = students
    .filter(student => {
      // Исключаем виртуальные записи (id начинается с 'user_')
      if (!student.id || (typeof student.id === 'string' && student.id.startsWith('user_'))) {
        return false;
      }
      // Исключаем записи без дат
      if (!student.startDate || !student.endDate) {
        return false;
      }
      // Исключаем записи без ФИО (должны быть lastName и firstName)
      if (!student.lastName || !student.firstName) {
        return false;
      }
      return true;
    })
    .map(student => {
      const fullName = getFullName(student);
      const shortName = `${student.lastName} ${student.firstName?.charAt(0) || ''}.${student.middleName ? student.middleName.charAt(0) + '.' : ''}`;
      return {
        id: student.id,
        title: shortName || 'Практика',
        start: new Date(student.startDate),
        end: new Date(student.endDate),
        resource: {
          student,
          color: practiceTypeColors[student.practiceType] || practiceTypeColors.EDUCATIONAL,
          fullName: fullName,
          practiceType: student.practiceType || 'EDUCATIONAL'
        }
      };
    });

  const taskEvents = tasks
    .filter(task => task.deadline)
    .map(task => ({
      id: task.id,
      title: task.title || 'Задание',
      start: new Date(task.deadline),
      end: new Date(task.deadline),
      resource: {
        type: 'TASK',
        status: task.status || 'PENDING'
      }
    }));

  const webinarEvents = webinars
    .filter(webinar => {
      // Проверяем наличие дат
      if (!webinar.startTime || !webinar.endTime) {
        return false;
      }
      
      // Для студента показываем только зарегистрированные вебинары
      if (isStudentCalendar) {
        // Проверяем isRegistered более гибко (может быть true, false, undefined, null)
        const isRegistered = webinar.isRegistered === true || webinar.isRegistered === 'true';
        
        // Отладочная информация
        if (!isRegistered) {
          console.log('Вебинар отфильтрован (не зарегистрирован):', webinar.title, 'isRegistered:', webinar.isRegistered, 'type:', typeof webinar.isRegistered);
        } else {
          console.log('Вебинар будет показан (зарегистрирован):', webinar.title, 'isRegistered:', webinar.isRegistered);
        }
        
        return isRegistered;
      }
      
      // Для администратора/преподавателя показываем все вебинары
      return true;
    })
    .map(webinar => {
      console.log('Создаем событие для вебинара:', webinar.title, 'isRegistered:', webinar.isRegistered);
      return {
        id: webinar.id,
        title: webinar.title || 'Вебинар',
        start: new Date(webinar.startTime),
        end: new Date(webinar.endTime),
        resource: {
          type: 'WEBINAR',
          isRegistered: webinar.isRegistered || false
        }
      };
    });
  
  console.log('Всего вебинаров в календаре:', webinarEvents.length, 'из', webinars.length, 'загруженных');

  const events = isStudentCalendar ? [...practiceEvents, ...taskEvents, ...webinarEvents] : practiceEvents;

  const eventStyleGetter = (event) => {
    let backgroundColor = event.resource.color;
    let borderColor = event.resource.color;
    
    if (event.resource.type === 'TASK') {
      backgroundColor = '#6366f1';
      borderColor = '#6366f1';
    } else if (event.resource.type === 'WEBINAR') {
      backgroundColor = '#ec4899';
      borderColor = '#ec4899';
    }
    
    return {
      style: {
        backgroundColor,
        borderColor,
        color: 'white',
        borderRadius: '4px',
        border: 'none',
        padding: '2px 4px',
        fontSize: '10px',
        fontWeight: '600',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        margin: '1px 2px',
        display: 'inline-block',
        minWidth: 'auto',
        width: 'auto',
        maxWidth: 'calc(100% - 4px)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        lineHeight: '1.2'
      }
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isStudentCalendar ? 'Мой календарь' : 'Календарь практик'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {isStudentCalendar
            ? 'Сроки практики, дедлайны заданий и занятия по курсам.'
            : 'Визуальное отображение периодов практики всех студентов.'}
        </p>
      </div>

      {!isStudentCalendar && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filters.practiceType}
              onChange={(e) => setFilters({ ...filters, practiceType: e.target.value })}
              className="input"
            >
              <option value="">Все типы практики</option>
              <option value="EDUCATIONAL">Учебная</option>
              <option value="PRODUCTION">Производственная</option>
              <option value="INTERNSHIP">Стажировка</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="">Все статусы</option>
              <option value="PENDING">Ожидает</option>
              <option value="ACTIVE">Активна</option>
              <option value="COMPLETED">Завершена</option>
            </select>

            <select
              value={filters.institutionId}
              onChange={(e) => setFilters({ ...filters, institutionId: e.target.value })}
              className="input"
            >
              <option value="">Все учебные заведения</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: practiceTypeColors.EDUCATIONAL }}></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Учебная</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: practiceTypeColors.PRODUCTION }}></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Производственная</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: practiceTypeColors.INTERNSHIP }}></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Стажировка</span>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ height: '600px' }}>
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
            messages={{
              next: 'Следующий',
              previous: 'Предыдущий',
              today: 'Сегодня',
              month: 'Месяц',
              week: 'Неделя',
              day: 'День',
              agenda: 'Расписание'
            }}
            culture="ru"
            components={{
              event: ({ event }) => {
                const isTaskEvent = event.resource.type === 'TASK';
                const isWebinarEvent = event.resource.type === 'WEBINAR';
                let title = event.title;
                
                if (isTaskEvent) {
                  title = `Задание: ${event.title}`;
                } else if (isWebinarEvent) {
                  title = `Вебинар: ${event.title}`;
                } else {
                  title = `${event.resource.fullName} - ${practiceTypeLabels[event.resource.practiceType]}`;
                }

                return (
                <div 
                  className="calendar-event"
                  title={title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    width: '100%',
                    padding: '2px 4px',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    const parent = e.currentTarget.closest('.rbc-event');
                    if (parent) {
                      parent.style.transform = 'scale(1.05)';
                      parent.style.boxShadow = '0 3px 6px rgba(0,0,0,0.2)';
                      parent.style.zIndex = '10';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const parent = e.currentTarget.closest('.rbc-event');
                    if (parent) {
                      parent.style.transform = 'scale(1)';
                      parent.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                      parent.style.zIndex = '1';
                    }
                  }}
                >
                  <div 
                    style={{ 
                      width: '4px', 
                      height: '4px', 
                      borderRadius: '50%', 
                      backgroundColor: 'white',
                      flexShrink: 0,
                      marginRight: '3px'
                    }}
                  />
                  <span style={{ 
                    fontWeight: '600', 
                    lineHeight: '1.1', 
                    fontSize: '9px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {event.title}
                  </span>
                </div>
              );
              }
            }}
            onSelectEvent={(event) => {
              const isTaskEvent = event.resource?.type === 'TASK';
              const isWebinarEvent = event.resource?.type === 'WEBINAR';
              const isStudentEvent = event.resource?.student && !isTaskEvent && !isWebinarEvent;

              if (isTaskEvent) {
                if (isStudentCalendar) {
                  navigate(`/student/tasks/${event.id}`);
                }
                return;
              }
              
              if (isWebinarEvent) {
                if (isStudentCalendar) {
                  navigate(`/student/webinars`);
                }
                return;
              }
              
              if (isStudentEvent && !isStudentCalendar) {
                // Для администратора/преподавателя открываем карточку студента
                const studentId = event.resource.student?.id;
                
                if (studentId) {
                  // Определяем правильный путь в зависимости от роли
                  const path = user?.role === 'teacher' 
                    ? `/teacher/students/${studentId}`
                    : `/students/${studentId}`;
                  navigate(path);
                }
                return;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Calendar;

