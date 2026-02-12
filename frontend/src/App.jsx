import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import RegisterTeacher from './pages/RegisterTeacher';
import RegisterAdmin from './pages/RegisterAdmin';
import RegisterStudent from './pages/RegisterStudent';
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

function PrivateRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, initAuth, user } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (user.role === 'teacher') {
      return <Navigate to="/teacher" />;
    } else if (user.role === 'student') {
      return <Navigate to="/student" />;
    } else {
      return <Navigate to="/" />;
    }
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register/teacher" element={<RegisterTeacher />} />
      <Route path="/register/admin" element={<RegisterAdmin />} />
      <Route path="/register/student" element={<RegisterStudent />} />
      
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
        <Route path="students/:id/edit" element={<StudentForm />} />
        <Route path="teachers" element={<AdminTeachers />} />
        <Route path="practices" element={<AdminPractices />} />
        <Route path="webinars" element={<AdminWebinars />} />
        <Route path="courses" element={<Courses />} />
        <Route path="institutions" element={<Institutions />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="reports" element={<Reports />} />
        <Route path="applications" element={<Applications />} />
        <Route path="notifications" element={<Notifications />} />
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
      </Route>
    </Routes>
  );
}

export default App;

