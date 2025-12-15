import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Users, Calendar, FileText, TrendingUp } from 'lucide-react';
import api from '../utils/api';

function TeacherDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalStudents: 0,
    activePractices: 0,
    completedPractices: 0,
    upcomingDeadlines: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {

      const response = await api.get('/students');
      const students = response.data.students || response.data;
      
      setStats({
        totalStudents: students.length,
        activePractices: students.filter(s => s.status === 'ACTIVE').length,
        completedPractices: students.filter(s => s.status === 'COMPLETED').length,
        upcomingDeadlines: 0 
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Добро пожаловать, {user?.firstName} {user?.lastName}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Панель управления преподавателя
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Всего студентов
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.totalStudents}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Активные практики
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.activePractices}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Завершенные практики
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.completedPractices}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Ближайшие дедлайны
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.upcomingDeadlines}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Информация о профиле
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Имя:</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {user?.firstName} {user?.middleName || ''} {user?.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Email:</span>
            <span className="text-gray-900 dark:text-white font-medium">{user?.email}</span>
          </div>
          {user?.phone && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Телефон:</span>
              <span className="text-gray-900 dark:text-white font-medium">{user?.phone}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;

