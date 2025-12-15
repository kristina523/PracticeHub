import { useState, useEffect } from 'react';
import api from '../utils/api';
import { FileText, CheckCircle, XCircle, Clock, Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const practiceTypeLabels = {
  EDUCATIONAL: 'Учебная',
  PRODUCTION: 'Производственная',
  INTERNSHIP: 'Стажировка'
};

const statusLabels = {
  PENDING: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена'
};

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
};

function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    practiceType: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    fetchApplications();
  }, [filters, pagination.page]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.status && { status: filters.status }),
        ...(filters.practiceType && { practiceType: filters.practiceType })
      };

      const response = await api.get('/applications', { params });
      setApplications(response.data.applications);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Ошибка получения заявок:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Вы уверены, что хотите одобрить эту заявку? Будет создан новый студент.')) {
      return;
    }

    try {
      await api.patch(`/applications/${id}/approve`, { notes: approvalNotes });
      setSelectedApplication(null);
      setApprovalNotes('');
      fetchApplications();
      alert('Заявка одобрена! Студент создан.');
    } catch (error) {
      alert('Ошибка при одобрении: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleReject = async (id) => {
    if (!rejectionReason.trim()) {
      alert('Укажите причину отклонения');
      return;
    }

    if (!window.confirm('Вы уверены, что хотите отклонить эту заявку?')) {
      return;
    }

    try {
      await api.patch(`/applications/${id}/reject`, { rejectionReason });
      setSelectedApplication(null);
      setRejectionReason('');
      fetchApplications();
      alert('Заявка отклонена.');
    } catch (error) {
      alert('Ошибка при отклонении: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getFullName = (app) => {
    const parts = [app.lastName, app.firstName];
    if (app.middleName) parts.push(app.middleName);
    return parts.join(' ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Заявки на практику
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Управление заявками студентов на практику
        </p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="input"
          >
            <option value="">Все статусы</option>
            <option value="PENDING">На рассмотрении</option>
            <option value="APPROVED">Одобренные</option>
            <option value="REJECTED">Отклоненные</option>
          </select>

          <select
            value={filters.practiceType}
            onChange={(e) => handleFilterChange('practiceType', e.target.value)}
            className="input"
          >
            <option value="">Все типы практики</option>
            <option value="EDUCATIONAL">Учебная</option>
            <option value="PRODUCTION">Производственная</option>
            <option value="INTERNSHIP">Стажировка</option>
          </select>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Найдено: {pagination.total} заявок
        </p>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Заявки не найдены
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {getFullName(app)}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[app.status]}`}>
                        {statusLabels[app.status]}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Тип практики:</span>{' '}
                        {practiceTypeLabels[app.practiceType]}
                      </div>
                      <div>
                        <span className="font-medium">Учебное заведение:</span>{' '}
                        {app.institutionName}
                      </div>
                      <div>
                        <span className="font-medium">Курс:</span> {app.course}
                      </div>
                      <div>
                        <span className="font-medium">Период:</span>{' '}
                        {format(new Date(app.startDate), 'dd.MM.yyyy', { locale: ru })} - {' '}
                        {format(new Date(app.endDate), 'dd.MM.yyyy', { locale: ru })}
                      </div>
                    </div>

                    {app.email && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Email:</span> {app.email}
                      </div>
                    )}

                    {app.phone && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Телефон:</span> {app.phone}
                      </div>
                    )}

                    {app.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
                        <span className="font-medium">Причина отклонения:</span> {app.rejectionReason}
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Подана: {format(new Date(app.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {app.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => setSelectedApplication(app)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Просмотр"
                        >
                          <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleApprove(app.id)}
                          className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                          title="Одобрить"
                        >
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedApplication(app);
                            setRejectionReason('');
                          }}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Отклонить"
                        >
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно для деталей заявки */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Детали заявки
                </h2>
                <button
                  onClick={() => {
                    setSelectedApplication(null);
                    setRejectionReason('');
                    setApprovalNotes('');
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ФИО
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {getFullName(selectedApplication)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Тип практики
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {practiceTypeLabels[selectedApplication.practiceType]}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Учебное заведение
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedApplication.institutionName}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Курс
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedApplication.course}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedApplication.email || 'Не указан'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Телефон
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedApplication.phone || 'Не указан'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Дата начала
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {format(new Date(selectedApplication.startDate), 'dd.MM.yyyy', { locale: ru })}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Дата окончания
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {format(new Date(selectedApplication.endDate), 'dd.MM.yyyy', { locale: ru })}
                    </p>
                  </div>
                </div>

                {selectedApplication.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Дополнительная информация
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedApplication.notes}
                    </p>
                  </div>
                )}

                {selectedApplication.status === 'PENDING' && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Заметки при одобрении (необязательно)
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        className="input"
                        rows="3"
                        placeholder="Дополнительные заметки..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Причина отклонения
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="input"
                        rows="3"
                        placeholder="Укажите причину отклонения..."
                      />
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleApprove(selectedApplication.id)}
                        className="btn btn-primary flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Одобрить
                      </button>
                      <button
                        onClick={() => handleReject(selectedApplication.id)}
                        disabled={!rejectionReason.trim()}
                        className="btn btn-secondary flex-1 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Отклонить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Applications;

