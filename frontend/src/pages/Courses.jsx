import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { Plus, Search, Loader2, Edit, Trash2, Eye, BookOpen, Code, Globe, Smartphone, Database, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import { confirmDialog } from '../components/Toast';

const directionIcons = {
  'Программирование': Code,
  'Веб-разработка': Globe,
  'Мобильная разработка': Smartphone,
  'Базы данных': Database,
  'Другое': Settings
};

const directionColors = {
  'Программирование': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Веб-разработка': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Мобильная разработка': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'Базы данных': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'Другое': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

function Courses() {
  const { user } = useAuthStore();
  const role = user?.role || 'teacher';
  const isTeacher = role === 'teacher';
  const canManageCourses = isTeacher;
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    direction: 'Программирование',
    imageUrl: ''
  });
  const [imagePreview, setImagePreview] = useState(null);

  const directions = ['Программирование', 'Веб-разработка', 'Мобильная разработка', 'Базы данных', 'Другое'];

  useEffect(() => {
    fetchCourses();
  }, [filterDirection]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        limit: 100,
        ...(filterDirection && { direction: filterDirection })
      };
      const response = await api.get('/courses', { params });
      setCourses(response.data.courses || response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки курсов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Для простоты используем FileReader для base64, но можно загружать на сервер
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData({ ...formData, imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/courses', formData);
      setShowCreateModal(false);
      setFormData({ title: '', description: '', direction: 'Программирование', imageUrl: '' });
      setImagePreview(null);
      fetchCourses();
    } catch (error) {
      alert('Ошибка создания курса: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/courses/${editingCourse.id}`, formData);
      setEditingCourse(null);
      setFormData({ title: '', description: '', direction: 'Программирование', imageUrl: '' });
      setImagePreview(null);
      fetchCourses();
    } catch (error) {
      alert('Ошибка обновления курса: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (
      !(await confirmDialog('Вы уверены, что хотите удалить этот курс?', {
        title: 'Удалить курс?',
        confirmText: 'Удалить',
        variant: 'danger'
      }))
    ) {
      return;
    }

    try {
      await api.delete(`/courses/${id}`);
      fetchCourses();
    } catch (error) {
      alert('Ошибка при удалении: ' + (error.response?.data?.message || error.message));
    }
  };

  const openEditModal = (course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description || '',
      direction: course.direction,
      imageUrl: course.imageUrl || ''
    });
    setImagePreview(course.imageUrl || null);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingCourse(null);
    setFormData({ title: '', description: '', direction: 'Программирование', imageUrl: '' });
    setImagePreview(null);
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = !search || 
      course.title.toLowerCase().includes(search.toLowerCase()) ||
      (course.description && course.description.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const getDirectionIcon = (direction) => {
    const Icon = directionIcons[direction] || BookOpen;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title mb-2">
            {isTeacher ? 'Мои курсы' : 'Все курсы'}
          </h1>
          <p className="page-subtitle">
            {isTeacher ? 'Управление курсами' : 'Просмотр всех курсов системы'}
          </p>
        </div>
        {canManageCourses && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-5 h-5" />
            Создать курс
          </button>
        )}
      </div>

      {/* Фильтры и поиск */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по названию или описанию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-12"
            />
          </div>
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="input"
          >
            <option value="">Все направления</option>
            {directions.map(dir => (
              <option key={dir} value={dir}>{dir}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Список курсов */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-12 h-12 text-indigo-600" />
          </div>
          <p className="text-slate-600 text-xl font-semibold mb-2">
            {search || filterDirection ? 'Курсы не найдены' : 'У вас пока нет курсов'}
          </p>
          {canManageCourses && !search && !filterDirection && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary mt-6"
            >
              Создать первый курс
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const DirectionIcon = directionIcons[course.direction] || BookOpen;
            const isClickable = isTeacher;

            const inner = (
              <>
                  {course.imageUrl ? (
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={course.imageUrl} 
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                      {canManageCourses && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditModal(course);
                            }}
                            className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4 text-gray-700" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDelete(course.id);
                            }}
                            className="p-2 bg-red-500/90 backdrop-blur-sm rounded-lg hover:bg-red-600 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center relative">
                      {canManageCourses && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditModal(course);
                            }}
                            className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4 text-gray-700" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDelete(course.id);
                            }}
                            className="p-2 bg-red-500/90 backdrop-blur-sm rounded-lg hover:bg-red-600 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      )}
                      <div className={`p-6 bg-white/20 backdrop-blur-sm rounded-2xl ${directionColors[course.direction] || directionColors['Другое']}`}>
                        <DirectionIcon className="w-12 h-12 text-white" />
                      </div>
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                        {course.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${directionColors[course.direction] || directionColors['Другое']}`}>
                        {course.direction}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {format(new Date(course.createdAt), 'dd.MM.yyyy', { locale: ru })}
                      </span>
                    </div>
                  </div>
              </>
            );

            return (
              <div
                key={course.id}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border border-slate-200"
              >
                {isClickable ? (
                  <Link to={`/teacher/courses/${course.id}`} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div className="block cursor-default">
                    {inner}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {(showCreateModal || editingCourse) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {editingCourse ? 'Редактировать курс' : 'Создать новый курс'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {editingCourse ? 'Внесите изменения в курс' : 'Заполните информацию о новом курсе'}
                </p>
              </div>
              <form onSubmit={editingCourse ? handleUpdate : handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Название курса *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input"
                    placeholder="Например: Основы JavaScript"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Направление *
                  </label>
                  <select
                    required
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                    className="input"
                  >
                    {directions.map(dir => (
                      <option key={dir} value={dir}>{dir}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows="4"
                    placeholder="Описание курса..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Изображение курса
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="input"
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img 
                        src={imagePreview} 
                        alt="Предпросмотр" 
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setFormData({ ...formData, imageUrl: '' });
                        }}
                        className="mt-2 text-sm text-red-600 hover:text-red-800"
                      >
                        Удалить изображение
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {editingCourse ? 'Сохранить' : 'Создать'}
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

export default Courses;

