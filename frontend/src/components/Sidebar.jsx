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
  Video
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
  ];

  const navigation = role === 'admin' 
    ? adminNavigation 
    : role === 'teacher' 
    ? teacherNavigation 
    : studentNavigation;

  return (
    <aside className={`bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] transition-all duration-300 ${isExpanded ? 'w-64' : 'w-20'}`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {isExpanded && (
          <h2 className="text-xl font-semibold text-gray-900">
            PracticeHub
          </h2>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-600" />
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={!isExpanded ? item.name : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isExpanded && (
                    <span className="text-sm">{item.name}</span>
                  )}
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

