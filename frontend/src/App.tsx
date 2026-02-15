import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import BatchDetails from './pages/BatchDetails';
import Programs from './pages/Programs';
import StudentList from './components/StudentList';
import StudentProfile from './pages/StudentProfile';
import ProgramDetails from './pages/ProgramDetails';
import ExamDetails from './pages/ExamDetails';
import Exams from './pages/Exams';
import Attendance from './pages/Attendance';
import Finance from './pages/Finance';
import FinanceBreakdown from './pages/FinanceBreakdown';
import ProgramFinanceDetails from './pages/ProgramFinanceDetails';
import Scheduling from './pages/Scheduling';
import ScheduleDetails from './pages/ScheduleDetails';
import RoomDetails from './pages/RoomDetails';
import Login from './pages/Login';
import UserProfile from './pages/UserProfile';
import Enrollment from './pages/Enrollment';
import PrintBatch from './pages/PrintBatch';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Admin-Only Protected Route
const AdminRoute = () => {
  const { session, roleId, loading, signOut } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;

  // Must be logged in
  if (!session) return <Navigate to="/login" replace />;

  // Must be an admin (role_id = 1)
  if (roleId !== 1) {
    // Sign out non-admin users and redirect to login
    signOut();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* PUBLIC: Login only */}
          <Route path="/login" element={<Login />} />

          {/* PROTECTED: Admin-only routes */}
          <Route element={<AdminRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />

              <Route path="/programs" element={<Programs />} />
              <Route path="/programs/:id" element={<ProgramDetails />} />

              <Route path="/batches" element={<Batches />} />
              <Route path="/batches/:id" element={<BatchDetails />} />

              <Route path="/exams" element={<Exams />} />
              <Route path="/exams/:id" element={<ExamDetails />} />

              <Route path="/attendance" element={<Attendance />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/admin/finance/breakdown/:type" element={<FinanceBreakdown />} />
              <Route path="/admin/finance/program/:id" element={<ProgramFinanceDetails />} />
              <Route path="/admin/scheduling" element={<Scheduling />} />
              <Route path="/admin/scheduling/:id" element={<ScheduleDetails />} />
              <Route path="/admin/scheduling/rooms/:id" element={<RoomDetails />} />

              <Route path="/admin/print" element={<PrintBatch />} />

              <Route path="/students" element={<StudentList />} />
              <Route path="/students/:id" element={<StudentProfile />} />

              <Route path="/enrollment" element={<Enrollment />} />
              <Route path="/profile" element={<UserProfile />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;