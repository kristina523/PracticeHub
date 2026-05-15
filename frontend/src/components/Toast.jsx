import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X, AlertCircle, HelpCircle, Trash2 } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANT_STYLES = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    accent: 'bg-emerald-500',
    title: 'Готово'
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-rose-500',
    accent: 'bg-rose-500',
    title: 'Ошибка'
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    accent: 'bg-amber-500',
    title: 'Внимание'
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-500',
    accent: 'bg-blue-500',
    title: 'PracticeHub'
  }
};

const DEFAULT_DURATION = 4200;

/** Эвристика, чтобы старые alert/`notify(...)` строки получили правильный цвет автоматически. */
function detectVariant(rawMessage) {
  const msg = String(rawMessage || '').toLowerCase();
  if (/^❌|ошибк|не удал|fail|invalid|error|неверн|forbidden|нельзя|просрочен/i.test(msg)) {
    return 'error';
  }
  if (/^⚠️|внимани|warning|осторож|пожалуйста/i.test(msg)) {
    return 'warning';
  }
  if (/^✅|успешн|создан|обновлен|обновлён|одобрен|подтверж|сохранен|сохранён|отправлен/i.test(msg)) {
    return 'success';
  }
  return 'info';
}

function cleanMessage(raw) {
  return String(raw ?? '')
    .replace(/^[✅❌⚠️ℹ️🎉🔔💬📋📅📚🏫👤📝🔐🆔]\s*/u, '')
    .trim();
}

let externalPush = null;

export function notify(message, options = {}) {
  if (typeof externalPush !== 'function') {
    return;
  }
  const text = typeof message === 'string' ? message : String(message);
  externalPush({
    variant: options.variant || detectVariant(text),
    title: options.title,
    message: cleanMessage(text),
    duration: options.duration
  });
}

notify.success = (message, options = {}) =>
  notify(message, { ...options, variant: 'success' });
notify.error = (message, options = {}) =>
  notify(message, { ...options, variant: 'error' });
notify.warning = (message, options = {}) =>
  notify(message, { ...options, variant: 'warning' });
notify.info = (message, options = {}) =>
  notify(message, { ...options, variant: 'info' });

function ToastItem({ toast, onClose }) {
  const variant = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info;
  const Icon = variant.icon;
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose(toast.id), 220);
  }, [onClose, toast.id]);

  useEffect(() => {
    const timer = setTimeout(handleClose, toast.duration ?? DEFAULT_DURATION);
    return () => clearTimeout(timer);
  }, [handleClose, toast.duration]);

  return (
    <div
      role="status"
      className={[
        'pointer-events-auto relative w-full sm:w-[380px] overflow-hidden',
        'rounded-2xl border border-slate-200/70 bg-white/95 backdrop-blur-md shadow-xl shadow-slate-900/5',
        'transition-all duration-200 ease-out',
        closing
          ? 'opacity-0 translate-x-6'
          : 'opacity-100 translate-x-0 animate-[toastIn_220ms_ease-out]'
      ].join(' ')}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${variant.accent}`} />
      <div className="flex items-start gap-3 pl-5 pr-3 py-3.5">
        <span className={`mt-0.5 ${variant.iconClass}`}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-tight">
            {toast.title || variant.title}
          </p>
          {toast.message ? (
            <p className="mt-0.5 text-sm text-slate-600 leading-snug break-words">
              {toast.message}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="ml-1 -mr-1 mt-0.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ToastViewport({ toasts, onClose }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col items-end gap-3 sm:max-w-[400px]">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>,
    document.body
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((payload) => {
    idRef.current += 1;
    const next = {
      id: idRef.current,
      variant: payload?.variant || 'info',
      title: payload?.title,
      message: payload?.message || '',
      duration: payload?.duration
    };
    setToasts((prev) => [...prev, next]);
    return next.id;
  }, []);

  useEffect(() => {
    externalPush = push;

    // Глобальный перехват: window.alert(...) теперь показывает наш toast
    const originalAlert = window.alert;
    window.alert = (msg) => {
      push({ variant: detectVariant(msg), message: cleanMessage(msg) });
    };

    return () => {
      window.alert = originalAlert;
      externalPush = null;
    };
  }, [push]);

  const value = useMemo(
    () => ({
      notify: (message, options = {}) => {
        const text = typeof message === 'string' ? message : String(message);
        return push({
          variant: options.variant || detectVariant(text),
          title: options.title,
          message: cleanMessage(text),
          duration: options.duration
        });
      },
      dismiss: removeToast
    }),
    [push, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { notify, dismiss: () => {} };
  }
  return ctx;
}

/* ────────────────────────  Confirm-диалог  ──────────────────────── */

let externalConfirm = null;

/**
 * Стилизованный confirm с промисом.
 * Возвращает Promise<boolean>: true — пользователь подтвердил, false — отменил.
 * Использование: `if (!(await confirmDialog('Удалить?'))) return;`
 */
export function confirmDialog(message, options = {}) {
  if (typeof externalConfirm !== 'function') {
    // Фоллбэк на нативный confirm, если провайдер ещё не подмонтирован
    if (typeof window !== 'undefined' && typeof window.__nativeConfirm === 'function') {
      return Promise.resolve(window.__nativeConfirm(message));
    }
    return Promise.resolve(true);
  }
  return externalConfirm({ message, ...options });
}

function detectConfirmVariant(message) {
  const msg = String(message || '').toLowerCase();
  if (/удал|delete|отмен/i.test(msg)) return 'danger';
  if (/отклон/i.test(msg)) return 'warning';
  return 'default';
}

const CONFIRM_VARIANT_STYLES = {
  danger: {
    icon: Trash2,
    iconWrap: 'bg-rose-100 text-rose-600',
    confirmBtn: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300'
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-100 text-amber-600',
    confirmBtn: 'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-300'
  },
  default: {
    icon: HelpCircle,
    iconWrap: 'bg-blue-100 text-blue-600',
    confirmBtn: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-300'
  }
};

function ConfirmModal({ open, payload, onResolve }) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onResolve(false);
      else if (e.key === 'Enter') onResolve(true);
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => cancelBtnRef.current?.focus(), 30);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onResolve]);

  if (!open || typeof document === 'undefined') return null;

  const variantKey = payload?.variant || detectConfirmVariant(payload?.message);
  const variant = CONFIRM_VARIANT_STYLES[variantKey] || CONFIRM_VARIANT_STYLES.default;
  const Icon = variant.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-4 animate-[confirmOverlayIn_180ms_ease-out]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={() => onResolve(false)}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-slate-900/20 border border-slate-200/70 animate-[confirmIn_200ms_cubic-bezier(0.2,1.2,0.4,1)] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <span
            className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl ${variant.iconWrap} flex-shrink-0`}
          >
            <Icon className="w-5 h-5" strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 leading-tight">
              {payload?.title || 'Подтвердите действие'}
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              {payload?.message || 'Вы уверены?'}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 pb-6 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={() => onResolve(false)}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            {payload?.cancelText || 'Отмена'}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors focus:outline-none focus-visible:ring-2 ${variant.confirmBtn}`}
          >
            {payload?.confirmText || 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, payload: null, resolver: null });

  const open = useCallback((payload) => {
    return new Promise((resolve) => {
      setState({ open: true, payload, resolver: resolve });
    });
  }, []);

  const resolve = useCallback(
    (value) => {
      state.resolver?.(value);
      setState({ open: false, payload: null, resolver: null });
    },
    [state.resolver]
  );

  useEffect(() => {
    externalConfirm = open;
    if (typeof window !== 'undefined') {
      window.__nativeConfirm = window.confirm.bind(window);
      window.confirm = (msg) => {
        // Совместимость со старым синхронным API: возвращаем true чтобы код «продолжил»,
        // а реальное подтверждение пользователя проходит через Promise.
        // В обновлённых местах используется `await confirmDialog(...)`, и поведение корректное.
        // Здесь же возвращаем результат нативного диалога, чтобы не сломать чужой код,
        // использующий чистый `window.confirm(...)` в синхронном контексте.
        return window.__nativeConfirm(msg);
      };
    }
    return () => {
      externalConfirm = null;
      if (typeof window !== 'undefined' && typeof window.__nativeConfirm === 'function') {
        window.confirm = window.__nativeConfirm;
      }
    };
  }, [open]);

  return (
    <>
      {children}
      <ConfirmModal open={state.open} payload={state.payload} onResolve={resolve} />
    </>
  );
}

