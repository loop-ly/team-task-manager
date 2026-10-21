import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Spinner from './components/ui/Spinner';

/** Only logged-in users get through; everyone else is sent to the login page. */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading your workspace" />;
  return user ? children : <Navigate to="/login" replace />;
}

/** Login / register are hidden from people who are already logged in. */
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading" />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><AuthPage key="login" mode="login" /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><AuthPage key="register" mode="register" /></PublicOnlyRoute>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/teams/:teamId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
