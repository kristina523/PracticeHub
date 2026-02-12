import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Send, Loader2, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

function StudentCourseChat() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [enrollment, setEnrollment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchChatData();
    
    // Обновляем сообщения каждые 3 секунды
    intervalRef.current = setInterval(() => {
      if (enrollment?.id) {
        fetchMessages();
      }
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [courseId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchChatData = async () => {
    try {
      // Получаем enrollment для этого курса
      const enrollmentsRes = await api.get('/course-enrollments');
      const courses = enrollmentsRes.data.courses || [];
      const courseData = courses.find(c => c.id === courseId);
      const enrollmentData = courseData?.enrollment;

      if (!enrollmentData) {
        alert('Вы не записаны на этот курс или заявка не одобрена');
        navigate('/student/courses');
        return;
      }

      setEnrollment(enrollmentData);
      await fetchMessages(enrollmentData.id);
    } catch (error) {
      console.error('Ошибка загрузки чата:', error);
      alert('Ошибка загрузки чата');
      setLoading(false);
    }
  };

  const fetchMessages = async (enrollmentId) => {
    if (!enrollmentId) return;
    
    try {
      const response = await api.get(`/course-chat/enrollment/${enrollmentId}`);
      setMessages(response.data.messages || []);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await api.post(`/course-chat/enrollment/${enrollment.id}`, {
        message: newMessage.trim()
      });
      setNewMessage('');
      await fetchMessages(enrollment.id);
      
      // Отмечаем сообщения как прочитанные
      await api.patch(`/course-chat/enrollment/${enrollment.id}/read`);
    } catch (error) {
      alert('Ошибка отправки сообщения: ' + (error.response?.data?.message || error.message));
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Запись на курс не найдена</p>
        <Link to="/student/courses" className="btn btn-primary mt-4">
          Вернуться к курсам
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/student/courses"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Чат по курсу
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {enrollment.course?.title}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 card overflow-hidden flex flex-col">
        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Пока нет сообщений. Начните общение!
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isStudent = message.senderType === 'STUDENT';
              const isCurrentUser = isStudent && message.senderId === user?.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.message}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isCurrentUser
                          ? 'text-blue-100'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {new Date(message.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Форма отправки */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Введите сообщение..."
              className="flex-1 input"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Отправить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StudentCourseChat;

