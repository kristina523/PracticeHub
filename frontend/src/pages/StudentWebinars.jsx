import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Loader2, Calendar, Users, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

function StudentWebinars() {
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming'); // upcoming, past, all

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

  const handleRegister = async (webinarId) => {
    try {
      await api.post(`/webinars/${webinarId}/register`);
      alert('Вы успешно зарегистрированы на вебинар!');
      fetchWebinars();
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      alert(error.response?.data?.message || 'Ошибка регистрации на вебинар');
    }
  };

  const handleUnregister = async (webinarId) => {
    if (!confirm('Вы уверены, что хотите отменить регистрацию?')) return;

    try {
      await api.delete(`/webinars/${webinarId}/register`);
      alert('Регистрация отменена');
      fetchWebinars();
    } catch (error) {
      console.error('Ошибка отмены регистрации:', error);
      alert(error.response?.data?.message || 'Ошибка отмены регистрации');
    }
  };

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Вебинары
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Просмотр и регистрация на вебинары
        </p>
      </div>

      {/* Фильтры */}
      <div className="card">
        <div className="flex gap-2">
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
                const isRegistered = webinar.isRegistered;
                const canRegister = !isPast && !isRegistered && (!webinar.maxParticipants || (webinar.registrationCount || 0) < webinar.maxParticipants);
                const isFull = webinar.maxParticipants && (webinar.registrationCount || 0) >= webinar.maxParticipants;

                return (
                  <div
                    key={webinar.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {webinar.title}
                          </h3>
                          {isRegistered && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Зарегистрирован
                            </span>
                          )}
                        </div>
                        {webinar.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {webinar.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
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
                      <div className="ml-4">
                        {isPast ? (
                          <span className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            Прошедший
                          </span>
                        ) : isRegistered ? (
                          <button
                            onClick={() => handleUnregister(webinar.id)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Отменить регистрацию
                          </button>
                        ) : isFull ? (
                          <span className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
                            Мест нет
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRegister(webinar.id)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Зарегистрироваться
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StudentWebinars;

