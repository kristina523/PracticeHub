import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { KeyRound } from 'lucide-react';

function ForgotPassword() {
  const location = useLocation();
  const [login, setLogin] = useState('');
  const [loginLocked, setLoginLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromLogin = typeof location.state?.login === 'string' ? location.state.login.trim() : '';
    if (fromLogin) {
      setLogin(fromLogin);
      setLoginLocked(true);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const loginTrim = login.trim();
    if (!loginTrim) {
      setError('Укажите имя пользователя или email (как при входе).');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/set-password-direct', {
        login: loginTrim,
        password,
        confirmPassword
      });
      setMessage(data.message || 'Пароль изменён.');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      const d = err.response?.data;
      if (Array.isArray(d?.errors) && d.errors.length) {
        setError(d.errors.map((x) => x.msg || x.message).join(', '));
      } else {
        setError(d?.message || 'Не удалось сменить пароль');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 md:py-12">
      <div className="max-w-md mx-auto">
        <section className="card rounded-3xl p-6 md:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-4">
              <KeyRound className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Новый пароль</h2>
            <p className="text-slate-500 mt-2 text-sm">
              {loginLocked
                ? 'Введите новый пароль дважды. Логин подставлен со страницы входа.'
                : 'Укажите имя пользователя или email (как при входе), затем новый пароль дважды.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
                {message}
              </div>
            )}

            {loginLocked ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <span>
                  Учётная запись: <span className="font-medium text-slate-900">{login}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginLocked(false);
                    setError('');
                    setMessage('');
                  }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Изменить
                </button>
              </div>
            ) : (
              <div>
                <label htmlFor="login" className="block text-sm font-medium text-slate-700 mb-2">
                  Имя пользователя или email
                </label>
                <input
                  id="login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="input"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Новый пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
                minLength={6}
                autoComplete="new-password"
                autoFocus={loginLocked}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                Повторите пароль
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Сохранение…' : 'Сохранить новый пароль'}
            </button>

            <div className="text-center text-sm text-slate-500">
              <Link to="/login" className="text-blue-600 hover:underline font-medium">
                ← Назад к входу
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default ForgotPassword;
