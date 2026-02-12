import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Calendar, FileText, CheckCircle, Clock, Plus, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ru } from 'date-fns/locale';
import api from '../utils/api';

// Цвета для карточек курсов (как в Google Classroom)
const courseColors = [
  '#4285F4', '#34A853', '#FBBC04', '#EA4335', '#FF6D01',
  '#9334E6', '#E8710A', '#0F9D58', '#DB4437', '#F4B400'
];

function StudentDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises = [];
      
      if (user?.studentId) {
        promises.push(api.get(`/students/${user.studentId}`).catch(() => ({ data: null })));
      } else {
        promises.push(Promise.resolve({ data: null }));
      }
      
      promises.push(api.get('/course-enrollments').catch(() => ({ data: { courses: [] } })));
      promises.push(api.get('/tasks').catch(() => ({ data: { tasks: [] } })));

      const [studentRes, coursesRes, tasksRes] = await Promise.all(promises);
      
      setStudentData(studentRes.data);
      setCourses(coursesRes.data?.courses || []);
      setTasks(tasksRes.data?.tasks || []);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  // Проверка, пропущен ли срок задания
  const isOverdue = (task) => {
    const deadline = new Date(task.deadline);
    const submissionStatus = task.submissions?.[0]?.status;
    // Задание пропущено, если дедлайн прошел и задание не завершено
    return isPast(deadline) && submissionStatus !== 'COMPLETED' && task.status !== 'COMPLETED';
  };

  // Получаем пропущенные задания
  const overdueTasks = tasks.filter(task => isOverdue(task));

  const getCourseColor = (index) => {
    return courseColors[index % courseColors.length];
  };

  const getInitials = (name) => {
    if (!name) return 'К';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Фильтруем только одобренные курсы
  const approvedCourses = courses.filter(c => c.enrollment?.status === 'APPROVED');

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-2xl font-normal text-gray-900 mb-1">
          Главная страница
        </h1>
      </div>

      {/* Информация о практике (если есть) */}
      {studentData && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Практика</p>
              <p className="text-base font-medium text-gray-900 mt-1">
                {studentData.lastName} {studentData.firstName} {studentData.middleName || ''}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {studentData.institutionName}
              </p>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                studentData.status === 'ACTIVE' 
                  ? 'bg-green-100 text-green-800'
                  : studentData.status === 'COMPLETED'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {studentData.status === 'ACTIVE' ? 'Активна' : studentData.status === 'COMPLETED' ? 'Завершена' : 'Ожидает'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Пропущенные задания */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-900">
                Пропущенные сроки заданий
              </h2>
              <span className="bg-red-600 text-white text-xs rounded-full px-2 py-1 font-semibold">
                {overdueTasks.length}
              </span>
            </div>
            <Link
              to="/student/tasks?filter=overdue"
              className="text-sm text-red-600 hover:text-red-700 hover:underline font-medium"
            >
              Посмотреть все
            </Link>
          </div>
          <div className="space-y-2">
            {overdueTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-lg border border-red-200 p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">{task.title}</h3>
                    {task.course && (
                      <p className="text-xs text-gray-600 mb-1">
                        Курс: {task.course.title}
                      </p>
                    )}
                    <p className="text-xs text-red-600 font-medium">
                      Дедлайн: {format(new Date(task.deadline), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </p>
                  </div>
                  <Link
                    to={`/student/tasks/${task.id}`}
                    className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    Выполнить
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Курсы */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-normal text-gray-900">Курсы</h2>
          <Link 
            to="/student/courses" 
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Все
          </Link>
        </div>

        {approvedCourses.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">У вас пока нет курсов</p>
            <Link
              to="/student/courses"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Записаться на курс
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedCourses.map((course, index) => {
              const color = getCourseColor(index);
              const initials = getInitials(course.title);
              
              return (
                <Link
                  key={course.id}
                  to={`/student/courses/${course.id}/tasks`}
                  className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Цветной заголовок */}
                  <div 
                    className="h-24 flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <span className="text-white text-3xl font-normal">{initials}</span>
                  </div>
                  
                  {/* Контент карточки */}
                  <div className="p-4">
                    <h3 className="text-base font-normal text-gray-900 mb-1 line-clamp-2">
                      {course.title}
                    </h3>
                    {course.direction && (
                      <p className="text-sm text-gray-500 mb-2">{course.direction}</p>
                    )}
                    {course.teacher && (
                      <p className="text-sm text-gray-600">
                        {course.teacher.firstName} {course.teacher.lastName}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/student/courses"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Все курсы</p>
              <p className="text-xs text-gray-500">Просмотр и запись</p>
            </div>
          </div>
        </Link>

        <Link
          to="/student/tasks"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Задания</p>
              <p className="text-xs text-gray-500">Просмотр и выполнение</p>
            </div>
          </div>
        </Link>

        {!studentData && (
          <Link
            to="/student/application"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Подать заявку</p>
                <p className="text-xs text-gray-500">На практику</p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;
