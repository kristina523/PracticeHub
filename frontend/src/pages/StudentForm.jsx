import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../utils/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const schema = yup.object({
  lastName: yup.string().required('Фамилия обязательна'),
  firstName: yup.string().required('Имя обязательно'),
  middleName: yup.string(),
  practiceType: yup.string().oneOf(['EDUCATIONAL', 'PRODUCTION', 'INTERNSHIP']).required('Тип практики обязателен'),
  institutionId: yup.string(), 
  institutionName: yup.string().required('Название учебного заведения обязательно'),
  course: yup.number().min(1).max(10).required('Курс обязателен'),
  email: yup.string().email('Неверный email'),
  phone: yup.string(),
  telegramId: yup.string(),
  startDate: yup.date().required('Дата начала обязательна'),
  endDate: yup.date().required('Дата окончания обязательна').min(yup.ref('startDate'), 'Дата окончания должна быть после даты начала'),
  status: yup.string().oneOf(['PENDING', 'ACTIVE', 'COMPLETED']),
  supervisor: yup.string(),
  notes: yup.string()
});

function StudentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  
  const [institutions, setInstitutions] = useState([]);
  const [allInstitutions, setAllInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [institutionSuggestions, setInstitutionSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      status: 'PENDING'
    }
  });

  const selectedInstitutionId = watch('institutionId');

  useEffect(() => {
    fetchInstitutions();
    if (isEdit) {
      fetchStudent();
    }
  }, [id]);


  const fetchInstitutions = async (search = '') => {
    try {
      const params = search ? { search, limit: 10 } : {};
      const response = await api.get('/institutions', { params });
      setInstitutions(response.data);
      if (!search) {
        setAllInstitutions(response.data);
      }
      return response.data;
    } catch (error) {
      console.error('Ошибка получения учебных заведений:', error);
      return [];
    }
  };

  const searchInstitutions = async (query) => {
    if (query.length < 1) {
      const results = await fetchInstitutions('');
      setInstitutionSuggestions(results);
      setShowSuggestions(results.length > 0);
      return;
    }

    const results = await fetchInstitutions(query);
    setInstitutionSuggestions(results);
    setShowSuggestions(true);
  };

  const handleInstitutionNameChange = (e) => {
    const value = e.target.value;
    setInstitutionSearch(value);
    setValue('institutionName', value);
    setValue('institutionId', ''); 
    
    searchInstitutions(value);
  };

  const selectInstitution = (institution) => {
    setValue('institutionName', institution.name);
    setValue('institutionId', institution.id);
    setInstitutionSearch(institution.name);
    setShowSuggestions(false);
    setInstitutionSuggestions([]);
  };

  const fetchStudent = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/students/${id}`);
      const student = response.data;
      
      setValue('lastName', student.lastName);
      setValue('firstName', student.firstName);
      setValue('middleName', student.middleName || '');
      setValue('practiceType', student.practiceType);
      setValue('institutionId', student.institutionId);
      setValue('institutionName', student.institutionName);
      setInstitutionSearch(student.institutionName);
      setValue('course', student.course);
      setValue('email', student.email || '');
      setValue('phone', student.phone || '');
      setValue('telegramId', student.telegramId || '');
      setValue('startDate', student.startDate.split('T')[0]);
      setValue('endDate', student.endDate.split('T')[0]);
      setValue('status', student.status);
      setValue('supervisor', student.supervisor || '');
      setValue('notes', student.notes || '');
    } catch (error) {
      console.error('Ошибка получения студента:', error);
      alert('Ошибка загрузки данных студента');
      navigate('/students');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/students/${id}`, data);
      } else {
        await api.post('/students', data);
      }
      navigate('/students');
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/students" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isEdit ? 'Редактировать практиканта' : 'Добавить практиканта'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Фамилия <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('lastName')}
              className="input"
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.lastName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Имя <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('firstName')}
              className="input"
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Отчество
            </label>
            <input
              type="text"
              {...register('middleName')}
              className="input"
            />
            {errors.middleName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.middleName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Тип практики <span className="text-red-500">*</span>
            </label>
            <select {...register('practiceType')} className="input">
              <option value="">Выберите тип</option>
              <option value="EDUCATIONAL">Учебная</option>
              <option value="PRODUCTION">Производственная</option>
              <option value="INTERNSHIP">Стажировка</option>
            </select>
            {errors.practiceType && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.practiceType.message}</p>
            )}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Название учебного заведения <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={institutionSearch}
                onChange={handleInstitutionNameChange}
                onFocus={() => {
                  if (institutionSuggestions.length === 0) {
                    searchInstitutions('');
                  } else {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className="input"
                placeholder="Начните вводить или выберите из списка..."
                autoComplete="off"
              />
              <input
                type="hidden"
                {...register('institutionName')}
              />
              <input
                type="hidden"
                {...register('institutionId')}
              />
              
              {showSuggestions && institutionSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {institutionSuggestions.map((institution) => (
                    <div
                      key={institution.id}
                      onClick={() => selectInstitution(institution)}
                      className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {institution.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {institution.type === 'COLLEGE' ? 'Колледж' : 'Университет'}
                        {institution._count?.students > 0 && (
                          <span className="ml-2">• {institution._count.students} практикантов</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.institutionName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.institutionName.message}</p>
            )}
            {institutionSearch && !showSuggestions && institutionSuggestions.length === 0 && institutionSearch.length >= 1 && !selectedInstitutionId && !allInstitutions.some(inst => inst.name.toLowerCase() === institutionSearch.toLowerCase()) && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Учебное заведение не найдено.</strong> При сохранении будет создано новое учебное заведение с указанным названием.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Курс/год обучения <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="10"
              {...register('course', { valueAsNumber: true })}
              className="input"
            />
            {errors.course && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.course.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Статус практики
            </label>
            <select {...register('status')} className="input">
              <option value="PENDING">Ожидает</option>
              <option value="ACTIVE">Активна</option>
              <option value="COMPLETED">Завершена</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              {...register('email')}
              className="input"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Телефон
            </label>
            <input
              type="tel"
              {...register('phone')}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Telegram ID
            </label>
            <input
              type="text"
              {...register('telegramId')}
              className="input"
              placeholder="@username или ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Руководитель практики от компании
            </label>
            <input
              type="text"
              {...register('supervisor')}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Дата начала практики <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('startDate')}
              className="input"
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startDate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Дата окончания практики <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('endDate')}
              className="input"
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endDate.message}</p>
            )}
          </div>
        </div>
              
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Комментарии/заметки
          </label>
          <textarea
            {...register('notes')}
            rows="4"
            className="input"
          />
        </div>

        <div className="flex justify-end gap-4">
          <Link to="/students" className="btn btn-secondary">
            Отмена
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Сохранение...
              </>
            ) : (
              isEdit ? 'Сохранить изменения' : 'Добавить практиканта'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StudentForm;

