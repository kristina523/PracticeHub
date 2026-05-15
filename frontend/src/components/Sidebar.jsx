import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  School, 
  Calendar, 
  BarChart3,
  FileText,
  Megaphone,
  ClipboardList,
  BookOpen,
  Menu,
  MessageSquare,
  Video,
  User as UserIcon
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useState } from 'react';

function Sidebar() {
  const { user } = useAuthStore();
  const location = useLocation();
  const role = user?.role || 'admin';
  const [isExpanded, setIsExpanded] = useState(true);

  // Навигация для администратора
  const adminNavigation = [
    { name: 'Главная страница', href: '/', icon: LayoutDashboard },
    { name: 'Календарь', href: '/calendar', icon: Calendar },
    { name: 'Практиканты', href: '/students', icon: Users },
    { name: 'Преподаватели', href: '/teachers', icon: Users },
    { name: 'Курсы', href: '/courses', icon: BookOpen },
    { name: 'Практики и стажировки', href: '/practices', icon: ClipboardList },
    { name: 'Вебинары', href: '/webinars', icon: Video },
    { name: 'Заявки', href: '/applications', icon: FileText },
    { name: 'Учебные заведения', href: '/institutions', icon: School },
    { name: 'Отчеты', href: '/reports', icon: BarChart3 },
    { name: 'Уведомления', href: '/notifications', icon: Megaphone },
  ];

  // Навигация для преподавателя
  const teacherNavigation = [
    { name: 'Главная страница', href: '/teacher', icon: LayoutDashboard },
    { name: 'Календарь', href: '/teacher/calendar', icon: Calendar },
    { name: 'Курсы', href: '/teacher/courses', icon: BookOpen },
    { name: 'Чаты', href: '/teacher/chats', icon: MessageSquare },
    { name: 'Практиканты', href: '/teacher/students', icon: Users },
    { name: 'Заявки', href: '/teacher/applications', icon: FileText },
    { name: 'Уведомления', href: '/teacher/notifications', icon: Megaphone },
  ];

  // Навигация для студента
  const studentNavigation = [
    { name: 'Главная страница', href: '/student', icon: LayoutDashboard },
    { name: 'Календарь', href: '/student/calendar', icon: Calendar },
    { name: 'Курсы', href: '/student/courses', icon: BookOpen },
    { name: 'Вебинары', href: '/student/webinars', icon: Video },
    { name: 'Чаты', href: '/student/chats', icon: MessageSquare },
    { name: 'Список заданий', href: '/student/tasks', icon: ClipboardList },
    { name: 'Подать заявку', href: '/student/application', icon: FileText },
    { name: 'Профиль', href: '/student/profile', icon: UserIcon },
  ];

  const navigation = role === 'admin' 
    ? adminNavigation 
    : role === 'teacher' 
    ? teacherNavigation 
    : studentNavigation;

  return (
    <aside className={`min-h-[calc(100vh-76px)] transition-all duration-300 ${isExpanded ? 'w-72' : 'w-24'} p-3 md:p-4`}>
      <div className="sticky top-[88px] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        {isExpanded && (
          <h2 className="text-base font-semibold text-slate-900">
            Навигация
          </h2>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      <nav className="p-2">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 font-semibold border border-blue-100'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  title={!isExpanded ? item.name : ''}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                  {isExpanded && (
                    <span className="text-sm">{item.name}</span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      </div>
    </aside>
  );
}

export default Sidebar;

