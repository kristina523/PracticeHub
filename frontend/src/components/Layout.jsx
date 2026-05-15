import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuthStore } from '../store/authStore';
import { useEffect } from 'react';

function Layout() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      checkAuth();
    }
  }, [checkAuth, isAuthenticated]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex max-w-[1700px] mx-auto w-full">
        <Sidebar />
        <main className="flex-1 p-5 md:p-7 lg:p-8 min-h-[calc(100vh-76px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;

