import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Calendar, FileText, CheckCircle, Clock, Plus } from 'lucide-react';
import api from '../utils/api';

function StudentDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.studentId) {
      fetchStudentData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchStudentData = async () => {
    try {
      const response = await api.get(`/students/${user.studentId}`);
      setStudentData(response.data);
    } catch (error) {
      console.error('Ошибка загрузки данных студента:', error);
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

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
      ACTIVE: { label: 'Активна', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      COMPLETED: { label: 'Завершена', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' }
    };
    const statusInfo = statusMap[status] || statusMap.PENDING;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getPracticeTypeLabel = (type) => {
    const typeMap = {
      EDUCATIONAL: 'Учебная',
      PRODUCTION: 'Производственная',
      INTERNSHIP: 'Стажировка'
    };
    return typeMap[type] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Добро пожаловать, {user?.username}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Ваша панель управления практикой
        </p>
      </div>

      {studentData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Статус практики
                  </p>
                  <div className="mt-2">
                    {getStatusBadge(studentData.status)}
                  </div>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Тип практики
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                    {getPracticeTypeLabel(studentData.practiceType)}
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
                    Курс
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {studentData.course}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Информация о практике
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">ФИО:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {studentData.lastName} {studentData.firstName} {studentData.middleName || ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Учебное заведение:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {studentData.institutionName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Руководитель:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {studentData.supervisor || 'Не указан'}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Сроки практики
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Начало:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {new Date(studentData.startDate).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Окончание:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {new Date(studentData.endDate).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Дней осталось:
                  </span>
                  <span className="text-gray-900 dark:text-white font-bold text-lg">
                    {Math.max(0, Math.ceil((new Date(studentData.endDate) - new Date()) / (1000 * 60 * 60 * 24)))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {studentData.notes && (
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Заметки
              </h2>
              <p className="text-gray-700 dark:text-gray-300">{studentData.notes}</p>
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Данные о практике не найдены.
            </p>
            <button
              onClick={() => navigate('/student/application')}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Подать заявку на практику
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;

