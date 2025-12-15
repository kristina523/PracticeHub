import { useEffect, useState } from 'react';
import api from '../utils/api';
import { 
  Users, 
  UserCheck, 
  Calendar, 
  TrendingUp,
  Loader2 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';


const getFullName = (student) => {
  const parts = [student.lastName, student.firstName];
  if (student.middleName) parts.push(student.middleName);
  return parts.join(' ');
};

const practiceTypeLabels = {
  EDUCATIONAL: 'Учебная',
  PRODUCTION: 'Производственная',
  INTERNSHIP: 'Стажировка'
};

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-gray-500">Ошибка загрузки данных</div>;
  }

  const statCards = [
    {
      title: 'Всего практикантов',
      value: stats.totalStudents,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Активные сейчас',
      value: stats.activeStudents,
      icon: UserCheck,
      color: 'bg-green-500'
    },
    {
      title: 'Завершаются на этой неделе',
      value: stats.endingThisWeek,
      icon: Calendar,
      color: 'bg-orange-500'
    },
    {
      title: 'По типам практики',
      value: stats.byPracticeType.length,
      icon: TrendingUp,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Дашборд
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Обзор системы управления практикантами
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {card.value}
                  </p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            По типам практики
          </h2>
          <div className="space-y-3">
            {stats.byPracticeType.map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  {practiceTypeLabels[item.type]}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            По статусу
          </h2>
          <div className="space-y-3">
            {stats.byStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  {item.status === 'PENDING' && 'Ожидает'}
                  {item.status === 'ACTIVE' && 'Активна'}
                  {item.status === 'COMPLETED' && 'Завершена'}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Ближайшие начала практики
          </h2>
          {stats.upcomingStarts.length > 0 ? (
            <div className="space-y-3">
              {stats.upcomingStarts.map((student) => (
                <div
                  key={student.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        to={`/students/${student.id}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {getFullName(student)}
                      </Link>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {student.institution?.name} • {practiceTypeLabels[student.practiceType]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(new Date(student.startDate), 'd MMM', { locale: ru })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Нет предстоящих начал</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Ближайшие окончания практики
          </h2>
          {stats.upcomingEnds.length > 0 ? (
            <div className="space-y-3">
              {stats.upcomingEnds.map((student) => (
                <div
                  key={student.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        to={`/students/${student.id}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {getFullName(student)}
                      </Link>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {student.institution?.name} • {practiceTypeLabels[student.practiceType]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(new Date(student.endDate), 'd MMM', { locale: ru })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Нет предстоящих окончаний</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Быстрые действия
        </h2>
        <div className="flex flex-wrap gap-4">
          <Link
            to="/students/new"
            className="btn btn-primary"
          >
            Добавить практиканта
          </Link>
          <Link
            to="/institutions"
            className="btn btn-secondary"
          >
            Управление учебными заведениями
          </Link>
          <Link
            to="/calendar"
            className="btn btn-secondary"
          >
            Открыть календарь
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

