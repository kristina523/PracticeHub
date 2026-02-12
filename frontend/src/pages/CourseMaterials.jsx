import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Plus, Loader2, Edit, Trash2, FileText, Video, Link as LinkIcon, File, BookOpen, X, Eye, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const materialTypeIcons = {
  TEXT: FileText,
  VIDEO: Video,
  PDF: File,
  LINK: LinkIcon,
  FILE: File
};

const materialTypeLabels = {
  TEXT: 'Текст',
  VIDEO: 'Видео',
  PDF: 'PDF',
  LINK: 'Ссылка',
  FILE: 'Файл'
};

function CourseMaterials() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [viewingMaterial, setViewingMaterial] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    fileUrl: '',
    materialType: 'TEXT',
    order: 0
  });

  useEffect(() => {
    fetchCourse();
    fetchMaterials();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${courseId}`);
      setCourse(response.data);
    } catch (error) {
      console.error('Ошибка загрузки курса:', error);
    }
  };

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/course-materials/course/${courseId}`);
      setMaterials(response.data.materials || []);
    } catch (error) {
      console.error('Ошибка загрузки материалов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/course-materials', {
        ...formData,
        courseId,
        order: parseInt(formData.order)
      });
      setShowCreateModal(false);
      setFormData({ title: '', description: '', content: '', fileUrl: '', materialType: 'TEXT', order: 0 });
      fetchMaterials();
    } catch (error) {
      alert('Ошибка создания материала: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/course-materials/${editingMaterial.id}`, {
        ...formData,
        order: parseInt(formData.order)
      });
      setEditingMaterial(null);
      setFormData({ title: '', description: '', content: '', fileUrl: '', materialType: 'TEXT', order: 0 });
      fetchMaterials();
    } catch (error) {
      alert('Ошибка обновления материала: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот материал?')) {
      return;
    }

    try {
      await api.delete(`/course-materials/${id}`);
      fetchMaterials();
    } catch (error) {
      alert('Ошибка при удалении: ' + (error.response?.data?.message || error.message));
    }
  };

  const openEditModal = (material) => {
    setEditingMaterial(material);
    setFormData({
      title: material.title,
      description: material.description || '',
      content: material.content || '',
      fileUrl: material.fileUrl || '',
      materialType: material.materialType || 'TEXT',
      order: material.order || 0
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingMaterial(null);
    setFormData({ title: '', description: '', content: '', fileUrl: '', materialType: 'TEXT', order: 0 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link 
            to={`/teacher/courses/${courseId}`} 
            className="p-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Материалы курса
            </h1>
            {course && (
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {course.title}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold text-white hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Добавить материал
        </button>
      </div>

      {materials.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 text-center py-16">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-xl font-semibold mb-2">
            Материалы пока не добавлены
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold text-white hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Добавить первый материал
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {materials.map((material) => {
            const MaterialIcon = materialTypeIcons[material.materialType] || FileText;
            return (
              <div
                key={material.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                      <MaterialIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {material.title}
                        </h3>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {materialTypeLabels[material.materialType]}
                        </span>
                      </div>
                      {material.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          {material.description}
                        </p>
                      )}
                      {material.content && (
                        <div className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                          {material.content.length > 300 ? (
                            <>
                              {material.content.substring(0, 300)}...
                              <button
                                onClick={() => setViewingMaterial(material)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold ml-2"
                              >
                                Читать полностью →
                              </button>
                            </>
                          ) : (
                            material.content
                          )}
                        </div>
                      )}
                      {material.fileUrl && (
                        <div className="mb-3">
                          <a
                            href={material.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Открыть ссылку
                          </a>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Добавлено: {format(new Date(material.createdAt), 'dd.MM.yyyy', { locale: ru })}
                        </p>
                        <button
                          onClick={() => setViewingMaterial(material)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Просмотр
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingMaterial(material)}
                      className="p-2.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-lg transition-colors"
                      title="Просмотр"
                    >
                      <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </button>
                    <button
                      onClick={() => openEditModal(material)}
                      className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(material.id)}
                      className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {(showCreateModal || editingMaterial) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    {editingMaterial ? 'Редактировать материал' : 'Добавить материал'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {editingMaterial ? 'Внесите изменения в материал' : 'Заполните информацию о новом материале'}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <form onSubmit={editingMaterial ? handleUpdate : handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Название материала *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input"
                    placeholder="Например: Введение в JavaScript"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Тип материала *
                  </label>
                  <select
                    required
                    value={formData.materialType}
                    onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
                    className="input"
                  >
                    <option value="TEXT">Текст</option>
                    <option value="VIDEO">Видео</option>
                    <option value="PDF">PDF</option>
                    <option value="LINK">Ссылка</option>
                    <option value="FILE">Файл</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows="2"
                    placeholder="Краткое описание материала..."
                  />
                </div>
                {(formData.materialType === 'TEXT' || formData.materialType === 'PDF') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Содержимое {formData.materialType === 'TEXT' ? '(текст)' : '(ссылка на PDF)'}
                    </label>
                    {formData.materialType === 'TEXT' ? (
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        className="input"
                        rows="6"
                        placeholder="Текст материала..."
                      />
                    ) : (
                      <input
                        type="url"
                        value={formData.fileUrl}
                        onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                        className="input"
                        placeholder="https://example.com/file.pdf"
                      />
                    )}
                  </div>
                )}
                {(formData.materialType === 'VIDEO' || formData.materialType === 'LINK' || formData.materialType === 'FILE') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ссылка *
                    </label>
                    <input
                      type="url"
                      required
                      value={formData.fileUrl}
                      onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                      className="input"
                      placeholder={
                        formData.materialType === 'VIDEO' 
                          ? 'https://youtube.com/watch?v=...' 
                          : formData.materialType === 'FILE'
                          ? 'https://example.com/file.zip'
                          : 'https://example.com'
                      }
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Порядок отображения
                  </label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                    className="input"
                    min="0"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {editingMaterial ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра материала */}
      {viewingMaterial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                    {(() => {
                      const MaterialIcon = materialTypeIcons[viewingMaterial.materialType] || FileText;
                      return <MaterialIcon className="w-8 h-8 text-white" />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                      {viewingMaterial.title}
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {materialTypeLabels[viewingMaterial.materialType]}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Добавлено: {format(new Date(viewingMaterial.createdAt), 'dd.MM.yyyy', { locale: ru })}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setViewingMaterial(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {viewingMaterial.description && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-gray-700 dark:text-gray-300 font-medium">
                    {viewingMaterial.description}
                  </p>
                </div>
              )}

              {viewingMaterial.content && (
                <div className="mb-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed text-base">
                      {viewingMaterial.content}
                    </div>
                  </div>
                </div>
              )}

              {viewingMaterial.fileUrl && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ссылка на материал:</p>
                  <a
                    href={viewingMaterial.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Открыть ссылку
                  </a>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    const materialToEdit = viewingMaterial;
                    setViewingMaterial(null);
                    setTimeout(() => {
                      openEditModal(materialToEdit);
                    }, 100);
                  }}
                  className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Редактировать
                </button>
                <button
                  onClick={() => setViewingMaterial(null)}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseMaterials;

