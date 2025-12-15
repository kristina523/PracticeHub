import { useState, useEffect } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ru';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../utils/api';
import { Loader2 } from 'lucide-react';


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
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    practiceType: '',
    status: '',
    institutionId: ''
  });
  const [institutions, setInstitutions] = useState([]);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [filters]);

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

  const events = students.map(student => {
    const fullName = getFullName(student);
    const shortName = `${student.lastName} ${student.firstName.charAt(0)}.${student.middleName ? student.middleName.charAt(0) + '.' : ''}`;
    return {
      id: student.id,
      title: shortName,
      start: new Date(student.startDate),
      end: new Date(student.endDate),
      resource: {
        student,
        color: practiceTypeColors[student.practiceType],
        fullName: fullName,
        practiceType: student.practiceType
      }
    };
  });

  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: event.resource.color,
        borderColor: event.resource.color,
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
          Календарь практик
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Визуальное отображение периодов практики
        </p>
      </div>

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
              event: ({ event }) => (
                <div 
                  className="calendar-event"
                  title={`${event.resource.fullName} - ${practiceTypeLabels[event.resource.practiceType]}`}
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
              )
            }}
            onSelectEvent={(event) => {
              window.location.href = `/students/${event.resource.student.id}`;
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Calendar;

