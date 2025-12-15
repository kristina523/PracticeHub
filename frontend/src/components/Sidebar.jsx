import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  School, 
  Calendar, 
  BarChart3,
  FileText,
  Megaphone
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

function Sidebar() {
  const { user } = useAuthStore();
  const location = useLocation();
  const role = user?.role || 'admin';

  // Навигация для администратора
  const adminNavigation = [
    { name: 'Дашборд', href: '/', icon: LayoutDashboard },
    { name: 'Практиканты', href: '/students', icon: Users },
    { name: 'Заявки', href: '/applications', icon: FileText },
    { name: 'Учебные заведения', href: '/institutions', icon: School },
    { name: 'Календарь', href: '/calendar', icon: Calendar },
    { name: 'Отчеты', href: '/reports', icon: BarChart3 },
    { name: 'Уведомления', href: '/notifications', icon: Megaphone },
  ];

  // Навигация для преподавателя
  const teacherNavigation = [
    { name: 'Дашборд', href: '/teacher', icon: LayoutDashboard },
    { name: 'Практиканты', href: '/teacher/students', icon: Users },
    { name: 'Заявки', href: '/teacher/applications', icon: FileText },
    { name: 'Календарь', href: '/teacher/calendar', icon: Calendar },
    { name: 'Уведомления', href: '/teacher/notifications', icon: Megaphone },
  ];

  // Навигация для студента
  const studentNavigation = [
    { name: 'Моя практика', href: '/student', icon: LayoutDashboard },
    { name: 'Подать заявку', href: '/student/application', icon: FileText },
  ];

  const navigation = role === 'admin' 
    ? adminNavigation 
    : role === 'teacher' 
    ? teacherNavigation 
    : studentNavigation;

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-4rem)]">
      <nav className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;

