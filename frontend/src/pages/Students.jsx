import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { Search, Filter, Download, Loader2, Edit, Trash2, Eye, UserCheck, UserX } from 'lucide-react';
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

const statusLabels = {
  PENDING: 'Ожидает',
  ACTIVE: 'Активна',
  COMPLETED: 'Завершена'
};

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

function Students() {
  const location = useLocation();
  const { user } = useAuthStore();
  const [students, setStudents] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    practiceType: '',
    status: '',
    institutionId: '',
    // По умолчанию показываем только зарегистрированных студентов
    isRegistered: 'true'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  // Определяем базовый путь для ссылок в зависимости от роли пользователя
  const getBasePath = () => {
    // Проверяем текущий путь или роль пользователя
    if (location.pathname.includes('/teacher/') || user?.role === 'teacher') {
      return '/teacher/students';
    }
    return '/students';
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [search, filters, pagination.page]);

  const fetchInstitutions = async () => {
    try {
      const response = await api.get('/institutions');
      setInstitutions(response.data);
    } catch (error) {
      console.error('Ошибка получения учебных заведений:', error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(search && { search }),
        ...(filters.practiceType && { practiceType: filters.practiceType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.institutionId && { institutionId: filters.institutionId }),
        ...(filters.isRegistered !== '' && filters.isRegistered !== undefined && { isRegistered: filters.isRegistered })
      };

      const response = await api.get('/students', { params });
      const allStudents = response.data.students || [];

      // Показываем только реально существующих студентов с зарегистрированным аккаунтом
      const realRegisteredStudents = allStudents.filter(
        (s) => s.isRegistered && !s.isVirtual
      );

      setStudents(realRegisteredStudents);
      setPagination(prev => ({
        ...response.data.pagination,
        total: realRegisteredStudents.length
      }));
    } catch (error) {
      console.error('Ошибка получения студентов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого практиканта?')) {
      return;
    }

    try {
      await api.delete(`/students/${id}`);
      fetchStudents();
    } catch (error) {
      alert('Ошибка при удалении: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const exportToCSV = () => {
    const headers = ['ФИО', 'Тип практики', 'Учебное заведение', 'Курс', 'Email', 'Телефон', 'Дата начала', 'Дата окончания', 'Статус'];
    const rows = students.map(s => [
      getFullName(s),
      practiceTypeLabels[s.practiceType],
      s.institutionName,
      s.course,
      s.email || '',
      s.phone || '',
      format(new Date(s.startDate), 'dd.MM.yyyy'),
      format(new Date(s.endDate), 'dd.MM.yyyy'),
      statusLabels[s.status]
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `students_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Практиканты
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Управление студентами, проходящими практику
        </p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="input pl-10"
            />
          </div>

          <select
            value={filters.practiceType}
            onChange={(e) => handleFilterChange('practiceType', e.target.value)}
            className="input"
          >
            <option value="">Все типы практики</option>
            <option value="EDUCATIONAL">Учебная</option>
            <option value="PRODUCTION">Производственная</option>
            <option value="INTERNSHIP">Стажировка</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="input"
          >
            <option value="">Все статусы</option>
            <option value="PENDING">Ожидает</option>
            <option value="ACTIVE">Активна</option>
            <option value="COMPLETED">Завершена</option>
          </select>

          <select
            value={filters.institutionId}
            onChange={(e) => handleFilterChange('institutionId', e.target.value)}
            className="input"
          >
            <option value="">Все учебные заведения</option>
            {institutions.map(inst => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>

          <select
            value={filters.isRegistered}
            onChange={(e) => handleFilterChange('isRegistered', e.target.value)}
            className="input"
          >
            <option value="">Все студенты</option>
            <option value="true">Зарегистрированные</option>
            <option value="false">Не зарегистрированные</option>
          </select>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Найдено: {pagination.total} практикантов
          </p>
          <button
            onClick={exportToCSV}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Экспорт в CSV
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Практиканты не найдены
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Тип практики</th>
                  <th>Учебное заведение</th>
                  <th>Курс</th>
                  <th>Период</th>
                  <th>Статус</th>
                  <th>Аккаунт</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="font-medium">
                      {student.isVirtual ? (
                        <span className="text-gray-500 dark:text-gray-400">
                          {student.studentUser?.username || student.email}
                        </span>
                      ) : (
                        getFullName(student)
                      )}
                    </td>
                    <td>
                      {student.isVirtual ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        practiceTypeLabels[student.practiceType]
                      )}
                    </td>
                    <td>
                      {student.isVirtual ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        student.institutionName
                      )}
                    </td>
                    <td>
                      {student.isVirtual ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        student.course
                      )}
                    </td>
                    <td className="text-sm">
                      {student.isVirtual ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <>
                          {format(new Date(student.startDate), 'dd.MM.yyyy', { locale: ru })} - {' '}
                          {format(new Date(student.endDate), 'dd.MM.yyyy', { locale: ru })}
                        </>
                      )}
                    </td>
                    <td>
                      {student.isVirtual ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          Зарегистрирован
                        </span>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[student.status]}`}>
                          {statusLabels[student.status]}
                        </span>
                      )}
                    </td>
                    <td>
                      {student.isRegistered ? (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400" title={`Зарегистрирован: ${student.studentUser?.username || student.email || ''}`}>
                          <UserCheck className="w-4 h-4" />
                          <span className="text-xs">Да</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400" title="Не зарегистрирован">
                          <UserX className="w-4 h-4" />
                          <span className="text-xs">Нет</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {student.isVirtual ? (
                          <>
                            <span className="text-xs text-gray-500 dark:text-gray-400" title="Виртуальная запись — студент зарегистрирован, но не добавлен в систему">
                              Только регистрация
                            </span>
                            <button
                              onClick={() => handleDelete(student.id)}
                              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Удалить виртуальную запись"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              to={`${getBasePath()}/${student.id}`}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Просмотр"
                            >
                              <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </Link>
                            {user?.role === 'admin' && (
                              <Link
                                to={`${getBasePath()}/${student.id}/edit`}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                title="Редактировать"
                              >
                                <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              </Link>
                            )}
                            <button
                              onClick={() => handleDelete(student.id)}
                              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Страница {pagination.page} из {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="btn btn-secondary"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.pages}
                    className="btn btn-secondary"
                  >
                    Вперед
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Students;

