import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { FileText, ArrowLeft } from 'lucide-react';
import api from '../utils/api';

function ApplicationForm() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    practiceType: 'EDUCATIONAL',
    institutionName: '',
    course: 1,
    email: '',
    phone: '',
    telegramId: '',
    startDate: '',
    endDate: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [myApplications, setMyApplications] = useState([]);

  useEffect(() => {
    fetchMyApplications();
  }, []);

  const fetchMyApplications = async () => {
    try {
      const response = await api.get('/applications/my');
      setMyApplications(response.data.applications || []);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      setError('Дата окончания должна быть после даты начала');
      return;
    }

    setLoading(true);

    try {
      // Преобразуем даты в ISO формат
      const dataToSend = {
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString()
      };

      console.log('Отправка заявки:', dataToSend);

      const response = await api.post('/applications', dataToSend);
      console.log('Ответ сервера:', response.data);
      
      navigate('/student', { state: { message: 'Заявка успешно подана! Ожидайте рассмотрения.' } });
    } catch (error) {
      console.error('Ошибка при подаче заявки:', error);
      console.error('Детали ошибки:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        setError(errorMessages);
      } else {
        setError(error.response?.data?.message || error.message || 'Ошибка при подаче заявки');
      }
    } finally {
      setLoading(false);
    }
  };

  const hasPendingApplication = myApplications.some(app => app.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/student')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Подача заявки на практику
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Заполните форму для подачи заявки на практику
          </p>
        </div>
      </div>

      {hasPendingApplication && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg">
          У вас уже есть активная заявка на рассмотрении. Дождитесь её обработки перед подачей новой.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Фамилия *
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Имя *
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Отчество
                  </label>
                  <input
                    id="middleName"
                    name="middleName"
                    type="text"
                    value={formData.middleName}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="practiceType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Тип практики *
                </label>
                <select
                  id="practiceType"
                  name="practiceType"
                  value={formData.practiceType}
                  onChange={handleChange}
                  className="input"
                  required
                >
                  <option value="EDUCATIONAL">Учебная</option>
                  <option value="PRODUCTION">Производственная</option>
                  <option value="INTERNSHIP">Стажировка</option>
                </select>
              </div>

              <div>
                <label htmlFor="institutionName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Учебное заведение *
                </label>
                <input
                  id="institutionName"
                  name="institutionName"
                  type="text"
                  value={formData.institutionName}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div>
                <label htmlFor="course" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Курс *
                </label>
                <input
                  id="course"
                  name="course"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.course}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input"
                    placeholder={user?.email || ''}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Телефон
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="telegramId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telegram ID
                </label>
                <input
                  id="telegramId"
                  name="telegramId"
                  type="text"
                  value={formData.telegramId}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Дата начала *
                  </label>
                  <input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Дата окончания *
                  </label>
                  <input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Дополнительная информация
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="input"
                  rows="4"
                  placeholder="Дополнительная информация о практике..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading || hasPendingApplication}
                  className="btn btn-primary"
                >
                  {loading ? 'Отправка...' : 'Подать заявку'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/student')}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Мои заявки
            </h2>
            {myApplications.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                У вас пока нет заявок
              </p>
            ) : (
              <div className="space-y-3">
                {myApplications.map((app) => (
                  <div
                    key={app.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {app.practiceType === 'EDUCATIONAL' ? 'Учебная' : 
                         app.practiceType === 'PRODUCTION' ? 'Производственная' : 'Стажировка'}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          app.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : app.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {app.status === 'PENDING' ? 'На рассмотрении' :
                         app.status === 'APPROVED' ? 'Одобрена' : 'Отклонена'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(app.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                    {app.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Причина: {app.rejectionReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicationForm;

