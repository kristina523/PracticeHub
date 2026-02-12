import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  BookOpen, 
  Send,
  FileText,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ru } from 'date-fns/locale';

function StudentTaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    solutionDescription: '',
    solutionLink: ''
  });

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const response = await api.get(`/tasks/${taskId}`);
      setTask(response.data);
      
      // Находим последнее решение студента
      if (response.data.submissions && response.data.submissions.length > 0) {
        setSubmission(response.data.submissions[0]);
        // Если есть решение, показываем форму для редактирования
        setSubmitForm({
          solutionDescription: response.data.submissions[0].solutionDescription || '',
          solutionLink: response.data.submissions[0].solutionLink || ''
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки задания:', error);
      alert('Ошибка загрузки задания: ' + (error.response?.data?.message || error.message));
      navigate('/student/tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Дополнительная проверка перед отправкой
    const deadlineDate = new Date(task.deadline);
    const isOverdue = isPast(deadlineDate) && task.status !== 'COMPLETED';
    if (isOverdue && task.allowLateSubmission === false) {
      alert('Срок сдачи задания истек. Отправка решения больше недоступна.');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Очищаем пустые строки, отправляем null вместо пустых строк
      const dataToSend = {
        solutionDescription: submitForm.solutionDescription?.trim() || null,
        solutionLink: submitForm.solutionLink?.trim() || null
      };
      
      await api.post(`/tasks/${taskId}/submit`, dataToSend);
      alert('Решение успешно отправлено!');
      setShowSubmitForm(false);
      fetchTask(); // Обновляем данные
    } catch (error) {
      console.error('Ошибка отправки решения:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.errors?.[0]?.msg || 
                          error.message;
      alert('Ошибка отправки решения: ' + errorMessage);
    } finally {
      setSubmitting(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Задание не найдено</p>
        <Link to="/student/tasks" className="text-blue-600 dark:text-blue-400 hover:underline mt-4 inline-block">
          Вернуться к заданиям
        </Link>
      </div>
    );
  }

  const deadlineDate = new Date(task.deadline);
  const isOverdue = isPast(deadlineDate) && task.status !== 'COMPLETED';
  // Строгая проверка: можно отправлять только если срок не истек ИЛИ allowLateSubmission явно true
  const canSubmit = (!submission || submission.status === 'REJECTED') && 
                    (!isOverdue || task.allowLateSubmission === true);
  // Блокируем отправку, если срок истек И allowLateSubmission явно false
  const submissionBlocked = isOverdue && task.allowLateSubmission === false;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/student/tasks"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Детали задания
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Просмотр и выполнение задания
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(task.status)}
          {isOverdue && (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              Просрочено
            </span>
          )}
          {submissionBlocked && (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300 border border-red-300 dark:border-red-700">
              Отправка недоступна
            </span>
          )}
        </div>
      </div>

      {/* Основная информация */}
      <div className="card space-y-6">
        {/* Название и курс */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {task.title}
          </h2>
          {task.course && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <BookOpen className="w-4 h-4" />
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium">
                {task.course.title}
              </span>
            </div>
          )}
        </div>

        {/* Описание */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Описание задания
          </h3>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        </div>

        {/* Информация о задании */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Clock className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`} />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Дедлайн</p>
              <p className={`font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {format(new Date(task.deadline), 'dd.MM.yyyy HH:mm', { locale: ru })}
                {isOverdue && ' (истек)'}
              </p>
              {submissionBlocked && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                  Отправка решения после дедлайна запрещена преподавателем
                </p>
              )}
            </div>
          </div>
          {task.referenceLink && (
            <div className="flex items-center gap-3">
              <ExternalLink className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ссылка на ресурс</p>
                <a
                  href={task.referenceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Открыть ресурс
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Решение студента */}
        {submission && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Ваше решение
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {submission.solutionDescription && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Описание решения:
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {submission.solutionDescription}
                    </p>
                  </div>
                )}
                {submission.solutionLink && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Ссылка на решение:
                    </p>
                    <a
                      href={submission.solutionLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {submission.solutionLink}
                    </a>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Отправлено: {submission.submittedAt 
                      ? format(new Date(submission.submittedAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                      : 'Не указано'}
                  </p>
                  {getStatusBadge(submission.status)}
                </div>
              </div>

              {/* Комментарий преподавателя */}
              {submission.reviewComment && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Комментарий преподавателя:
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {submission.reviewComment}
                  </p>
                </div>
              )}

              {/* Оценка */}
              {submission.grade && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">
                    Оценка: {submission.grade}/10
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Форма отправки решения */}
        {showSubmitForm && !submissionBlocked && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {submission ? 'Изменить решение' : 'Отправить решение'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Описание решения
                </label>
                <textarea
                  value={submitForm.solutionDescription}
                  onChange={(e) => setSubmitForm({ ...submitForm, solutionDescription: e.target.value })}
                  rows={6}
                  placeholder="Опишите ваше решение..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ссылка на решение (GitHub, CodePen, и т.д.)
                </label>
                <input
                  type="url"
                  value={submitForm.solutionLink}
                  onChange={(e) => setSubmitForm({ ...submitForm, solutionLink: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Отправка...
                    </span>
                  ) : (
                    'Отправить решение'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitForm(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Предупреждение о блокировке отправки */}
        {submissionBlocked && !submission && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-300 mb-1">
                    Отправка решения недоступна
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Срок сдачи задания истек ({format(deadlineDate, 'dd.MM.yyyy HH:mm', { locale: ru })}). 
                    Преподаватель запретил отправку решений после дедлайна.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Кнопки действий */}
        {!showSubmitForm && (
          <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            {canSubmit && (
              <button
                onClick={() => setShowSubmitForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submission ? 'Изменить решение' : 'Отправить решение'}
              </button>
            )}
            {submissionBlocked && !submission && (
              <button
                disabled
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg font-semibold cursor-not-allowed flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Отправка недоступна
              </button>
            )}
            {task.course && (
              <Link
                to={`/student/courses/${task.course.id}/chat`}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Написать преподавателю
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentTaskDetail;

