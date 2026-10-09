import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        window.location.href = '/admin/login';
      } else if (path.startsWith('/student')) {
        window.location.href = '/student/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  adminLogin: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  studentLogin: (regNo: string, password: string) =>
    api.post('/auth/student/login', { regNo, password }),
  getMe: () => api.get('/auth/me'),
};

// Admin API
export const adminApi = {
  // Students
  getStudents: (page = 1, limit = 50, search = '') =>
    api.get(`/admin/students?page=${page}&limit=${limit}&search=${search}`),
  createStudent: (data: any) => api.post('/admin/students', data),
  uploadStudents: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/students/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteStudent: (id: string) => api.delete(`/admin/students/${id}`),
  getStudent: (id: string) => api.get(`/admin/students/${id}`),

  // Questions
  getQuestions: (page = 1, limit = 50, search = '') =>
    api.get(`/admin/questions?page=${page}&limit=${limit}&search=${search}`),
  getQuestion: (id: string) => api.get(`/admin/questions/${id}`),
  createQuestion: (data: any) => api.post('/admin/questions', data),
  updateQuestion: (id: string, data: any) => api.put(`/admin/questions/${id}`, data),
  deleteQuestion: (id: string) => api.delete(`/admin/questions/${id}`),
  uploadQuestions: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/questions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Exams
  getExams: () => api.get('/admin/exams'),
  getExam: (id: string) => api.get(`/admin/exams/${id}`),
  createExam: (data: any) => api.post('/admin/exams', data),
  updateExam: (id: string, data: any) => api.put(`/admin/exams/${id}`, data),
  deleteExam: (id: string) => api.delete(`/admin/exams/${id}`),
  publishExam: (id: string, isPublished: boolean) =>
    api.patch(`/admin/exams/${id}/publish`, { isPublished }),
  publishResults: (id: string, resultsPublished: boolean) =>
    api.patch(`/admin/exams/${id}/publish-results`, { resultsPublished }),
  getExamSessions: (examId: string) => api.get(`/admin/exams/${examId}/sessions`),
  getExamSubmissions: (examId: string) => api.get(`/admin/exams/${examId}/submissions`),
  getExamResults: (examId: string) => api.get(`/admin/exams/${examId}/results`),
  exportResults: (examId: string) =>
    api.get(`/admin/exams/${examId}/export`, { responseType: 'blob' }),
  updateSubmissionMarks: (submissionId: string, score: number) =>
    api.patch(`/admin/exams/submissions/${submissionId}/marks`, { score }),
};

// Student API
export const studentApi = {
  getExams: () => api.get('/student/exams'),
  startExam: (examId: string) => api.post(`/student/exams/${examId}/start`),
  getSession: (sessionId: string) => api.get(`/student/sessions/${sessionId}`),
  heartbeat: (sessionId: string) =>
    api.post(`/student/sessions/${sessionId}/heartbeat`),
  autosave: (sessionId: string, data: any) =>
    api.post(`/student/sessions/${sessionId}/autosave`, data),
  runSample: (sessionId: string, data: any) =>
    api.post(`/student/sessions/${sessionId}/run`, data),
  submitCode: (sessionId: string, data: any) =>
    api.post(`/student/sessions/${sessionId}/submit`, data),
  finishExam: (sessionId: string, autoSubmit = false) =>
    api.post(`/student/sessions/${sessionId}/finish`, { autoSubmit }),
  reportProctorEvent: (sessionId: string, data: any) =>
    api.post(`/student/sessions/${sessionId}/proctor-event`, data),
  getResults: () => api.get('/student/results'),
  getProfile: () => api.get('/student/profile'),
};
