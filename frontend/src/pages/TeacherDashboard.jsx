import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  FileText, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  Plus,
  Loader2,
  ArrowRight,
  Bell,
  UserCheck,
  FileCheck,
  BookOpen,
  Target
} from 'lucide-react';
import api from '../utils/api';
import { format, differenceInDays, isPast, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';

const getFullName = (student) => {
  if (!student) return 'Не указано';
  const parts = [student.lastName, student.firstName, student.middleName].filter((p) => {
    const s = p != null ? String(p).trim() : '';
    return s !== '' && s !== 'Уточнить';
  });
  return parts.length ? parts.join(' ') : '—';
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
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800'
};

// Цвета для карточек курсов (как в Google Classroom)
const courseColors = [
  '#4285F4', '#34A853', '#FBBC04', '#EA4335', '#FF6D01',
  '#9334E6', '#E8710A', '#0F9D58', '#DB4437', '#F4B400'
];

function TeacherDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalStudents: 0,
    activePractices: 0,
    completedPractices: 0,
    pendingApplications: 0,
    tasksToReview: 0,
    upcomingDeadlines: 0,
    overdueTasks: 0
  });
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [applications, setApplications] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchStudents(),
        fetchTasks(),
        fetchApplications(),
        fetchCourses()
      ]);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [studentsRes, tasksRes, applicationsRes] = await Promise.all([
        api.get('/students', { params: { page: 1, limit: 1000 } }),
        api.get('/tasks', { params: { page: 1, limit: 1000 } }),
        api.get('/applications', { params: { page: 1, limit: 100 } })
      ]);

      const studentsData = studentsRes.data.students || studentsRes.data || [];
      const tasksData = tasksRes.data.tasks || tasksRes.data || [];
      const applicationsData = applicationsRes.data.applications || applicationsRes.data || [];

      // Фильтруем виртуальных студентов для статистики
      const realStudents = studentsData.filter(s => !s.isVirtual);

      const now = new Date();
      const upcomingDeadlines = tasksData.filter(task => {
        const deadline = new Date(task.deadline);
        return deadline >= now && differenceInDays(deadline, now) <= 7;
      }).length;

      const overdueTasks = tasksData.filter(task => {
        const deadline = new Date(task.deadline);
        return isPast(deadline) && task.status !== 'COMPLETED';
      }).length;

      const tasksToReview = tasksData.filter(task => {
        return task.submissions?.some(sub => 
          sub.status === 'SUBMITTED' || sub.status === 'UNDER_REVIEW'
        );
      }).length;

      // Считаем активных студентов (PENDING или ACTIVE)
      const activeStudents = realStudents.filter(s => 
        s.status === 'ACTIVE' || s.status === 'PENDING'
      ).length;

      setStats({
        totalStudents: realStudents.length,
        activePractices: activeStudents,
        completedPractices: realStudents.filter(s => s.status === 'COMPLETED').length,
        pendingApplications: applicationsData.filter(a => a.status === 'PENDING').length,
        tasksToReview,
        upcomingDeadlines,
        overdueTasks
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      // Загружаем всех студентов (без фильтра по статусу), чтобы показать и PENDING, и ACTIVE
      const response = await api.get('/students', { 
        params: { page: 1, limit: 10 } 
      });
      const studentsData = response.data.students || response.data || [];
      // Фильтруем виртуальных студентов и показываем только тех, у кого есть статус PENDING или ACTIVE
      const activeStudents = studentsData.filter(s => 
        !s.isVirtual && 
        (s.status === 'ACTIVE' || s.status === 'PENDING')
      );
      setStudents(activeStudents);
    } catch (error) {
      console.error('Ошибка загрузки студентов:', error);
      setStudents([]);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get('/tasks', { params: { page: 1, limit: 10 } });
      console.log('📋 Задания получены:', response.data);
      const tasksData = response.data.tasks || response.data || [];
      console.log('📋 Количество заданий:', tasksData.length);
      setTasks(tasksData);
    } catch (error) {
      console.error('Ошибка загрузки заданий:', error);
      setTasks([]);
    }
  };

  const fetchApplications = async () => {
    try {
      const response = await api.get('/applications', { 
        params: { page: 1, limit: 5, status: 'PENDING' } 
      });
      setApplications(response.data.applications || response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses', { 
        params: { page: 1, limit: 100 } 
      });
      setCourses(response.data.courses || response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки курсов:', error);
      setCourses([]);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-2xl font-normal text-gray-900 mb-1">
          Главная страница
        </h1>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Всего студентов</p>
          <p className="text-2xl font-normal text-gray-900">{stats.totalStudents}</p>
          <p className="text-xs text-gray-500 mt-1">Активных: {stats.activePractices}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Активные практики</p>
          <p className="text-2xl font-normal text-gray-900">{stats.activePractices}</p>
          <p className="text-xs text-gray-500 mt-1">Завершено: {stats.completedPractices}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">На проверке</p>
          <p className="text-2xl font-normal text-gray-900">{stats.tasksToReview}</p>
          <p className="text-xs text-gray-500 mt-1">Просрочено: {stats.overdueTasks}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Новые заявки</p>
          <p className="text-2xl font-normal text-gray-900">{stats.pendingApplications}</p>
          <p className="text-xs text-gray-500 mt-1">Дедлайны: {stats.upcomingDeadlines}</p>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex gap-3">
        <Link 
          to="/teacher/students" 
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Все студенты
        </Link>
        <Link 
          to="/teacher/tasks" 
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать задание
        </Link>
      </div>

      {/* Все задания */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-normal text-gray-900">Мои задания</h2>
          <Link 
            to="/teacher/tasks" 
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
          >
            Все задания
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {tasks.length > 0 ? (
          <div className="space-y-2">
            {tasks.slice(0, 5).map((task) => {
              const deadline = new Date(task.deadline);
              const now = new Date();
              const isOverdue = isPast(deadline) && task.status !== 'COMPLETED';
              const daysUntilDeadline = differenceInDays(deadline, now);
              
              return (
                <Link
                  key={task.id}
                  to="/teacher/tasks"
                  className="block p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-800' : daysUntilDeadline <= 3 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {format(deadline, 'dd.MM.yyyy', { locale: ru })}
                        </span>
                        {task.submissions && task.submissions.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {task.submissions.length} {task.submissions.length === 1 ? 'решение' : 'решений'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${isOverdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                      {task.status === 'COMPLETED' ? 'Выполнено' : isOverdue ? 'Просрочено' : 'Активно'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">У вас пока нет заданий</p>
            <Link
              to="/teacher/tasks"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Создать задание
            </Link>
          </div>
        )}
      </div>

      {/* Мои курсы */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-normal text-gray-900">Мои курсы</h2>
          <Link 
            to="/teacher/courses" 
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Все
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">У вас пока нет курсов</p>
            <Link
              to="/teacher/courses"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Создать курс
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course, index) => {
              const color = getCourseColor(index);
              const initials = getInitials(course.title);
              
              return (
                <Link
                  key={course.id}
                  to={`/teacher/courses/${course.id}`}
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
                    {course._count && (
                      <p className="text-xs text-gray-500">
                        {course._count.enrollments || 0} студентов
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Активные студенты */}
      {students.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-normal text-gray-900">Активные студенты</h2>
            <Link 
              to="/teacher/students" 
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              Все студенты
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {students.slice(0, 5).map((student) => (
              <Link
                key={student.id}
                to={`/teacher/students/${student.id}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-sm">
                      {getFullName(student).charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                      {getFullName(student)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {student.institutionName} • {practiceTypeLabels[student.practiceType]}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[student.status]}`}>
                  {statusLabels[student.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}


      {/* Задания, требующие внимания */}
      {tasks.filter(t => {
        const hasUnreviewed = t.submissions?.some(s => 
          s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW'
        );
        return hasUnreviewed;
      }).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-normal text-gray-900">Задания, требующие внимания</h2>
            <Link 
              to="/teacher/tasks" 
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              Все задания
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {tasks
              .filter(t => {
                const hasUnreviewed = t.submissions?.some(s => 
                  s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW'
                );
                return hasUnreviewed;
              })
              .slice(0, 5)
              .map((task) => (
                <Link
                  key={task.id}
                  to="/teacher/tasks"
                  className="block p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {task.submissions?.filter(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW').length || 0} решений на проверке
                  </p>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Новые заявки */}
      {applications.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-normal text-gray-900">Новые заявки</h2>
            <Link 
              to="/teacher/applications" 
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Все
            </Link>
          </div>
          <div className="space-y-2">
            {applications.map((app) => (
              <Link
                key={app.id}
                to="/teacher/applications"
                className="block p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">
                  {getFullName(app)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {practiceTypeLabels[app.practiceType]} • {format(new Date(app.createdAt), 'dd.MM.yyyy', { locale: ru })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
