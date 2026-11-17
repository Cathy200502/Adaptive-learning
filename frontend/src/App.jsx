import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import PublicLayout from './layouts/PublicLayout';
import AuthLayout from './layouts/AuthLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import TopicExplorer from './pages/TopicExplorer';
import TopicDetail from './pages/TopicDetail';
import Quiz from './pages/Quiz';
import LearningPath from './pages/LearningPath';
import Progress from './pages/Progress';
import Resources from './pages/Resources';
import MistakeReview from './pages/MistakeReview';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

import AdminDashboard from './pages/admin/AdminDashboard';
import ManageCourses from './pages/admin/ManageCourses';
import ManageTopics from './pages/admin/ManageTopics';
import ManageQuestions from './pages/admin/ManageQuestions';
import ManageResources from './pages/admin/ManageResources';

export default function App() {
  return (
    <Routes>
      {/* Marketing shell: header, nav and footer around the landing page. */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route path="/signup" element={<Navigate to="/register" replace />} />

      {/* Everything below requires a valid JWT. */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/topics" element={<TopicExplorer />} />
        <Route path="/topics/:course/:topic" element={<TopicDetail />} />
        <Route path="/learning-path" element={<LearningPath />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/quiz/:course/:topic" element={<Quiz />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:course/:topic" element={<Resources />} />
        <Route path="/mistakes" element={<MistakeReview />} />
        <Route path="/profile" element={<Profile />} />

        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/courses" element={<ProtectedRoute adminOnly><ManageCourses /></ProtectedRoute>} />
        <Route path="/admin/topics" element={<ProtectedRoute adminOnly><ManageTopics /></ProtectedRoute>} />
        <Route path="/admin/questions" element={<ProtectedRoute adminOnly><ManageQuestions /></ProtectedRoute>} />
        <Route path="/admin/resources" element={<ProtectedRoute adminOnly><ManageResources /></ProtectedRoute>} />
      </Route>

      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
