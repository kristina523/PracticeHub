import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { ToastProvider, ConfirmProvider } from './components/Toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import RegisterTeacher from './pages/RegisterTeacher';
import RegisterStudent from './pages/RegisterStudent';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentChats from './pages/StudentChats';
import AdminTeachers from './pages/AdminTeachers';
import AdminPractices from './pages/AdminPractices';
import AdminWebinars from './pages/AdminWebinars';
import StudentWebinars from './pages/StudentWebinars';
import StudentCourses from './pages/StudentCourses';
import StudentCourseChat from './pages/StudentCourseChat';
import StudentTasks from './pages/StudentTasks';
import StudentTaskDetail from './pages/StudentTaskDetail';
import ApplicationForm from './pages/ApplicationForm';
import Students from './pages/Students';
import StudentForm from './pages/StudentForm';
import StudentDetail from './pages/StudentDetail';
import Institutions from './pages/Institutions';
import Calendar from './pages/Calendar';
import Reports from './pages/Reports';
import Applications from './pages/Applications';
import Notifications from './pages/Notifications';
import Tasks from './pages/Tasks';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import CourseMaterials from './pages/CourseMaterials';
import TeacherCourseChat from './pages/TeacherCourseChat';
import TeacherChats from './pages/TeacherChats';
import Profile from './pages/Profile';

function PrivateRoute({ children, allowedRoles = null }) {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [persistReady, setPersistReady] = useState(() => useAuthStore.persist.hasHydrated());
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setPersistReady(true));
    if (useAuthStore.persist.hasHydrated()) setPersistReady(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    let cancelled = false;
    (async () => {
      const t = useAuthStore.getState().token;
      if (!t) {
        if (!cancelled) setSessionChecked(true);
        return;
      }
      await useAuthStore.getState().checkAuth();
      if (!cancelled) setSessionChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [persistReady]);

  if (!persistReady || !sessionChecked) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-500 text-sm">
        Загрузка…
      </div>
    );
  }

  if (!token || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (user.role === 'teacher') {
      return <Navigate to="/teacher" replace />;
    } else if (user.role === 'student') {
      return <Navigate to="/student" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppRoutes />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register/teacher" element={<RegisterTeacher />} />
      <Route path="/register/student" element={<RegisterStudent />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Админские маршруты */}
      <Route
        path="/"
        element={
          <PrivateRoute allowedRoles={['admin']}>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/new" element={<StudentForm />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="teachers" element={<AdminTeachers />} />
        <Route path="practices" element={<AdminPractices />} />
        <Route path="webinars" element={<AdminWebinars />} />
        <Route path="courses" element={<Courses />} />
        <Route path="institutions" element={<Institutions />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="reports" element={<Reports />} />
        <Route path="applications" element={<Applications />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Маршруты преподавателя */}
      <Route
        path="/teacher"
        element={
          <PrivateRoute allowedRoles={['teacher']}>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:courseId" element={<CourseDetail />} />
        <Route path="courses/:courseId/materials" element={<CourseMaterials />} />
        <Route path="courses/:courseId/chat" element={<TeacherCourseChat />} />
        <Route path="courses/:courseId/chat/:enrollmentId" element={<TeacherCourseChat />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="applications" element={<Applications />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="chats" element={<TeacherChats />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Маршруты студента */}
      <Route
        path="/student"
        element={
          <PrivateRoute allowedRoles={['student']}>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="courses" element={<StudentCourses />} />
        <Route path="courses/:courseId/chat" element={<StudentCourseChat />} />
        <Route path="courses/:courseId/tasks" element={<StudentTasks />} />
        <Route path="chats" element={<StudentChats />} />
        <Route path="tasks" element={<StudentTasks />} />
        <Route path="tasks/:taskId" element={<StudentTaskDetail />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="webinars" element={<StudentWebinars />} />
        <Route path="application" element={<ApplicationForm />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

export default App;

