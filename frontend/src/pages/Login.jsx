import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogIn } from 'lucide-react';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const { login, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }
  }, [location]);

  useEffect(() => {
    console.log('Login useEffect:', { isAuthenticated, user, role: user?.role });
    if (isAuthenticated) {
      // Перенаправляем в зависимости от роли
      if (user?.role === 'teacher') {
        console.log('Navigating to /teacher');
        navigate('/teacher');
      } else if (user?.role === 'student') {
        console.log('Navigating to /student');
        navigate('/student');
      } else {
        console.log('Navigating to /');
        navigate('/');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password, role);
    
    setLoading(false);
    
    if (result.success) {
      // Навигация произойдет в useEffect
    } else {
      setError(result.message || 'Ошибка входа');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              PracticeHub
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Войдите в систему управления практикантами
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {successMessage && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Роль
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="input"
              >
                <option value="admin">Администратор</option>
                <option value="teacher">Преподаватель</option>
                <option value="student">Студент</option>
              </select>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Имя пользователя
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>

            <div className="space-y-2 text-center text-sm text-gray-600 dark:text-gray-400">
              <div>
                Нет аккаунта?{' '}
                {role === 'admin' && (
                  <Link to="/register/admin" className="text-primary-600 dark:text-primary-400 hover:underline">
                    Зарегистрировать администратора
                  </Link>
                )}
                {role === 'teacher' && (
                  <Link to="/register/teacher" className="text-primary-600 dark:text-primary-400 hover:underline">
                    Зарегистрировать преподавателя
                  </Link>
                )}
                {role === 'student' && (
                  <Link to="/register/student" className="text-primary-600 dark:text-primary-400 hover:underline">
                    Зарегистрировать студента
                  </Link>
                )}
              </div>
              {role === 'admin' && (
                <div className="text-xs">
                  Или{' '}
                  <Link to="/register/teacher" className="text-primary-600 dark:text-primary-400 hover:underline">
                    преподавателя
                  </Link>
                  {' / '}
                  <Link to="/register/student" className="text-primary-600 dark:text-primary-400 hover:underline">
                    студента
                  </Link>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;

