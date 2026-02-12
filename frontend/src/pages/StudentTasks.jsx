import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { FileText, Clock, CheckCircle, XCircle, Loader2, BookOpen, Send, AlertCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ru } from 'date-fns/locale';

function StudentTasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(() => {
    // Получаем фильтр из URL параметров или используем 'all' по умолчанию
    return searchParams.get('filter') || 'all';
  }); // all, pending, submitted, completed, overdue

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  // Обновляем URL при изменении фильтра
  useEffect(() => {
    if (filter !== 'all') {
      setSearchParams({ filter });
    } else {
      setSearchParams({});
    }
  }, [filter, setSearchParams]);

  const fetchTasks = async () => {
    try {
      const params = {};
      if (filter !== 'all' && filter !== 'overdue') {
        params.status = filter.toUpperCase();
      }
      const response = await api.get('/tasks', { params });
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Ошибка загрузки заданий:', error);
      alert('Ошибка загрузки заданий');
    } finally {
      setLoading(false);
    }
  };

  // Проверка, пропущен ли срок задания
  const isOverdue = (task) => {
    const deadline = new Date(task.deadline);
    const now = new Date();
    const submissionStatus = getSubmissionStatus(task);
    // Задание пропущено, если дедлайн прошел и задание не завершено
    return isPast(deadline) && submissionStatus !== 'COMPLETED' && task.status !== 'COMPLETED';
  };

  // Фильтрация заданий
  const getFilteredTasks = () => {
    if (filter === 'overdue') {
      return tasks.filter(task => isOverdue(task));
    }
    return tasks;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: { 
        label: 'Ожидает', 
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        icon: Clock
      },
      IN_PROGRESS: { 
        label: 'В работе', 
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        icon: Clock
      },
      SUBMITTED: { 
        label: 'Отправлено', 
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        icon: Send
      },
      UNDER_REVIEW: { 
        label: 'На проверке', 
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
        icon: Clock
      },
      COMPLETED: { 
        label: 'Завершено', 
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        icon: CheckCircle
      },
      REJECTED: { 
        label: 'Отклонено', 
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        icon: XCircle
      }
    };

    const statusInfo = statusMap[status] || statusMap.PENDING;
    const Icon = statusInfo.icon;

    return (
      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.color} flex items-center gap-1.5`}>
        <Icon className="w-3.5 h-3.5" />
        {statusInfo.label}
      </span>
    );
  };

  const getSubmissionStatus = (task) => {
    if (!task.submissions || task.submissions.length === 0) {
      return null;
    }
    const submission = task.submissions[0];
    return submission.status;
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
          Мои задания
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Просмотр и выполнение заданий по вашим курсам
        </p>
      </div>

      {/* Фильтры */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'overdue', 'pending', 'submitted', 'completed'].map((f) => {
          const overdueCount = f === 'all' ? tasks.filter(task => isOverdue(task)).length : null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 relative ${
                filter === f
                  ? f === 'overdue'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                  : f === 'overdue'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'overdue' ? (
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Пропущенные
                  {overdueCount > 0 && (
                    <span className="bg-red-600 text-white text-xs rounded-full px-2 py-0.5">
                      {overdueCount}
                    </span>
                  )}
                </span>
              ) : f === 'pending' ? 'Ожидают' : f === 'submitted' ? 'Отправлены' : 'Завершены'}
            </button>
          );
        })}
      </div>

      {getFilteredTasks().length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {filter === 'overdue' ? 'Пропущенных заданий нет' : 'Задания не найдены'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {getFilteredTasks().map((task) => {
            const submissionStatus = getSubmissionStatus(task);
            const submission = task.submissions?.[0];
            const overdue = isOverdue(task);

            return (
              <div
                key={task.id}
                className={`card hover:shadow-lg transition-all duration-300 border-2 ${
                  overdue
                    ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10 hover:border-red-400 dark:hover:border-red-600'
                    : 'border-transparent hover:border-blue-200 dark:hover:border-blue-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                          {task.title}
                        </h3>
                        {task.course && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <BookOpen className="w-4 h-4" />
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium">
                              {task.course.title}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(task.status)}
                        {submissionStatus && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Решение: {getStatusBadge(submissionStatus).props.children}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {task.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className={`flex items-center gap-2 ${overdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                        {overdue ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        <span>
                          Дедлайн: {format(new Date(task.deadline), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          {overdue && ' (ПРОПУЩЕН)'}
                        </span>
                      </div>
                      {overdue && task.allowLateSubmission === false && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Отправка недоступна
                        </span>
                      )}
                      {task.referenceLink && (
                        <a
                          href={task.referenceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Ссылка на ресурс
                        </a>
                      )}
                    </div>

                    {submission && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Ваше решение:
                        </p>
                        {submission.solutionDescription && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {submission.solutionDescription}
                          </p>
                        )}
                        {submission.solutionLink && (
                          <a
                            href={submission.solutionLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {submission.solutionLink}
                          </a>
                        )}
                        {submission.reviewComment && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                              Комментарий преподавателя:
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {submission.reviewComment}
                            </p>
                          </div>
                        )}
                        {submission.grade && (
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-2">
                            Оценка: {submission.grade}/10
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => navigate(`/student/tasks/${task.id}`)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        {submission ? 'Изменить решение' : 'Отправить решение'}
                      </button>
                      {task.course && (
                        <button
                          onClick={() => navigate(`/student/courses/${task.course.id}/chat`)}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                        >
                          Написать преподавателю
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StudentTasks;

