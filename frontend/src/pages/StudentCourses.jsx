import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { BookOpen, Clock, User, CheckCircle, XCircle, Loader2, MessageSquare, FileText } from 'lucide-react';

function StudentCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/course-enrollments');
      setCourses(response.data.courses || []);
    } catch (error) {
      console.error('Ошибка загрузки курсов:', error);
      alert('Ошибка загрузки курсов');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      await api.post(`/course-enrollments/${courseId}`);
      alert('Заявка на курс подана! Ожидайте одобрения преподавателя.');
      fetchCourses();
    } catch (error) {
      alert('Ошибка подачи заявки: ' + (error.response?.data?.message || error.message));
    }
  };

  const getStatusBadge = (enrollment) => {
    if (!enrollment) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          Не записан
        </span>
      );
    }

    const statusMap = {
      PENDING: { 
        label: 'Ожидает одобрения', 
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        icon: Clock
      },
      APPROVED: { 
        label: 'Одобрено', 
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        icon: CheckCircle
      },
      REJECTED: { 
        label: 'Отклонено', 
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        icon: XCircle
      }
    };

    const statusInfo = statusMap[enrollment.status] || statusMap.PENDING;
    const Icon = statusInfo.icon;

    return (
      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.color} flex items-center gap-1.5`}>
        <Icon className="w-3.5 h-3.5" />
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Все курсы
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Просмотрите доступные курсы и запишитесь на интересующие вас
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="card text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Курсы пока не добавлены
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="card hover:shadow-xl transition-all duration-300 group border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800"
            >
              {course.imageUrl && (
                <div className="w-full h-48 mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    src={course.imageUrl}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white flex-1">
                    {course.title}
                  </h3>
                  {getStatusBadge(course.enrollment)}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <User className="w-4 h-4" />
                  <span>{course.teacher?.firstName} {course.teacher?.lastName}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <BookOpen className="w-4 h-4" />
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium">
                    {course.direction}
                  </span>
                </div>

                {course.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {course.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Создан: {new Date(course.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {course.enrollment?.status === 'APPROVED' && (
                    <>
                      <button
                        onClick={() => navigate(`/student/courses/${course.id}/chat`)}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Чат
                      </button>
                      <button
                        onClick={() => navigate(`/student/courses/${course.id}/tasks`)}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Задания
                      </button>
                    </>
                  )}
                  
                  {!course.enrollment && (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      Записаться на курс
                    </button>
                  )}

                  {course.enrollment?.status === 'PENDING' && (
                    <button
                      disabled
                      className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg font-semibold cursor-not-allowed"
                    >
                      Заявка на рассмотрении
                    </button>
                  )}

                  {course.enrollment?.status === 'REJECTED' && (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      Подать заявку снова
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentCourses;

