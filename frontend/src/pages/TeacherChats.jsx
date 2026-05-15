import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Loader2, MessageSquare, BookOpen, User } from 'lucide-react';
import { Link } from 'react-router-dom';

function displayStudentName(studentUser) {
  if (!studentUser) return 'Студент';
  const u = studentUser.username?.trim();
  const e = studentUser.email?.trim();
  if (u && !u.includes('@')) return u;
  return e || u || 'Студент';
}

function TeacherChats() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/course-chat/teacher');
      setEnrollments(response.data.enrollments || []);
    } catch (error) {
      console.error('Ошибка загрузки чатов преподавателя:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Чаты</h1>
          <p className="page-subtitle">
            Переписки со студентами по одобренным записям на ваши курсы
          </p>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="card text-center py-12">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">
            Пока нет чатов. Когда студенты будут одобрены на курс, они появятся здесь и в карточке курса.
          </p>
          <Link to="/teacher/courses" className="btn btn-primary mt-6 inline-flex">
            К курсам
          </Link>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {enrollments.map((enrollment) => {
            const lastMessage = enrollment.messages?.[0];
            const courseId = enrollment.course?.id || enrollment.courseId;
            const chatUrl = `/teacher/courses/${courseId}/chat/${enrollment.id}`;

            return (
              <Link
                key={enrollment.id}
                to={chatUrl}
                className="flex items-center justify-between gap-4 py-4 px-2 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {enrollment.course?.title || 'Курс'}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{displayStudentName(enrollment.studentUser)}</span>
                    </div>
                    {lastMessage && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                        {lastMessage.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                    <MessageSquare className="w-3 h-3" />
                    {enrollment._count?.messages ?? 0}
                  </span>
                  {lastMessage && (
                    <span className="text-[11px] text-slate-400">
                      {new Date(lastMessage.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TeacherChats;
