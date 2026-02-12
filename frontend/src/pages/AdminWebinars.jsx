import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Loader2, Plus, Edit, Trash2, Calendar, Users, ExternalLink, X } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

function AdminWebinars() {
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWebinar, setSelectedWebinar] = useState(null);
  const [filter, setFilter] = useState('all'); // all, upcoming, past
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    startTime: '',
    endTime: '',
    maxParticipants: ''
  });

  useEffect(() => {
    fetchWebinars();
  }, [filter]);

  const fetchWebinars = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === 'upcoming') params.upcoming = 'true';
      if (filter === 'past') params.past = 'true';

      const response = await api.get('/webinars', { params });
      setWebinars(response.data.webinars || []);
    } catch (error) {
      console.error('Ошибка загрузки вебинаров:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/webinars', formData);
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        link: '',
        startTime: '',
        endTime: '',
        maxParticipants: ''
      });
      fetchWebinars();
      alert('Вебинар успешно создан');
    } catch (error) {
      console.error('Ошибка создания вебинара:', error);
      alert(error.response?.data?.message || 'Ошибка создания вебинара');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/webinars/${selectedWebinar.id}`, formData);
      setShowEditModal(false);
      setSelectedWebinar(null);
      setFormData({
        title: '',
        description: '',
        link: '',
        startTime: '',
        endTime: '',
        maxParticipants: ''
      });
      fetchWebinars();
      alert('Вебинар успешно обновлен');
    } catch (error) {
      console.error('Ошибка обновления вебинара:', error);
      alert(error.response?.data?.message || 'Ошибка обновления вебинара');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Вы уверены, что хотите удалить этот вебинар?')) return;

    try {
      await api.delete(`/webinars/${id}`);
      fetchWebinars();
      alert('Вебинар успешно удален');
    } catch (error) {
      console.error('Ошибка удаления вебинара:', error);
      alert(error.response?.data?.message || 'Ошибка удаления вебинара');
    }
  };

  const openEditModal = (webinar) => {
    setSelectedWebinar(webinar);
    setFormData({
      title: webinar.title,
      description: webinar.description || '',
      link: webinar.link,
      startTime: format(new Date(webinar.startTime), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(webinar.endTime), "yyyy-MM-dd'T'HH:mm"),
      maxParticipants: webinar.maxParticipants?.toString() || ''
    });
    setShowEditModal(true);
  };

  const now = new Date();
  const upcomingCount = webinars.filter(w => new Date(w.startTime) >= now).length;
  const pastCount = webinars.filter(w => new Date(w.startTime) < now).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Вебинары
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Управление вебинарами для студентов
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Создать вебинар
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Всего вебинаров</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {webinars.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          </div>
        </div>
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Предстоящие</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {upcomingCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/40 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-green-600 dark:text-green-300" />
          </div>
        </div>
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Прошедшие</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {pastCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="card">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'upcoming'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Предстоящие
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'past'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Прошедшие
          </button>
        </div>
      </div>

      {/* Список вебинаров */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="card">
          {webinars.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Вебинары не найдены
            </div>
          ) : (
            <div className="space-y-4">
              {webinars.map((webinar) => {
                const isPast = new Date(webinar.startTime) < now;
                return (
                  <div
                    key={webinar.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {webinar.title}
                        </h3>
                        {webinar.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {webinar.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(new Date(webinar.startTime), 'dd.MM.yyyy HH:mm', { locale: ru })} -{' '}
                              {format(new Date(webinar.endTime), 'HH:mm', { locale: ru })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>
                              {webinar.registrationCount || 0}
                              {webinar.maxParticipants ? ` / ${webinar.maxParticipants}` : ''} участников
                            </span>
                          </div>
                          {webinar.link && (
                            <a
                              href={webinar.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>Ссылка на вебинар</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => openEditModal(webinar)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(webinar.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно создания */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Создать вебинар
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      title: '',
                      description: '',
                      link: '',
                      startTime: '',
                      endTime: '',
                      maxParticipants: ''
                    });
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Название *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Описание
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ссылка на вебинар *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Дата и время начала *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Дата и время окончания *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Максимальное количество участников (необязательно)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({
                        title: '',
                        description: '',
                        link: '',
                        startTime: '',
                        endTime: '',
                        maxParticipants: ''
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Создать
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования */}
      {showEditModal && selectedWebinar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Редактировать вебинар
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedWebinar(null);
                    setFormData({
                      title: '',
                      description: '',
                      link: '',
                      startTime: '',
                      endTime: '',
                      maxParticipants: ''
                    });
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Название *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Описание
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ссылка на вебинар *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Дата и время начала *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Дата и время окончания *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Максимальное количество участников (необязательно)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedWebinar(null);
                      setFormData({
                        title: '',
                        description: '',
                        link: '',
                        startTime: '',
                        endTime: '',
                        maxParticipants: ''
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Сохранить
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

export default AdminWebinars;

