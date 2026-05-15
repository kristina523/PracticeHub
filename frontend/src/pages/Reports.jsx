import { useRef, useState, useEffect } from 'react';
import api from '../utils/api';
import { Loader2, Download, Upload } from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const practiceTypeLabels = {
  EDUCATIONAL: 'Учебная',
  PRODUCTION: 'Производственная',
  INTERNSHIP: 'Стажировка'
};

const statusLabels = {
  PENDING: 'Ожидает',
  ACTIVE: 'Активна',
  COMPLETED: 'Завершена'
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

// Поддержка разных форматов экспорта vfs в сборках pdfmake
const resolvedVfs =
  pdfFonts?.pdfMake?.vfs ||
  pdfFonts?.vfs ||
  pdfFonts;

if (resolvedVfs) {
  pdfMake.vfs = resolvedVfs;
}

function Reports() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    setActionError('');
    setActionMessage('');
    fileInputRef.current?.click();
  };

  const normalizeDate = (value, fallbackDate) => {
    if (!value) return fallbackDate.toISOString();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallbackDate.toISOString();
    return date.toISOString();
  };

  const pickValue = (item, keys) => {
    const normalizedEntries = Object.entries(item || {}).map(([key, value]) => [
      String(key)
        .toLowerCase()
        .replace(/\uFEFF/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ''),
      value
    ]);

    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') {
        return item[key];
      }

      const normalizedKey = String(key)
        .toLowerCase()
        .replace(/\uFEFF/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '');
      const match = normalizedEntries.find(([entryKey, value]) => entryKey === normalizedKey && value !== undefined && value !== null && String(value).trim() !== '');
      if (match) {
        return match[1];
      }
    }

    // Fallback: частичное совпадение ключей (например "studentFirstName", "имястудента")
    const normalizedCandidates = keys.map((key) =>
      String(key)
        .toLowerCase()
        .replace(/\uFEFF/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '')
    );
    const fuzzyMatch = normalizedEntries.find(([entryKey, value]) => {
      if (value === undefined || value === null || String(value).trim() === '') return false;
      return normalizedCandidates.some((candidate) => entryKey.includes(candidate) || candidate.includes(entryKey));
    });
    if (fuzzyMatch) {
      return fuzzyMatch[1];
    }

    return '';
  };

  const parseFullName = (item) => {
    const fullNameRaw = pickValue(item, [
      'fullName',
      'full_name',
      'fio',
      'ФИО',
      'фио',
      'studentName',
      'studentFullName',
      'name'
    ]);
    const fullName = String(fullNameRaw || '').trim();
    if (!fullName) {
      return { firstName: '', lastName: '', middleName: '' };
    }
    const parts = fullName.split(/\s+/).filter(Boolean);
    return {
      lastName: parts[0] || '',
      firstName: parts[1] || '',
      middleName: parts.slice(2).join(' ')
    };
  };

  const normalizePracticeType = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    if (['EDUCATIONAL', 'ПРАКТИКА УЧЕБНАЯ', 'УЧЕБНАЯ', 'УЧЕБНАЯ ПРАКТИКА'].includes(raw)) {
      return 'EDUCATIONAL';
    }
    if (['PRODUCTION', 'ПРОИЗВОДСТВЕННАЯ', 'ПРОИЗВОДСТВЕННАЯ ПРАКТИКА'].includes(raw)) {
      return 'PRODUCTION';
    }
    if (['INTERNSHIP', 'СТАЖИРОВКА'].includes(raw)) {
      return 'INTERNSHIP';
    }
    return 'EDUCATIONAL';
  };

  const normalizeStatus = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    if (['PENDING', 'ОЖИДАЕТ', 'ОЖИДАНИЕ'].includes(raw)) return 'PENDING';
    if (['ACTIVE', 'АКТИВНА', 'АКТИВНЫЙ'].includes(raw)) return 'ACTIVE';
    if (['COMPLETED', 'ЗАВЕРШЕНА', 'ЗАВЕРШЕНО'].includes(raw)) return 'COMPLETED';
    return 'PENDING';
  };

  const buildImportPayload = (item) => {
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const fullName = parseFullName(item);
    const firstName = String(
      pickValue(item, ['firstName', 'first_name', 'first name', 'name', 'Имя', 'имя']) || fullName.firstName || ''
    ).trim();
    const lastName = String(
      pickValue(item, ['lastName', 'last_name', 'last name', 'surname', 'Фамилия', 'фамилия']) || fullName.lastName || ''
    ).trim();
    const middleName = String(
      pickValue(item, ['middleName', 'middle_name', 'patronymic', 'Отчество', 'отчество']) || fullName.middleName || ''
    ).trim();
    const institutionName = String(
      pickValue(item, ['institutionName', 'institution_name', 'institution', 'Учебное заведение', 'Организация', 'institutionTitle'])
    ).trim();
    const practiceType = normalizePracticeType(
      pickValue(item, ['practiceType', 'practice_type', 'Тип практики', 'типПрактики'])
    );
    const status = normalizeStatus(pickValue(item, ['status', 'Статус', 'studentStatus']));
    const courseValue = pickValue(item, ['course', 'Курс', 'courseNumber']);

    const startDateValue = normalizeDate(pickValue(item, ['startDate', 'start_date', 'Дата начала']), now);
    const endDateValue = normalizeDate(pickValue(item, ['endDate', 'end_date', 'Дата окончания']), nextMonth);

    const startDateObj = new Date(startDateValue);
    let endDateObj = new Date(endDateValue);
    if (startDateObj >= endDateObj) {
      endDateObj = new Date(startDateObj.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    return {
      firstName,
      lastName,
      middleName,
      practiceType,
      institutionName,
      course: Number.isInteger(courseValue) ? courseValue : parseInt(courseValue, 10) || 1,
      email: pickValue(item, ['email', 'Email', 'Почта']) ? String(pickValue(item, ['email', 'Email', 'Почта'])).trim() : undefined,
      phone: pickValue(item, ['phone', 'Телефон']) ? String(pickValue(item, ['phone', 'Телефон'])).trim() : undefined,
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString(),
      status,
      supervisor: pickValue(item, ['supervisor', 'Руководитель']) ? String(pickValue(item, ['supervisor', 'Руководитель'])).trim() : undefined,
      notes: pickValue(item, ['notes', 'Комментарий', 'Примечание']) ? String(pickValue(item, ['notes', 'Комментарий', 'Примечание'])).trim() : undefined
    };
  };

  const validateImportItem = (item) => {
    if (!item || typeof item !== 'object') return 'Некорректная запись';
    const payload = buildImportPayload(item);
    if (!payload.firstName) return 'Не заполнено поле Имя (firstName)';
    if (!payload.lastName) return 'Не заполнено поле Фамилия (lastName)';
    if (!payload.institutionName) return 'Не заполнено поле Учебное заведение (institutionName)';
    return null;
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setActionError('');
    setActionMessage('');

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const records = Array.isArray(parsed) ? parsed : parsed.students;

      if (!Array.isArray(records) || !records.length) {
        throw new Error('Файл должен содержать массив студентов (JSON)');
      }

      let successCount = 0;
      const errors = [];

      for (let i = 0; i < records.length; i += 1) {
        const item = records[i];
        const validationError = validateImportItem(item);
        if (validationError) {
          errors.push(`Строка ${i + 1}: ${validationError}`);
          continue;
        }

        const payload = buildImportPayload(item);
        try {
          await api.post('/students', payload);
          successCount += 1;
        } catch (err) {
          const validationMessage = Array.isArray(err.response?.data?.errors)
            ? err.response.data.errors.map((item) => item.msg).join(', ')
            : '';
          const message = validationMessage || err.response?.data?.message || 'Ошибка создания студента';
          errors.push(`Строка ${i + 1}: ${message}`);
        }
      }

      await fetchStats();

      if (successCount > 0) {
        setActionMessage(`Импорт завершен: успешно ${successCount} из ${records.length}`);
      }
      if (errors.length) {
        setActionError(errors.slice(0, 5).join('; '));
      }
    } catch (err) {
      setActionError(err.message || 'Не удалось импортировать файл');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleExportJson = async () => {
    setExportingJson(true);
    setActionError('');
    setActionMessage('');

    try {
      const response = await api.get('/students', {
        params: { page: 1, limit: 1000 }
      });

      const payload = {
        exportedAt: new Date().toISOString(),
        total: response.data?.pagination?.total || response.data?.students?.length || 0,
        students: response.data?.students || []
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `practicehub-students-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setActionMessage('JSON с данными студентов успешно выгружен');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Не удалось выгрузить JSON');
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportPdf = () => {
    if (!stats) return;

    setExportingPdf(true);
    setActionError('');
    setActionMessage('');

    try {
      const generatedAt = new Date().toLocaleString('ru-RU');

      const summaryRows = [
        ['Всего практикантов', String(stats.totalStudents)],
        ['Активные сейчас', String(stats.activeStudents)],
        ['Завершаются на этой неделе', String(stats.endingThisWeek)],
        ['Учебных заведений', String(stats.byInstitution.length)]
      ];

      const practiceRows = stats.byPracticeType.map((item) => [
        practiceTypeLabels[item.type] || item.type,
        String(item.count)
      ]);

      const statusRows = stats.byStatus.map((item) => [
        statusLabels[item.status] || item.status,
        String(item.count)
      ]);

      const institutionsRows = [...stats.byInstitution]
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
        .map((item) => [item.institutionName || 'Не указано', String(item.count)]);

      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [32, 24, 32, 24],
        content: [
          {
            table: {
              widths: ['*'],
              body: [[{ text: 'PracticeHub - Отчет по практикантам', style: 'title' }]]
            },
            layout: {
              fillColor: () => '#2563eb',
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft: () => 12,
              paddingRight: () => 12,
              paddingTop: () => 8,
              paddingBottom: () => 8
            }
          },
          { text: `Сформирован: ${generatedAt}`, margin: [0, 8, 0, 14], color: '#475569', fontSize: 10 },

          { text: 'Сводка', style: 'section' },
          {
            table: { headerRows: 1, widths: ['*', 120], body: [['Показатель', 'Значение'], ...summaryRows] },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 12]
          },

          { text: 'Распределение по типам практики', style: 'section' },
          {
            table: { headerRows: 1, widths: ['*', 120], body: [['Тип практики', 'Количество'], ...practiceRows] },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 12]
          },

          { text: 'Распределение по статусам', style: 'section' },
          {
            table: { headerRows: 1, widths: ['*', 120], body: [['Статус', 'Количество'], ...statusRows] },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 12]
          },

          { text: 'Топ учебных заведений', style: 'section' },
          {
            table: { headerRows: 1, widths: ['*', 120], body: [['Учебное заведение', 'Количество'], ...institutionsRows] },
            layout: 'lightHorizontalLines'
          }
        ],
        styles: {
          title: { color: '#ffffff', bold: true, fontSize: 16 },
          section: { fontSize: 12, bold: true, color: '#1e293b', margin: [0, 6, 0, 6] }
        },
        defaultStyle: {
          font: 'Roboto'
        }
      };

      pdfMake.createPdf(docDefinition).download(`practicehub-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      setActionMessage('PDF отчет успешно выгружен');
    } catch (err) {
      setActionError('Не удалось сформировать PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-gray-500">Ошибка загрузки данных</div>;
  }

  const practiceTypeData = stats.byPracticeType.map(item => ({
    name: practiceTypeLabels[item.type],
    value: item.count
  }));

  const statusData = stats.byStatus.map(item => ({
    name: statusLabels[item.status],
    value: item.count
  }));

  const institutionData = stats.byInstitution
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(item => ({
      name: item.institutionName,
      value: item.count
    }));

  const courseData = stats.byCourse.map(item => ({
    name: `${item.course} курс`,
    value: item.count
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Отчеты и аналитика</h1>
        <p className="page-subtitle">Статистика и анализ данных о практикантах</p>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Импорт и экспорт</h2>
            <p className="text-sm text-slate-500 mt-1">
              Импортируйте JSON, экспортируйте JSON и отдельно выгружайте отчет в PDF
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="btn border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Импорт...' : 'Импорт JSON'}
            </button>
            <button
              onClick={handleExportJson}
              disabled={exportingJson}
              className="btn border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              {exportingJson ? 'Экспорт...' : 'Экспорт JSON'}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="btn btn-primary"
            >
              <Download className="w-4 h-4" />
              {exportingPdf ? 'Выгрузка...' : 'Выгрузка отчета PDF'}
            </button>
          </div>
        </div>
        {actionMessage && (
          <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
            {actionMessage}
          </p>
        )}
        {actionError && (
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            {actionError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Всего практикантов</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats.totalStudents}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Активные сейчас</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats.activeStudents}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Завершаются на этой неделе</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats.endingThisWeek}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Учебных заведений</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats.byInstitution.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Распределение по типам практики
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={practiceTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {practiceTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Распределение по статусу
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Топ учебных заведений
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={institutionData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Распределение по курсам
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={courseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

export default Reports;

