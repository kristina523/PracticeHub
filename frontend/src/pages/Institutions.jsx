import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { Plus, Edit, Trash2, Loader2, School, Users, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';


const getFullName = (student) => {
  const parts = [student.lastName, student.firstName];
  if (student.middleName) parts.push(student.middleName);
  return parts.join(' ');
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
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

function Institutions() {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'COLLEGE'
  });
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/institutions');
      setInstitutions(response.data);
    } catch (error) {
      console.error('Ошибка получения учебных заведений:', error);
      alert('Ошибка загрузки учебных заведений');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/institutions/${editingId}`, formData);
      } else {
        await api.post('/institutions', formData);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', type: 'COLLEGE' });
      fetchInstitutions();
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleEdit = (institution) => {
    setEditingId(institution.id);
    setFormData({
      name: institution.name,
      type: institution.type
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить это учебное заведение?')) {
      return;
    }

    try {
      await api.delete(`/institutions/${id}`);
      fetchInstitutions();
    } catch (error) {
      alert('Ошибка при удалении: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', type: 'COLLEGE' });
  };

  const handleViewStudents = async (institution) => {
    setSelectedInstitution(institution);
    setLoadingStudents(true);
    try {

      const response = await api.get('/students', {
        params: {
          institutionId: institution.id,
          limit: 100
        }
      });
      setStudents(response.data.students);
    } catch (error) {
      console.error('Ошибка получения студентов:', error);
      alert('Ошибка загрузки студентов');
    } finally {
      setLoadingStudents(false);
    }
  };

  const closeStudentsModal = () => {
    setSelectedInstitution(null);
    setStudents([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Учебные заведения
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Управление справочником колледжей и университетов
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Добавить учебное заведение
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? 'Редактировать учебное заведение' : 'Добавить учебное заведение'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Название <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Тип <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input"
                required
              >
                <option value="COLLEGE">Колледж</option>
                <option value="UNIVERSITY">Университет</option>
              </select>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
              >
                Отмена
              </button>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Сохранить изменения' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : institutions.length === 0 ? (
        <div className="card text-center py-12">
          <School className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Учебные заведения не найдены
          </p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary mt-4"
            >
              Добавить первое учебное заведение
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {institutions.map((institution) => (
            <div key={institution.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <School className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {institution.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {institution.type === 'COLLEGE' ? 'Колледж' : 'Университет'}
                    </p>
                  </div>
                </div>
              </div>

              <div 
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                onClick={() => handleViewStudents(institution)}
                title="Нажмите, чтобы просмотреть студентов"
              >
                <Users className="w-4 h-4" />
                <span>
                  {institution._count?.students || 0} практикантов
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleViewStudents(institution)}
                  className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Просмотр студентов
                </button>
                <button
                  onClick={() => handleEdit(institution)}
                  className="btn btn-secondary p-2"
                  title="Редактировать"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(institution.id)}
                  className="btn btn-danger p-2"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedInstitution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedInstitution.name}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedInstitution.type === 'COLLEGE' ? 'Колледж' : 'Университет'} • {students.length} практикантов
                </p>
              </div>
              <button
                onClick={closeStudentsModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingStudents ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    В этом учебном заведении пока нет практикантов
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Link
                            to={`/students/${student.id}`}
                            className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                          >
                            {getFullName(student)}
                          </Link>
                          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>
                              <strong>Тип практики:</strong> {practiceTypeLabels[student.practiceType]}
                            </span>
                            <span>
                              <strong>Курс:</strong> {student.course}
                            </span>
                            <span>
                              <strong>Период:</strong>{' '}
                              {format(new Date(student.startDate), 'dd.MM.yyyy', { locale: ru })} - {' '}
                              {format(new Date(student.endDate), 'dd.MM.yyyy', { locale: ru })}
                            </span>
                          </div>
                          {student.email && (
                            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              <strong>Email:</strong> {student.email}
                            </div>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[student.status]}`}>
                          {statusLabels[student.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Institutions;

