import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Loader2, Send } from 'lucide-react';

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

function Notifications() {
  const [institutions, setInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({
    practiceType: '',
    status: '',
    institutionId: ''
  });
  const [customIds, setCustomIds] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const res = await api.get('/institutions', { params: { limit: 200 } });
        setInstitutions(res.data);
      } catch (err) {
        console.error('Ошибка загрузки институтов', err);
        setError('Не удалось загрузить список учебных заведений');
      } finally {
        setLoadingInstitutions(false);
      }
    };
    fetchInstitutions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    const telegramIds = customIds
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    const payload = {
      message,
      telegramIds,
      filters: {
        ...(filters.practiceType && { practiceType: filters.practiceType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.institutionId && { institutionId: filters.institutionId }),
      }
    };

    try {
      const res = await api.post('/notifications/bulk', payload);
      setResult(res.data);
    } catch (err) {
      console.error('Ошибка отправки уведомлений', err);
      setError(err.response?.data?.message || 'Не удалось отправить уведомления');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Массовые уведомления
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Отправка сообщений выбранной группе студентов в Telegram
        </p>
      </div>

      <div className="card">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label">Текст сообщения</label>
            <textarea
              className="input min-h-[120px]"
              placeholder="Введите текст уведомления..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Тип практики</label>
              <select
                className="input"
                value={filters.practiceType}
                onChange={(e) => setFilters(prev => ({ ...prev, practiceType: e.target.value }))}
              >
                <option value="">Все типы</option>
                <option value="EDUCATIONAL">Учебная</option>
                <option value="PRODUCTION">Производственная</option>
                <option value="INTERNSHIP">Стажировка</option>
              </select>
            </div>

            <div>
              <label className="label">Статус</label>
              <select
                className="input"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Все статусы</option>
                <option value="PENDING">Ожидает</option>
                <option value="ACTIVE">Активна</option>
                <option value="COMPLETED">Завершена</option>
              </select>
            </div>

            <div>
              <label className="label">Учебное заведение</label>
              {loadingInstitutions ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Загрузка...
                </div>
              ) : (
                <select
                  className="input"
                  value={filters.institutionId}
                  onChange={(e) => setFilters(prev => ({ ...prev, institutionId: e.target.value }))}
                >
                  <option value="">Все заведения</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="label">Telegram ID (через запятую, необязательно)</label>
            <input
              type="text"
              className="input"
              placeholder="Например: 12345, 67890"
              value={customIds}
              onChange={(e) => setCustomIds(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Если указать фильтры и Telegram ID, рассылка пойдет всем уникальным получателям.
            </p>
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="text-green-600 dark:text-green-400 text-sm">
              Успешно: {result.success} / {result.total}, ошибок: {result.failed}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary flex items-center gap-2"
            disabled={submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {!submitting && <Send className="w-4 h-4" />}
            Отправить уведомление
          </button>
        </form>
      </div>
    </div>
  );
}

export default Notifications;

