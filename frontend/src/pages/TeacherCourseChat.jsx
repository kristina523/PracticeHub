import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Send, Loader2, MessageSquare, Users, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

function TeacherCourseChat() {
  const { courseId, enrollmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [enrollments, setEnrollments] = useState([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [course, setCourse] = useState(null);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchCourseAndEnrollments();
    
    // Обновляем сообщения каждые 3 секунды, если выбран чат
    if (selectedEnrollment) {
      intervalRef.current = setInterval(() => {
        fetchMessages(selectedEnrollment.id);
      }, 3000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [courseId, selectedEnrollment]);

  // Если передан enrollmentId, открываем этот чат
  useEffect(() => {
    if (enrollmentId && enrollments.length > 0) {
      const enrollment = enrollments.find(e => e.id === enrollmentId);
      if (enrollment) {
        setSelectedEnrollment(enrollment);
        fetchMessages(enrollment.id);
      }
    }
  }, [enrollmentId, enrollments]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchCourseAndEnrollments = async () => {
    try {
      const courseRes = await api.get(`/courses/${courseId}`);
      setCourse(courseRes.data);
      
      // Используем enrollments из курса
      const courseEnrollments = (courseRes.data.enrollments || []).map(enrollment => ({
        ...enrollment,
        course: {
          id: courseRes.data.id,
          title: courseRes.data.title,
          direction: courseRes.data.direction
        }
      }));
      setEnrollments(courseEnrollments);
      
      // Если есть enrollmentId, открываем этот чат
      if (enrollmentId && courseEnrollments.length > 0) {
        const enrollment = courseEnrollments.find(e => e.id === enrollmentId);
        if (enrollment) {
          setSelectedEnrollment(enrollment);
          await fetchMessages(enrollment.id);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки курса и студентов:', error);
      alert('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (enrollmentId) => {
    if (!enrollmentId) return;
    
    try {
      const response = await api.get(`/course-chat/enrollment/${enrollmentId}`);
      setMessages(response.data.messages || []);
      
      // Отмечаем сообщения как прочитанные
      await api.patch(`/course-chat/enrollment/${enrollmentId}/read`);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  const handleSelectEnrollment = async (enrollment) => {
    setSelectedEnrollment(enrollment);
    navigate(`/teacher/courses/${courseId}/chat/${enrollment.id}`);
    await fetchMessages(enrollment.id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !selectedEnrollment) return;

    setSending(true);
    try {
      await api.post(`/course-chat/enrollment/${selectedEnrollment.id}`, {
        message: newMessage.trim()
      });
      setNewMessage('');
      // Обновляем сообщения сразу после отправки
      setTimeout(() => {
        fetchMessages(selectedEnrollment.id);
      }, 100);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
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

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Курс не найден</p>
        <Link to="/teacher/courses" className="btn btn-primary mt-4">
          Вернуться к курсам
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Список студентов */}
      <div className="w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Link
              to={`/teacher/courses/${courseId}`}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h3 className="font-bold text-gray-900 dark:text-white">Студенты</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {course.title}
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {enrollments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Нет студентов на курсе</p>
            </div>
          ) : (
            <div className="space-y-2">
              {enrollments.map((enrollment) => {
                const isSelected = selectedEnrollment?.id === enrollment.id;
                const lastMessage = enrollment.messages?.[0];
                const unreadCount = enrollment._count?.messages || 0;
                
                return (
                  <button
                    key={enrollment.id}
                    onClick={() => handleSelectEnrollment(enrollment)}
                    className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      }`}>
                        {(enrollment.studentUser?.username || enrollment.studentUser?.email || 'С').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${
                          isSelected ? 'text-white' : 'text-gray-900 dark:text-white'
                        }`}>
                          {enrollment.studentUser?.username || enrollment.studentUser?.email || 'Студент'}
                        </p>
                        {lastMessage && (
                          <p className={`text-xs truncate mt-1 ${
                            isSelected ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {lastMessage.message.substring(0, 40)}
                            {lastMessage.message.length > 40 ? '...' : ''}
                          </p>
                        )}
                      </div>
                      {unreadCount > 0 && !isSelected && (
                        <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Область чата */}
      <div className="flex-1 flex flex-col">
        {selectedEnrollment ? (
          <>
            {/* Заголовок чата */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {(selectedEnrollment.studentUser?.username || selectedEnrollment.studentUser?.email || 'С').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {selectedEnrollment.studentUser?.username || selectedEnrollment.studentUser?.email || 'Студент'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedEnrollment.course?.title}
                  </p>
                </div>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
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
                    const isTeacher = message.senderType === 'TEACHER';

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isTeacher ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                            isTeacher
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.message}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isTeacher
                                ? 'text-blue-100'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {format(new Date(message.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
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
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </>
        ) : (
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                Выберите студента для начала общения
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherCourseChat;

