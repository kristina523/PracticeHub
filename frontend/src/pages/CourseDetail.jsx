import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Loader2, BookOpen, Code, Globe, Smartphone, Database, Settings, User, Calendar, FileText, ArrowRight, MessageSquare, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';

const directionIcons = {
  'Программирование': Code,
  'Веб-разработка': Globe,
  'Мобильная разработка': Smartphone,
  'Базы данных': Database,
  'Другое': Settings
};

const directionColors = {
  'Программирование': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Веб-разработка': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Мобильная разработка': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'Базы данных': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'Другое': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [materialsCount, setMaterialsCount] = useState(0);
  const [enrolledStudents, setEnrolledStudents] = useState([]);

  const getBasePath = () => {
    if (location.pathname.includes('/teacher/')) {
      return '/teacher/courses';
    }
    return '/courses';
  };

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  const fetchCourse = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/courses/${courseId}`);
      setCourse(response.data);
      setMaterialsCount(response.data._count?.materials || 0);
      setEnrolledStudents(response.data.enrollments || []);
    } catch (error) {
      console.error('Ошибка получения курса:', error);
      setError(error.response?.data?.message || 'Ошибка загрузки данных курса');
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

  if (error || !course) {
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
            <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Курс не найден'}</p>
            <Link to={getBasePath()} className="btn btn-primary">
              Вернуться к списку
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const DirectionIcon = directionIcons[course.direction] || BookOpen;
  const basePath = getBasePath();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to={basePath} className="p-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              {course.title}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Детальная информация о курсе
            </p>
          </div>
        </div>
      </div>

      {course.imageUrl && (
        <div className="card p-0 overflow-hidden">
          <img 
            src={course.imageUrl} 
            alt={course.title}
            className="w-full h-64 object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            {!course.imageUrl && (
              <div className={`p-3 rounded-xl ${directionColors[course.direction] || directionColors['Другое']}`}>
                <DirectionIcon className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Основная информация
              </h2>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Название</p>
              <p className="font-medium text-gray-900 dark:text-white">{course.title}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Направление</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ${directionColors[course.direction] || directionColors['Другое']}`}>
                {course.direction}
              </span>
            </div>
            {course.description && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Описание</p>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{course.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Информация о преподавателе
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Преподаватель</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {course.teacher?.lastName} {course.teacher?.firstName} {course.teacher?.middleName || ''}
                </p>
              </div>
            </div>
            {course.teacher?.email && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <a
                  href={`mailto:${course.teacher.email}`}
                  className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {course.teacher.email}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Дополнительная информация
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Дата создания</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(new Date(course.createdAt), 'd MMMM yyyy', { locale: ru })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Последнее обновление</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(new Date(course.updatedAt), 'd MMMM yyyy', { locale: ru })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Материалы курса */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl shadow-lg border-2 border-indigo-200 dark:border-indigo-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-200 dark:bg-indigo-800 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-700 dark:text-indigo-300" />
            </div>
            Материалы курса
          </h2>
          <Link
            to={`/teacher/courses/${courseId}/materials`}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span>Перейти к материалам</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {materialsCount === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Материалы пока не добавлены</p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              В курсе {materialsCount} {materialsCount === 1 ? 'материал' : materialsCount < 5 ? 'материала' : 'материалов'}
            </p>
            <Link
              to={`/teacher/courses/${courseId}/materials`}
              className="inline-flex items-center gap-2 mt-4 px-6 py-2.5 bg-white dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-xl font-semibold hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all duration-200"
            >
              Просмотреть все материалы
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Студенты на курсе (только для преподавателя) */}
      {user?.role === 'teacher' && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl shadow-lg border-2 border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-lg">
                <Users className="w-6 h-6 text-blue-700 dark:text-blue-300" />
              </div>
              Студенты на курсе
              <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
                ({course.enrollments?.length || 0})
              </span>
            </h2>
            <Link
              to={`/teacher/courses/${courseId}/chat`}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <MessageSquare className="w-5 h-5" />
              <span>Все чаты</span>
            </Link>
          </div>
          {(course.enrollments?.length || 0) === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">На курс пока никто не записался</p>
            </div>
          ) : (
            <div className="space-y-3">
              {course.enrollments?.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {(enrollment.studentUser?.username || enrollment.studentUser?.email || 'С').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {enrollment.studentUser?.username || enrollment.studentUser?.email || 'Студент'}
                      </h3>
                      {enrollment.studentUser?.email && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {enrollment.studentUser.email}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Записан: {format(new Date(enrollment.createdAt), 'dd.MM.yyyy', { locale: ru })}
                        {enrollment._count?.messages > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                            {enrollment._count.messages} сообщений
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/teacher/courses/${courseId}/chat/${enrollment.id}`}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Чат
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CourseDetail;

