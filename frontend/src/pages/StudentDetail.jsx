import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { ArrowLeft, Edit, Trash2, Loader2, Mail, Phone, Calendar, User, School, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';


const getFullName = (student) => {
  if (!student) return 'Не указано';
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

function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Определяем базовый путь в зависимости от роли и текущего пути
  const getBasePath = () => {
    // Проверяем текущий путь или роль пользователя
    if (location.pathname.includes('/teacher/') || user?.role === 'teacher') {
      return '/teacher/students';
    }
    return '/students';
  };

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const fetchStudent = async () => {
    setLoading(true);
    setError(null);
    try {
      // Обработка виртуальных студентов (ID начинается с user_)
      const studentId = id.startsWith('user_') ? id.replace('user_', '') : id;
      
      // Для виртуальных студентов API может не работать, поэтому показываем сообщение
      if (id.startsWith('user_')) {
        setError('Это виртуальная запись студента. Детальная информация недоступна.');
        setLoading(false);
        return;
      }

      const response = await api.get(`/students/${studentId}`);
      setStudent(response.data);
    } catch (error) {
      console.error('Ошибка получения студента:', error);
      setError(error.response?.data?.message || 'Ошибка загрузки данных студента');
      // Не делаем автоматический редирект, показываем ошибку
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этого практиканта?')) {
      return;
    }

    try {
      await api.delete(`/students/${id}`);
      navigate(getBasePath());
    } catch (error) {
      alert('Ошибка при удалении: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to={getBasePath()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Ошибка загрузки
            </h1>
          </div>
        </div>
        <div className="card">
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Студент не найден'}</p>
            <Link to={getBasePath()} className="btn btn-primary">
              Вернуться к списку
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const basePath = getBasePath();
  const isTeacher = location.pathname.includes('/teacher/');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={basePath} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {getFullName(student)}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Детальная информация о практиканте
            </p>
          </div>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            {student.status === 'PENDING' && (
              <button
                onClick={async () => {
                  if (window.confirm('Активировать практику для этого студента?')) {
                    try {
                      await api.put(`/students/${id}`, { status: 'ACTIVE' });
                      fetchStudent();
                      alert('Статус обновлен на "Активна"');
                    } catch (error) {
                      alert('Ошибка обновления статуса: ' + (error.response?.data?.message || error.message));
                    }
                  }
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                Активировать практику
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Основная информация
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Фамилия</p>
                <p className="font-medium text-gray-900 dark:text-white">{student.lastName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Имя</p>
                <p className="font-medium text-gray-900 dark:text-white">{student.firstName}</p>
              </div>
            </div>

            {student.middleName && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Отчество</p>
                  <p className="font-medium text-gray-900 dark:text-white">{student.middleName}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Тип практики</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {practiceTypeLabels[student.practiceType]}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <School className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Учебное заведение</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {student.institutionName}
                </p>
                {student.institution && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {student.institution.type === 'COLLEGE' ? 'Колледж' : 'Университет'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Курс/год обучения</p>
              <p className="font-medium text-gray-900 dark:text-white">{student.course}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Статус</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ${statusColors[student.status]}`}>
                {statusLabels[student.status]}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Контактная информация
          </h2>
          <div className="space-y-4">
            {student.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                  <a
                    href={`mailto:${student.email}`}
                    className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {student.email}
                  </a>
                </div>
              </div>
            )}

            {student.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Телефон</p>
                  <a
                    href={`tel:${student.phone}`}
                    className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {student.phone}
                  </a>
                </div>
              </div>
            )}

            {student.telegramId && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Telegram ID</p>
                <p className="font-medium text-gray-900 dark:text-white">{student.telegramId}</p>
              </div>
            )}

            {!student.email && !student.phone && !student.telegramId && (
              <p className="text-gray-500 dark:text-gray-400">Контактная информация не указана</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Период практики
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Дата начала</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(new Date(student.startDate), 'd MMMM yyyy', { locale: ru })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Дата окончания</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(new Date(student.endDate), 'd MMMM yyyy', { locale: ru })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Дополнительная информация
          </h2>
          <div className="space-y-4">
            {student.supervisor && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Руководитель практики</p>
                <p className="font-medium text-gray-900 dark:text-white">{student.supervisor}</p>
              </div>
            )}

            {student.notes && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Комментарии/заметки</p>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{student.notes}</p>
              </div>
            )}

            {!student.supervisor && !student.notes && (
              <p className="text-gray-500 dark:text-gray-400">Дополнительная информация не указана</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentDetail;

