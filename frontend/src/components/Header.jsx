import { useAuthStore } from '../store/authStore';
import { LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';

function Header() {
  const { user, logout } = useAuthStore();

  const getUserDisplayName = () => {
    if (user?.role === 'teacher') {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
    }
    return user?.username || 'Пользователь';
  };

  const getRoleLabel = () => {
    if (user?.role === 'admin') return 'Админ';
    if (user?.role === 'teacher') return 'Преподаватель';
    return 'Студент';
  };

  const getProfilePath = () => {
    if (user?.role === 'teacher') return '/teacher/profile';
    if (user?.role === 'student') return '/student/profile';
    return '/profile';
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md h-[76px]">
      <div className="max-w-[1700px] mx-auto h-full px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-sky-400 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">PH</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 leading-none">PracticeHub</p>
            <p className="text-xs text-slate-500 mt-1">Система управления практикой</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <>
              <Link
                to={getProfilePath()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center shadow-sm">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{getUserDisplayName()}</p>
                  <p className="text-xs text-slate-500">{getRoleLabel()}</p>
                </div>
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Выход
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;

