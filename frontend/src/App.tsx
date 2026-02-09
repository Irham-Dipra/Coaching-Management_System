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
import Scheduling from './pages/Scheduling';
import ScheduleDetails from './pages/ScheduleDetails';
import RoomDetails from './pages/RoomDetails';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Unauthorized from './pages/Unauthorized';
import UserProfile from './pages/UserProfile'; // Import
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Protected Route Wrapper
const PrivateRoute = () => {
  const { session, userRole, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  // 1. Must be logged in
  if (!session) return <Navigate to="/login" replace />;

  // 2. (Optional) Check specific roles if needed
  // if (userRole === 'restricted') return <Navigate to="/unauthorized" replace />;

  // 3. Render child routes (Layout > Dashboard etc.)
  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* PROTECTED ROUTES */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>

              {/* Default Path: Redirect to Dashboard */}
              <Route path="/" element={<Dashboard />} />

              {/* Modules */}
              <Route path="/programs" element={<Programs />} />
              <Route path="/programs/:id" element={<ProgramDetails />} />

              <Route path="/batches" element={<Batches />} />
              <Route path="/batches/:id" element={<BatchDetails />} />

              {/* Exams Route */}
              <Route path="/exams" element={<Exams />} />
              <Route path="/exams/:id" element={<ExamDetails />} />

              <Route path="/attendance" element={<Attendance />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/admin/scheduling" element={<Scheduling />} />
              <Route path="/admin/scheduling/:id" element={<ScheduleDetails />} />
              <Route path="/admin/scheduling/rooms/:id" element={<RoomDetails />} />

              <Route path="/students" element={<StudentList />} />
              <Route path="/students/:id" element={<StudentProfile />} />

              <Route path="/profile" element={<UserProfile />} /> {/* New Route */}

              {/* Catch-all: Redirect to Home (which then checks auth) */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;