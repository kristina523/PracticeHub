import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const practiceTypeLabels = {
  EDUCATIONAL: 'Учебная',
  PRODUCTION: 'Производственная',
  INTERNSHIP: 'Стажировка'
};

const statusLabels = {
  PENDING: 'Ожидает',
  ACTIVE: 'Активна',
  COMPLETED: 'Завершена'
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

function Reports() {
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

  const practiceTypeData = stats.byPracticeType.map(item => ({
    name: practiceTypeLabels[item.type],
    value: item.count
  }));

  const statusData = stats.byStatus.map(item => ({
    name: statusLabels[item.status],
    value: item.count
  }));

  const institutionData = stats.byInstitution
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(item => ({
      name: item.institutionName,
      value: item.count
    }));

  const courseData = stats.byCourse.map(item => ({
    name: `${item.course} курс`,
    value: item.count
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Отчеты и аналитика
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Статистика и анализ данных о практикантах
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Всего практикантов</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.totalStudents}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Активные сейчас</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.activeStudents}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Завершаются на этой неделе</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.endingThisWeek}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Учебных заведений</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.byInstitution.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Распределение по типам практики
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={practiceTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {practiceTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Распределение по статусу
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Топ учебных заведений
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={institutionData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Распределение по курсам
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={courseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Reports;

