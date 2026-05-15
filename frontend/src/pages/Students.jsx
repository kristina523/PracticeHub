import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { Search, Download, Loader2, Trash2, Eye, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { confirmDialog } from '../components/Toast';

const getFullName = (student) => {
  if (!student) return '—';
  const words = [student.lastName, student.firstName, student.middleName]
    .filter((p) => p != null && String(p).trim() !== '')
    .flatMap((p) => String(p).trim().split(/\s+/))
    .filter((w) => w && !/^уточнить$/i.test(w));
  return words.length ? words.join(' ') : '—';
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
    // По умолчанию показываем всех студентов
    isRegistered: ''
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

      // Показываем всех, кого отдаёт API: карточки практикантов и аккаунты без карточки (регистрация на сайте).
      setStudents(allStudents);
      setPagination(response.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
    } catch (error) {
      console.error('Ошибка получения студентов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (
      !(await confirmDialog('Вы уверены, что хотите удалить этого практиканта?', {
        title: 'Удалить практиканта?',
        confirmText: 'Удалить',
        variant: 'danger'
      }))
    ) {
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
        <h1 className="page-title">Практиканты</h1>
        <p className="page-subtitle">Управление студентами, проходящими практику</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
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
          <p className="text-sm text-slate-500">
            Найдено: {pagination.total} практикантов
          </p>
          <button
            onClick={exportToCSV}
            className="btn btn-secondary"
          >
            <Download className="w-4 h-4" />
            Экспорт в CSV
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto border border-slate-200/80">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
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
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="font-medium">
                      {student.isVirtual ? (
                          <span className="text-slate-500">
                          {student.studentUser?.username || student.email}
                        </span>
                      ) : (
                        getFullName(student)
                      )}
                    </td>
                    <td>
                      {student.isVirtual ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        practiceTypeLabels[student.practiceType]
                      )}
                    </td>
                    <td>
                      {student.isVirtual ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        student.institutionName
                      )}
                    </td>
                    <td>
                      {student.isVirtual ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        student.course
                      )}
                    </td>
                    <td className="text-sm">
                      {student.isVirtual ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <>
                          {format(new Date(student.startDate), 'dd.MM.yyyy', { locale: ru })} - {' '}
                          {format(new Date(student.endDate), 'dd.MM.yyyy', { locale: ru })}
                        </>
                      )}
                    </td>
                    <td>
                      {student.isVirtual ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                        <div className="flex items-center gap-1 text-green-600" title={`Зарегистрирован: ${student.studentUser?.username || student.email || ''}`}>
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
                            <span className="text-xs text-slate-500" title="Виртуальная запись — студент зарегистрирован, но не добавлен в систему">
                              Только регистрация
                            </span>
                            <button
                              onClick={() => handleDelete(student.id)}
                              className="p-1 hover:bg-red-50 rounded"
                              title="Удалить виртуальную запись"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Редактирование карточки из таблицы отключено — данные меняются через заявки / отдельные процессы */}
                            <Link
                              to={`${getBasePath()}/${student.id}`}
                              className="p-1 hover:bg-slate-100 rounded-lg"
                              title="Просмотр"
                            >
                              <Eye className="w-4 h-4 text-slate-600" />
                            </Link>
                            <button
                              onClick={() => handleDelete(student.id)}
                              className="p-1 hover:bg-red-50 rounded-lg"
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
                  <p className="text-sm text-slate-500">
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

