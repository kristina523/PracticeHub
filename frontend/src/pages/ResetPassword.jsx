import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { Lock } from 'lucide-react';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token') || '';
    setToken(t);
    if (!t) {
      setError('В ссылке нет токена. Запросите восстановление пароля ещё раз.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Токен отсутствует.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true, state: { message: data.message || 'Пароль изменён. Войдите с новым паролем.' } });
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
              <Lock className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Новый пароль</h2>
            <p className="text-slate-500 mt-2 text-sm">Введите новый пароль для вашей учётной записи.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
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
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-2">
                Подтвердите пароль
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={loading || !token} className="btn btn-primary w-full">
              {loading ? 'Сохранение…' : 'Сохранить пароль'}
            </button>

            <div className="text-center text-sm text-slate-500">
              <Link to="/forgot-password" className="text-blue-600 hover:underline font-medium">
                Запросить ссылку снова
              </Link>
              {' · '}
              <Link to="/login" className="text-blue-600 hover:underline font-medium">
                Вход
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default ResetPassword;
