import { useAuthStore } from '../store/authStore';
import { LogOut, Plus, Grid3x3, User } from 'lucide-react';

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

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-xl font-medium text-gray-900">Класс</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Plus className="w-5 h-5 text-gray-600" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Grid3x3 className="w-5 h-5 text-gray-600" />
        </button>
        {user && (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
                <p className="text-xs text-gray-500">{getRoleLabel()}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Выход
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;

