import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import LandingPage        from './pages/LandingPage';
import AuthPage           from './pages/AuthPage';
import DashboardPage      from './pages/DashboardPage';
import NewsDetectionPage  from './pages/NewsDetectionPage';
import BrandSentimentPage from './pages/BrandSentimentPage';
import ResultPage         from './pages/ResultPage';
import HistoryPage        from './pages/HistoryPage';
import ReportsPage        from './pages/ReportsPage';
import ProfilePage        from './pages/ProfilePage';
import SettingsPage       from './pages/SettingsPage';
import RumorBusterPage    from './pages/RumorBusterPage';
import DeepfakeLabPage   from './pages/DeepfakeLabPage';

const AppRouter = () => (
  <Routes>
    {/* Public */}
    <Route path="/"    element={<LandingPage />} />
    <Route path="/auth" element={<AuthPage />}   />

    {/* Protected */}
    <Route path="/dashboard"      element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}      />
    <Route path="/news-detection"  element={<ProtectedRoute><NewsDetectionPage /></ProtectedRoute>}  />
    <Route path="/rumor-buster"    element={<ProtectedRoute><RumorBusterPage /></ProtectedRoute>}    />
    <Route path="/deepfake-lab"    element={<ProtectedRoute><DeepfakeLabPage /></ProtectedRoute>}    />
    <Route path="/brand-sentiment" element={<ProtectedRoute><BrandSentimentPage /></ProtectedRoute>} />
    <Route path="/result"          element={<ProtectedRoute><ResultPage /></ProtectedRoute>}         />
    <Route path="/result/:id"      element={<ProtectedRoute><ResultPage /></ProtectedRoute>}         />
    <Route path="/history"         element={<ProtectedRoute><HistoryPage /></ProtectedRoute>}        />
    <Route path="/reports"         element={<ProtectedRoute><ReportsPage /></ProtectedRoute>}        />
    <Route path="/profile"         element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}        />
    <Route path="/settings"        element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}       />

    {/* Catch-all */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRouter;
