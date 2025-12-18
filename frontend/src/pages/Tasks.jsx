import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Plus, Search, Filter, Loader2, Eye, CheckCircle, XCircle, Clock, FileText, Send, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusLabels = {
  PENDING: 'Ожидает выполнения',
  IN_PROGRESS: 'В работе',
  SUBMITTED: 'Отправлено',
  UNDER_REVIEW: 'На проверке',
  COMPLETED: 'Выполнено',
  EXPIRED: 'Просрочено',
  REJECTED: 'Отклонено'
};

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  SUBMITTED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  UNDER_REVIEW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
};

const submissionStatusLabels = {
  SUBMITTED: 'Отправлено',
  UNDER_REVIEW: 'На проверке',
  COMPLETED: 'Принято',
  REJECTED: 'Отклонено'
};

const submissionStatusColors = {
  SUBMITTED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  UNDER_REVIEW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
};

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    studentId: ''
  });
  const [search, setSearch] = useState('');

  // Форма создания задания
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    deadline: '',
    studentId: '',
    referenceLink: ''
  });

  // Форма проверки решения
  const [reviewForm, setReviewForm] = useState({
    status: 'COMPLETED',
    reviewComment: '',
    grade: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchStudents();
  }, [filters]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page: 1,
        limit: 100
      };
      const response = await api.get('/tasks', { params });
      setTasks(response.data.tasks || response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки заданий:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get('/students', { params: { page: 1, limit: 1000 } });
      setStudents(response.data.students || response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки студентов:', error);
    }
  };

  const fetchSubmissions = async (taskId) => {
    try {
      const response = await api.get(`/tasks/${taskId}/submissions`);
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      console.error('Ошибка загрузки решений:', error);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', {
        ...taskForm,
        deadline: new Date(taskForm.deadline).toISOString()
      });
      setShowCreateModal(false);
      setTaskForm({
        title: '',
        description: '',
        deadline: '',
        studentId: '',
        referenceLink: ''
      });
      fetchTasks();
    } catch (error) {
      console.error('Ошибка создания задания:', error);
      alert(error.response?.data?.message || 'Ошибка создания задания');
    }
  };

  const handleReviewSubmission = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/tasks/${selectedSubmission.taskId}/submissions/${selectedSubmission.id}/review`, {
        status: reviewForm.status,
        reviewComment: reviewForm.reviewComment || null,
        grade: reviewForm.grade ? parseInt(reviewForm.grade) : null
      });
      setShowReviewModal(false);
      setSelectedSubmission(null);
      setReviewForm({
        status: 'COMPLETED',
        reviewComment: '',
        grade: ''
      });
      // Обновляем список решений и заданий
      if (selectedTask) {
        await fetchSubmissions(selectedTask.id);
      }
      await fetchTasks();
    } catch (error) {
      console.error('Ошибка проверки решения:', error);
      alert(error.response?.data?.message || 'Ошибка проверки решения');
    }
  };

  const openSubmissionsModal = async (task) => {
    setSelectedTask(task);
    setShowSubmissionsModal(true);
    await fetchSubmissions(task.id);
    // Обновляем список заданий, чтобы увидеть актуальное количество решений
    await fetchTasks();
  };

  const openReviewModal = (submission) => {
    setSelectedSubmission(submission);
    setReviewForm({
      status: submission.status === 'SUBMITTED' ? 'UNDER_REVIEW' : submission.status,
      reviewComment: submission.reviewComment || '',
      grade: submission.grade ? submission.grade.toString() : ''
    });
    setShowReviewModal(true);
  };

  const getStudentName = (student) => {
    if (!student) return 'Не назначено';
    const parts = [student.lastName, student.firstName];
    if (student.middleName) parts.push(student.middleName);
    return parts.join(' ');
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !search || 
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      (task.student && getStudentName(task.student).toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = !filters.status || task.status === filters.status;
    const matchesStudent = !filters.studentId || task.studentId === filters.studentId;
    return matchesSearch && matchesStatus && matchesStudent;
  });

  const tasksWithSubmissions = filteredTasks.filter(task => 
    task.submissions && task.submissions.length > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Задания</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Управление заданиями для студентов
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Создать задание
        </button>
      </div>

      {/* Фильтры и поиск */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск по названию или студенту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="">Все статусы</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={filters.studentId}
            onChange={(e) => setFilters({ ...filters, studentId: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="">Все студенты</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {getStudentName(student)}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setFilters({ status: '', studentId: '' });
              setSearch('');
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
          >
            Сбросить
          </button>
        </div>
      </div>

      {/* Список заданий */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Студент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Дедлайн
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Решения
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      Задания не найдены
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const submissionCount = task.submissions?.length || 0;
                    const hasUnreviewed = task.submissions?.some(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW');
                    return (
                      <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {task.title}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {getStudentName(task.student)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(task.deadline), 'dd.MM.yyyy', { locale: ru })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[task.status] || statusColors.PENDING}`}>
                            {statusLabels[task.status] || task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {submissionCount}
                            </span>
                            {hasUnreviewed && (
                              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openSubmissionsModal(task)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Модальное окно создания задания */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Создать задание
              </h2>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Студент *
                  </label>
                  <select
                    required
                    value={taskForm.studentId}
                    onChange={(e) => setTaskForm({ ...taskForm, studentId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Выберите студента</option>
                    {students
                      .filter(s => s.status === 'PENDING' || s.status === 'ACTIVE')
                      .map((student) => (
                        <option key={student.id} value={student.id}>
                          {getStudentName(student)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Название задания *
                  </label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Описание *
                  </label>
                  <textarea
                    required
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Дедлайн *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ссылка на материалы (необязательно)
                  </label>
                  <input
                    type="url"
                    value={taskForm.referenceLink}
                    onChange={(e) => setTaskForm({ ...taskForm, referenceLink: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Создать задание
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра решений */}
      {showSubmissionsModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Решения для задания: {selectedTask.title}
                </h2>
                <button
                  onClick={() => {
                    setShowSubmissionsModal(false);
                    setSelectedTask(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              {submissions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">Решения пока не отправлены</p>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {getStudentName(submission.student)}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Отправлено: {format(new Date(submission.submittedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${submissionStatusColors[submission.status] || submissionStatusColors.SUBMITTED}`}>
                            {submissionStatusLabels[submission.status] || submission.status}
                          </span>
                          {submission.grade && (
                            <span className="flex items-center text-yellow-600 dark:text-yellow-400">
                              <Star className="w-4 h-4 mr-1" />
                              {submission.grade}/10
                            </span>
                          )}
                        </div>
                      </div>
                      {submission.solutionLink && (
                        <div className="mb-2">
                          <a
                            href={submission.solutionLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            🔗 {submission.solutionLink}
                          </a>
                        </div>
                      )}
                      {submission.solutionDescription && (
                        <div className="mb-2">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {submission.solutionDescription}
                          </p>
                        </div>
                      )}
                      {submission.reviewComment && (
                        <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Комментарий:</strong> {submission.reviewComment}
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => openReviewModal(submission)}
                        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                      >
                        Проверить решение
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно проверки решения */}
      {showReviewModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Проверка решения
              </h2>
              <form onSubmit={handleReviewSubmission} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Статус *
                  </label>
                  <select
                    required
                    value={reviewForm.status}
                    onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="UNDER_REVIEW">На проверке</option>
                    <option value="COMPLETED">Принято</option>
                    <option value="REJECTED">Отклонено</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Оценка (1-10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={reviewForm.grade}
                    onChange={(e) => setReviewForm({ ...reviewForm, grade: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Комментарий
                  </label>
                  <textarea
                    value={reviewForm.reviewComment}
                    onChange={(e) => setReviewForm({ ...reviewForm, reviewComment: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Ваш комментарий к решению..."
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReviewModal(false);
                      setSelectedSubmission(null);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Сохранить проверку
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tasks;

