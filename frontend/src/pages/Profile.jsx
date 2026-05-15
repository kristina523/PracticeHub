import { useEffect, useState } from 'react';
import {
  User as UserIcon,
  Mail,
  AtSign,
  Phone,
  ShieldCheck,
  Lock,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { notify } from '../components/Toast';

const PRACTICE_TYPE_LABELS = {
  EDUCATIONAL: 'Учебная',
  PRODUCTION: 'Производственная',
  INTERNSHIP: 'Стажировка'
};

const STATUS_LABELS = {
  PENDING: 'Ожидает',
  ACTIVE: 'Активна',
  COMPLETED: 'Завершена'
};

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200'
};

function toDateInputValue(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function displayStudentFullName(student) {
  if (!student) return '';
  const parts = [student.lastName, student.firstName, student.middleName].filter((p) => {
    const s = p != null ? String(p).trim() : '';
    return s !== '' && s !== 'Уточнить';
  });
  return parts.length ? parts.join(' ') : '—';
}

function Profile() {
  const { user, updateCurrentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    practiceLastName: '',
    practiceFirstName: '',
    practiceMiddleName: '',
    practiceInstitution: '',
    practiceCourse: '',
    practiceType: 'EDUCATIONAL',
    practiceStartDate: '',
    practiceEndDate: ''
  });

  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/me');
      const data = response.data.user || response.data.admin || {};
      setProfile(data);
      updateCurrentUser(data);
      setFormData((prev) => ({
        ...prev,
        username: data.username || '',
        email: data.email || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        middleName: data.middleName || '',
        phone: data.student?.phone || data.phone || '',
        practiceLastName: data.student?.lastName || '',
        practiceFirstName: data.student?.firstName || '',
        practiceMiddleName: data.student?.middleName || '',
        practiceInstitution: data.student?.institutionName || '',
        practiceCourse:
          data.student?.course != null && data.student?.course !== '' ? String(data.student.course) : '',
        practiceType: data.student?.practiceType || 'EDUCATIONAL',
        practiceStartDate: toDateInputValue(data.student?.startDate),
        practiceEndDate: toDateInputValue(data.student?.endDate)
      }));
    } catch (err) {
      notify('Не удалось загрузить профиль', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password && formData.password.length < 6) {
      notify('Пароль должен содержать не менее 6 символов', { variant: 'warning' });
      return;
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      notify('Пароли не совпадают', { variant: 'warning' });
      return;
    }

    if (isTeacher && !(formData.phone || '').trim()) {
      notify('Укажите телефон', { variant: 'warning' });
      return;
    }
    if (isStudent && profile?.student?.id) {
      if (!(formData.phone || '').trim()) {
        notify('Укажите телефон', { variant: 'warning' });
        return;
      }
      if (!(formData.email || '').trim()) {
        notify('Укажите email в блоке «Учётные данные»', { variant: 'warning' });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        username: formData.username.trim(),
        email: formData.email.trim()
      };
      if (isTeacher) {
        payload.firstName = formData.firstName.trim();
        payload.lastName = formData.lastName.trim();
        payload.middleName = formData.middleName.trim();
        payload.phone = formData.phone.trim();
      }
      if (isStudent && profile?.student?.id) {
        payload.studentPractice = {
          lastName: formData.practiceLastName.trim(),
          firstName: formData.practiceFirstName.trim(),
          middleName: (formData.practiceMiddleName || '').trim(),
          institutionName: (formData.practiceInstitution || '').trim(),
          course: (() => {
            const raw = formData.practiceCourse;
            if (raw === '' || raw == null) return null;
            const n = parseInt(String(raw), 10);
            return Number.isNaN(n) ? null : n;
          })(),
          practiceType: formData.practiceType,
          startDate: formData.practiceStartDate || null,
          endDate: formData.practiceEndDate || null,
          phone: (formData.phone || '').trim(),
          email: formData.email.trim()
        };
      }
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await api.put('/auth/profile', payload);
      const updated = response.data.user;
      updateCurrentUser(updated);
      setProfile((prev) => ({ ...(prev || {}), ...updated }));
      setFormData((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
        ...(updated?.student
          ? {
              phone: updated.student.phone || '',
              practiceLastName: updated.student.lastName || '',
              practiceFirstName: updated.student.firstName || '',
              practiceMiddleName: updated.student.middleName || '',
              practiceInstitution: updated.student.institutionName || '',
              practiceCourse:
                updated.student.course != null && updated.student.course !== ''
                  ? String(updated.student.course)
                  : '',
              practiceType: updated.student.practiceType || 'EDUCATIONAL',
              practiceStartDate: toDateInputValue(updated.student.startDate),
              practiceEndDate: toDateInputValue(updated.student.endDate)
            }
          : {})
      }));
      notify('Данные профиля сохранены', { variant: 'success' });
    } catch (err) {
      if (err.response?.data?.errors?.length) {
        notify(err.response.data.errors.map((i) => i.msg).join(', '), { variant: 'error' });
      } else {
        notify(err.response?.data?.message || 'Не удалось сохранить профиль', { variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-500">Загрузка профиля...</div>;
  }

  const roleLabel = isAdmin ? 'Администратор' : isTeacher ? 'Преподаватель' : 'Студент';
  const studentDisplayName = displayStudentFullName(profile?.student);
  const headlineName = isStudent
    ? (studentDisplayName !== '—' ? studentDisplayName : null) || profile?.username || 'Профиль'
    : isTeacher
    ? `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.username || 'Профиль'
    : profile?.username || 'Профиль';

  const initials = headlineName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Профиль</h1>
        <p className="page-subtitle">Личные данные и безопасность учётной записи</p>
      </div>

      <div className="card flex flex-col md:flex-row md:items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-md">
          {initials || <UserIcon className="w-9 h-9" />}
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">{headlineName}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 font-medium">
              <ShieldCheck className="w-4 h-4" />
              {roleLabel}
            </span>
            {profile?.email && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Mail className="w-4 h-4" />
                {profile.email}
              </span>
            )}
            {profile?.username && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <AtSign className="w-4 h-4" />
                {profile.username}
              </span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {isStudent && profile?.student && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Данные о практике</h3>
              {profile.student.status && (
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    STATUS_STYLES[profile.student.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {STATUS_LABELS[profile.student.status] || profile.student.status}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="practiceLastName" className="block text-sm font-medium text-slate-700 mb-2">
                  Фамилия
                </label>
                <input
                  id="practiceLastName"
                  name="practiceLastName"
                  value={formData.practiceLastName}
                  onChange={handleChange}
                  className="input"
                  required
                  autoComplete="family-name"
                />
              </div>
              <div>
                <label htmlFor="practiceFirstName" className="block text-sm font-medium text-slate-700 mb-2">
                  Имя
                </label>
                <input
                  id="practiceFirstName"
                  name="practiceFirstName"
                  value={formData.practiceFirstName}
                  onChange={handleChange}
                  className="input"
                  required
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label htmlFor="practiceMiddleName" className="block text-sm font-medium text-slate-700 mb-2">
                  Отчество
                </label>
                <input
                  id="practiceMiddleName"
                  name="practiceMiddleName"
                  value={formData.practiceMiddleName}
                  onChange={handleChange}
                  className="input"
                  autoComplete="additional-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="practiceInstitution" className="block text-sm font-medium text-slate-700 mb-2">
                  Учебное заведение
                </label>
                <input
                  id="practiceInstitution"
                  name="practiceInstitution"
                  value={formData.practiceInstitution}
                  onChange={handleChange}
                  className="input"
                  placeholder="Название вуза или колледжа"
                />
              </div>
              <div>
                <label htmlFor="practiceCourse" className="block text-sm font-medium text-slate-700 mb-2">
                  Курс
                </label>
                <input
                  id="practiceCourse"
                  name="practiceCourse"
                  type="number"
                  min={1}
                  max={4}
                  value={formData.practiceCourse}
                  onChange={handleChange}
                  className="input"
                  placeholder="1–4"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="practiceType" className="block text-sm font-medium text-slate-700 mb-2">
                  Тип практики
                </label>
                <select
                  id="practiceType"
                  name="practiceType"
                  value={formData.practiceType}
                  onChange={handleChange}
                  className="input"
                >
                  {Object.entries(PRACTICE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                  Телефон <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input"
                  placeholder="+7 …"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="practiceStartDate" className="block text-sm font-medium text-slate-700 mb-2">
                  Дата начала
                </label>
                <input
                  id="practiceStartDate"
                  name="practiceStartDate"
                  type="date"
                  value={formData.practiceStartDate}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="practiceEndDate" className="block text-sm font-medium text-slate-700 mb-2">
                  Дата окончания
                </label>
                <input
                  id="practiceEndDate"
                  name="practiceEndDate"
                  type="date"
                  value={formData.practiceEndDate}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            {profile.student.supervisor && (
              <div className="grid grid-cols-1 gap-3">
                <InfoRow
                  icon={<UserIcon className="w-4 h-4" />}
                  label="Руководитель практики"
                  value={profile.student.supervisor}
                />
              </div>
            )}

            <p className="text-xs text-slate-500">
              Статус практики и руководителя назначает администратор. Телефон и email (в блоке «Учётные данные» ниже)
              обязательны; email входа сохраняется и в карточку практики.
            </p>
          </div>
        )}

        {isStudent && !profile?.student && (
          <div className="card text-sm text-slate-600">
            У вас пока не привязана запись о практике. Подайте заявку через раздел «Подать заявку».
          </div>
        )}

        <div className="card space-y-5">
          <h3 className="text-base font-semibold text-slate-900">Учётные данные</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                Имя пользователя
              </label>
              <input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="input"
                required
                minLength={3}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email <span className="text-red-500">*</span>
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
          </div>

          {isTeacher && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">
                  Имя
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">
                  Фамилия
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>
              <div>
                <label htmlFor="middleName" className="block text-sm font-medium text-slate-700 mb-2">
                  Отчество
                </label>
                <input
                  id="middleName"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="teacherPhone" className="block text-sm font-medium text-slate-700 mb-2">
                  Телефон <span className="text-red-500">*</span>
                </label>
                <input
                  id="teacherPhone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>
            </div>
          )}

        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-900">Смена пароля</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Новый пароль
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="input pr-10"
                  minLength={6}
                  placeholder="Не менее 6 символов"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                Подтвердите пароль
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input"
                minLength={6}
                placeholder="Повторите новый пароль"
                autoComplete="new-password"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Оставьте поле пустым, чтобы не менять пароль.
          </p>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary inline-flex items-center gap-2" disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
        </div>
      </form>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
      <div className="mt-0.5 text-slate-500">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900 break-words">{value}</p>
      </div>
    </div>
  );
}

export default Profile;
