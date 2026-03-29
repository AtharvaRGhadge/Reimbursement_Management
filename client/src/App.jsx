import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyExpenses from './pages/MyExpenses.jsx';
import NewExpense from './pages/NewExpense.jsx';
import Approvals from './pages/Approvals.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminWorkflows from './pages/AdminWorkflows.jsx';
import AllExpenses from './pages/AllExpenses.jsx';
import AdminApprovalRules from './pages/AdminApprovalRules.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="h-10 w-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Shell />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="expenses"
          element={
            <RoleRoute roles={['employee']}>
              <MyExpenses />
            </RoleRoute>
          }
        />
        <Route
          path="expenses/new"
          element={
            <RoleRoute roles={['employee']}>
              <NewExpense />
            </RoleRoute>
          }
        />
        <Route
          path="approvals"
          element={
            <RoleRoute roles={['manager', 'admin']}>
              <Approvals />
            </RoleRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <RoleRoute roles={['admin']}>
              <AdminUsers />
            </RoleRoute>
          }
        />
        <Route
          path="admin/approval-rules"
          element={
            <RoleRoute roles={['admin']}>
              <AdminApprovalRules />
            </RoleRoute>
          }
        />
        <Route
          path="admin/workflows"
          element={
            <RoleRoute roles={['admin']}>
              <AdminWorkflows />
            </RoleRoute>
          }
        />
        <Route
          path="admin/all"
          element={
            <RoleRoute roles={['admin']}>
              <AllExpenses />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
