import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Loader2, Filter, ClipboardList, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link } from 'react-router-dom';

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

function AdminPractices() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [practiceType, setPracticeType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchStudents();
  }, [practiceType, status]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        limit: 200
      };

      // На странице "Практиканты" показываем только студентов,
      // у которых есть зарегистрированный аккаунт
      params.isRegistered = true;

      if (practiceType) params.practiceType = practiceType;
      if (status) params.status = status;
      if (search) params.search = search;

      const response = await api.get('/students', { params });
      const allStudents = response.data.students || response.data || [];

      // Отфильтровываем виртуальных "студентов" (только аккаунт без записи Student),
      // чтобы в списке не появлялись, например, teacher и другие не-прктиканты
      const realRegisteredStudents = allStudents.filter(
        (s) => s.isRegistered && !s.isVirtual
      );

      setStudents(realRegisteredStudents);
    } catch (error) {
      console.error('Ошибка загрузки практик:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStudents();
  };

  const totalByType = students.reduce(
    (acc, s) => {
      if (s.practiceType && acc[s.practiceType] !== undefined) {
        acc[s.practiceType] += 1;
      }
      return acc;
    },
    { EDUCATIONAL: 0, PRODUCTION: 0, INTERNSHIP: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Практики и стажировки
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Все учебные, производственные практики и стажировки студентов.
          </p>
        </div>
      </div>

      {/* Краткая статистика по типам практики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['EDUCATIONAL', 'PRODUCTION', 'INTERNSHIP'].map((type) => (
          <div key={type} className="card flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {practiceTypeLabels[type]}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {totalByType[type]}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <form
        onSubmit={handleSearchSubmit}
        className="card flex flex-col lg:flex-row gap-4 lg:items-end"
      >
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
          <Filter className="w-4 h-4" />
          Фильтры
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Тип практики
            </label>
            <select
              value={practiceType}
              onChange={(e) => setPracticeType(e.target.value)}
              className="w-full input"
            >
              <option value="">Все типы</option>
              <option value="EDUCATIONAL">Учебная</option>
              <option value="PRODUCTION">Производственная</option>
              <option value="INTERNSHIP">Стажировка</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Статус
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full input"
            >
              <option value="">Все статусы</option>
              <option value="PENDING">Ожидает</option>
              <option value="ACTIVE">Активна</option>
              <option value="COMPLETED">Завершена</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Поиск
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ФИО, вуз, email..."
              className="w-full input"
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary">
          Применить
        </button>
      </form>

      {/* Таблица практик */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : students.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Практики не найдены по выбранным фильтрам.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Студент
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Учреждение
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип практики
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сроки
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      to={`/students/${student.id}`}
                      className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {[student.lastName, student.firstName, student.middleName]
                        .filter(Boolean)
                        .join(' ')}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span>
                        {student.institution?.name || student.institutionName || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {practiceTypeLabels[student.practiceType] || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      {statusLabels[student.status] || student.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {student.startDate && student.endDate ? (
                      <>
                        {format(new Date(student.startDate), 'dd.MM.yyyy', {
                          locale: ru
                        })}{' '}
                        –{' '}
                        {format(new Date(student.endDate), 'dd.MM.yyyy', {
                          locale: ru
                        })}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminPractices;


