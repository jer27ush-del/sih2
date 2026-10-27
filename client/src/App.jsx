import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import InstitutionDashboard from './pages/institution/InstitutionDashboard.jsx';
import SubmitComplaint from './pages/institution/SubmitComplaint.jsx';
import ComplaintDetail from './pages/institution/ComplaintDetail.jsx';
import OfficerQueue from './pages/officer/OfficerQueue.jsx';
import OfficerCaseDetail from './pages/officer/OfficerCaseDetail.jsx';
import MonitorDashboard from './pages/monitor/MonitorDashboard.jsx';
import AnalyticsPage from './pages/analytics/AnalyticsPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import TrackComplaint from './pages/TrackComplaint.jsx';
import AccessibilityControls from './components/AccessibilityControls.jsx';

const OFFICIAL = ['OFFICER', 'ADMIN'];

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <div id="main" tabIndex={-1}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/institution"
        element={<ProtectedRoute roles={['INSTITUTION']}><InstitutionDashboard /></ProtectedRoute>}
      />
      <Route
        path="/institution/submit"
        element={<ProtectedRoute roles={['INSTITUTION']}><SubmitComplaint /></ProtectedRoute>}
      />
      <Route
        path="/institution/complaints/:caseId"
        element={<ProtectedRoute roles={['INSTITUTION']}><ComplaintDetail /></ProtectedRoute>}
      />
      <Route path="/officer" element={<ProtectedRoute roles={OFFICIAL}><OfficerQueue /></ProtectedRoute>} />
      <Route
        path="/officer/complaints/:caseId"
        element={<ProtectedRoute roles={OFFICIAL}><OfficerCaseDetail /></ProtectedRoute>}
      />
      <Route path="/monitor" element={<ProtectedRoute roles={OFFICIAL}><MonitorDashboard /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute roles={OFFICIAL}><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/track" element={<TrackComplaint />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      </div>
      <footer className="border-t border-slate-300 bg-white">
        <AccessibilityControls />
      </footer>
    </>
  );
}
