import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { GraduationCap } from 'lucide-react';
import api from '../utils/api';

function RegisterStudent() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    studentId: ''
  });
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  const { registerStudent } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Пытаемся загрузить студентов, но не критично, если не получится
    fetchStudents().catch(() => {
      // Игнорируем ошибку - поле studentId опционально
    });
  }, []);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const response = await api.get('/students');
      const studentsList = response.data.students || response.data || [];
      setStudents(studentsList);
    } catch (error) {
      // Если не удалось загрузить (например, нет авторизации), просто не показываем список
      console.log('Список студентов недоступен (требуется авторизация)');
      setStudents([]);
    } finally {
      setLoadingStudents(false);
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

    // Валидация на клиенте
    if (!formData.username || formData.username.trim().length < 3) {
      setError('Имя пользователя должно содержать не менее 3 символов');
      return;
    }

    if (!formData.email || !formData.email.includes('@')) {
      setError('Введите корректный email адрес');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Преобразуем пустую строку в null для studentId
      const studentIdToSend = formData.studentId && formData.studentId.trim() !== '' 
        ? formData.studentId.trim() 
        : null;

      console.log('Отправка данных регистрации:', {
        username: formData.username.trim(),
        email: formData.email.trim(),
        hasPassword: !!formData.password,
        studentId: studentIdToSend
      });

      const result = await registerStudent(
        formData.username.trim(),
        formData.email.trim(),
        formData.password,
        studentIdToSend
      );
      
      console.log('Результат регистрации:', result);
      
      if (result && result.success) {
        // Показываем сообщение об успехе перед редиректом
        setError(''); // Очищаем ошибки
        // Небольшая задержка перед редиректом
        setTimeout(() => {
          navigate('/login', { 
            state: { message: 'Студент успешно зарегистрирован! Теперь вы можете войти в систему.' } 
          });
        }, 1000);
      } else {
        const errorMessage = result?.message || 'Ошибка регистрации';
        console.error('Ошибка регистрации:', errorMessage);
        setError(errorMessage);
        setLoading(false);
      }
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      setError(error.message || 'Произошла ошибка при регистрации. Попробуйте еще раз.');
      setLoading(false);
    }
  };

  const getStudentFullName = (student) => {
    const parts = [student.lastName, student.firstName];
    if (student.middleName) parts.push(student.middleName);
    return parts.join(' ');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4">
              <GraduationCap className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Регистрация студента
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Создайте аккаунт студента
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Выберите студента (необязательно)
              </label>
              <select
                id="studentId"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                className="input"
                disabled={loadingStudents}
              >
                <option value="">Не привязывать к студенту</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {getStudentFullName(student)} - {student.institutionName}
                  </option>
                ))}
              </select>
              {loadingStudents && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Загрузка студентов...</p>
              )}
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Имя пользователя *
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                className="input"
                required
                minLength={3}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="input"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Пароль *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Подтвердите пароль *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !formData.username || !formData.email || !formData.password || !formData.confirmPassword}
              className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
            {(!formData.username || !formData.email || !formData.password || !formData.confirmPassword) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Заполните все обязательные поля
              </p>
            )}

            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:underline">
                Войти
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RegisterStudent;

