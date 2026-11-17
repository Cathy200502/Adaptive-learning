import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000
});

// Attach the JWT to every request once the user is signed in.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ail_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Turn every failure into a readable message, and sign the user out on 401.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      return Promise.reject(new Error('Cannot reach the server. Is the backend running on port 5000?'));
    }
    const { status, data } = error.response;
    if (status === 401 && localStorage.getItem('ail_token')) {
      localStorage.removeItem('ail_token');
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login?expired=1');
    }
    return Promise.reject(new Error(data?.error || 'Something went wrong. Please try again.'));
  }
);

export const auth = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data.user),
  updateProfile: (payload) => api.put('/auth/profile', payload).then((r) => r.data.user),
  changePassword: (payload) => api.put('/auth/password', payload).then((r) => r.data)
};

export const courses = {
  list: () => api.get('/courses').then((r) => r.data.courses),
  get: (slug) => api.get(`/courses/${slug}`).then((r) => r.data)
};

export const topics = {
  list: (course, search) => api.get(`/topics/${course}`, { params: { search } }).then((r) => r.data.topics),
  get: (course, topic) => api.get(`/topics/${course}/${topic}`).then((r) => r.data)
};

export const quiz = {
  question: (course, topic) => api.get('/quiz/question', { params: { course, topic } }).then((r) => r.data),
  answer: (payload) => api.post('/quiz/answer', payload).then((r) => r.data),
  restart: (course, topic) => api.post('/quiz/restart', { course, topic }).then((r) => r.data),
  mistakes: (course) => api.get('/quiz/mistakes', { params: { course } }).then((r) => r.data.mistakes)
};

export const tutor = {
  // Gemini can take a while to write a lesson, so give it a longer timeout.
  lesson: (payload) => api.post('/tutor/lesson', payload, { timeout: 60000 }).then((r) => r.data),
  check: (payload) => api.post('/tutor/check', payload).then((r) => r.data),
  stats: () => api.get('/tutor/stats').then((r) => r.data)
};

export const progress = {
  overview: () => api.get('/progress').then((r) => r.data),
  dashboard: (course) => api.get('/progress/dashboard', { params: { course } }).then((r) => r.data),
  byCourse: (course) => api.get(`/progress/${course}`).then((r) => r.data)
};

export const resources = {
  byCourse: (course, search) => api.get(`/resources/${course}`, { params: { search } }).then((r) => r.data.resources),
  byTopic: (course, topic) => api.get(`/resources/${course}/${topic}`).then((r) => r.data.resources)
};

export const admin = {
  stats: () => api.get('/admin/stats').then((r) => r.data),
  users: () => api.get('/admin/users').then((r) => r.data.users),
  listTopics: (course) => api.get('/admin/topics', { params: { course } }).then((r) => r.data.topics),
  createTopic: (b) => api.post('/admin/topics', b).then((r) => r.data.topic),
  updateTopic: (id, b) => api.put(`/admin/topics/${id}`, b).then((r) => r.data.topic),
  deleteTopic: (id) => api.delete(`/admin/topics/${id}`).then((r) => r.data),
  listQuestions: (params) => api.get('/admin/questions', { params }).then((r) => r.data.questions),
  createQuestion: (b) => api.post('/admin/questions', b).then((r) => r.data.question),
  updateQuestion: (id, b) => api.put(`/admin/questions/${id}`, b).then((r) => r.data.question),
  deleteQuestion: (id) => api.delete(`/admin/questions/${id}`).then((r) => r.data),
  // Gemini question generation (admin only). Generation can take a while, so it gets a longer timeout.
  aiStatus: () => api.get('/admin/ai/status').then((r) => r.data),
  generateQuestions: (b) => api.post('/admin/questions/generate', b, { timeout: 90000 }).then((r) => r.data),
  saveGeneratedQuestions: (b) => api.post('/admin/questions/generated', b).then((r) => r.data),
  listResources: (course) => api.get('/admin/resources', { params: { course } }).then((r) => r.data.resources),
  createResource: (b) => api.post('/admin/resources', b).then((r) => r.data.resource),
  updateResource: (id, b) => api.put(`/admin/resources/${id}`, b).then((r) => r.data.resource),
  deleteResource: (id) => api.delete(`/admin/resources/${id}`).then((r) => r.data),
  createCourse: (b) => api.post('/admin/courses', b).then((r) => r.data.course),
  updateCourse: (id, b) => api.put(`/admin/courses/${id}`, b).then((r) => r.data.course)
};

export const notifications = {
  list: () => api.get('/notifications').then((r) => r.data.notifications),
  markRead: () => api.put('/notifications/read').then((r) => r.data)
};

export default api;
