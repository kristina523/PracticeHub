import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Loader2, MessageSquare, BookOpen, User } from 'lucide-react';
import { Link } from 'react-router-dom';

function StudentChats() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/course-chat/student');
      setEnrollments(response.data.enrollments || []);
    } catch (error) {
      console.error('Ошибка загрузки чатов студента:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Чаты с преподавателями
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Все ваши чаты по курсам, на которые вы записаны.
          </p>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="card text-center py-12">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            У вас пока нет активных чатов. Запишитесь на курс, чтобы начать общение с преподавателем.
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {enrollments.map((enrollment) => {
            const lastMessage = enrollment.messages?.[0];
            const teacher = enrollment.course?.teacher;

            return (
              <Link
                key={enrollment.id}
                to={`/student/courses/${enrollment.courseId}/chat`}
                className="flex items-center justify-between gap-4 py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-300" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {enrollment.course?.title || 'Курс'}
                    </div>
                    {teacher && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <User className="w-3 h-3" />
                        <span>
                          {[teacher.lastName, teacher.firstName]
                            .filter(Boolean)
                            .join(' ')}
                        </span>
                      </div>
                    )}
                    {lastMessage && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {lastMessage.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <MessageSquare className="w-3 h-3" />
                    {enrollment._count?.messages ?? 0}
                  </span>
                  {lastMessage && (
                    <span className="text-[11px] text-gray-400">
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

export default StudentChats;


