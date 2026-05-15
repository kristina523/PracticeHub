import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogIn } from 'lucide-react';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const { login, logout, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }
  }, [location]);

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      if (user.role === 'teacher') navigate('/teacher', { replace: true });
      else if (user.role === 'student') navigate('/student', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    logout();

    const result = await login(username.trim(), password);

    setLoading(false);

    if (!result.success) {
      setError(result.message || 'Ошибка входа');
      return;
    }

    const role = result?.user?.role || useAuthStore.getState().user?.role;
    if (role === 'teacher') navigate('/teacher', { replace: true });
    else if (role === 'student') navigate('/student', { replace: true });
    else navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen px-4 py-8 md:py-12">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
        <section className="hidden lg:flex rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10" />
          <div className="absolute right-10 bottom-10 w-40 h-40 rounded-full bg-sky-300/20" />
          <div className="relative z-10 flex items-start">
            <h1 className="text-5xl font-bold leading-tight">PracticeHub</h1>
          </div>
        </section>

        <section className="card rounded-3xl p-6 md:p-8 lg:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-4">
              <LogIn className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Вход в систему</h2>
            <p className="text-slate-500 mt-2">Авторизуйтесь, чтобы продолжить работу</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                Имя пользователя или email
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
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Пароль
                </label>
                <Link
                  to="/forgot-password"
                  state={{ login: username }}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  Забыли пароль?
                </Link>
              </div>
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

            <div className="text-center text-sm text-slate-500 pt-1 space-y-2">
              <div>
                Нет аккаунта?{' '}
                <Link to="/register/student" className="text-blue-600 hover:underline font-medium">
                  Регистрация студента
                </Link>
                {' · '}
                <Link to="/register/teacher" className="text-blue-600 hover:underline font-medium">
                  Регистрация преподавателя
                </Link>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Login;
