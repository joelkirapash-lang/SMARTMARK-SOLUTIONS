import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Shell, { SuspendedScreen } from "./components/Shell";
import { Spinner } from "./components/ui";

import Login from "./pages/Login";
import { Account, ForcedPassword } from "./pages/Account";
import PublicReportCard from "./pages/PublicReportCard";
import { SuperDashboard, Schools, ViewAs } from "./pages/Super";
import { AdminDashboard, StaffDashboard, StudentHome } from "./pages/Dashboards";
import Accounts from "./pages/Accounts";
import Academics from "./pages/Academics";
import { Access, Exams, Promote, Remarks, Settings, Activity } from "./pages/AdminPages";
import MarksEntry from "./pages/MarksEntry";
import Marklist from "./pages/Marklist";
import Trends from "./pages/Trends";
import ReportCards from "./pages/ReportCards";
import Students from "./pages/Students";
import MarksImport from "./pages/MarksImport";

function Gate({ children, bare }) {
  const { user, loading, suspended, impersonating } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (suspended) return <SuspendedScreen />;
  if (!bare && user.must_change_password && !impersonating) return <Navigate to="/change-password" replace />;
  if (bare && !user.must_change_password) return <Navigate to="/app" replace />;
  return children;
}

function Only({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? children : <Navigate to="/app" replace />;
}

const ADMIN = ["SCHOOL_ADMIN"];
const STAFF = ["TEACHER", "EDUCATOR"];
const SA = ["SUPER_ADMIN"];

function Home() {
  const { user } = useAuth();
  if (user.role === "SUPER_ADMIN") return <SuperDashboard />;
  if (user.role === "SCHOOL_ADMIN") return <AdminDashboard />;
  if (user.role === "STUDENT") return <StudentHome />;
  return <StaffDashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/report/:token" element={<PublicReportCard />} />
      <Route path="/change-password" element={<Gate bare><ForcedPassword /></Gate>} />
      <Route path="/app" element={<Gate><Shell /></Gate>}>
        <Route index element={<Home />} />
        <Route path="account" element={<Account />} />
        <Route path="schools" element={<Only roles={SA}><Schools /></Only>} />
        <Route path="view-as" element={<Only roles={SA}><ViewAs /></Only>} />
        <Route path="accounts" element={<Only roles={ADMIN}><Accounts /></Only>} />
        <Route path="academics" element={<Only roles={ADMIN}><Academics /></Only>} />
        <Route path="access" element={<Only roles={ADMIN}><Access /></Only>} />
        <Route path="exams" element={<Only roles={ADMIN}><Exams /></Only>} />
        <Route path="promote" element={<Only roles={ADMIN}><Promote /></Only>} />
        <Route path="remarks" element={<Only roles={ADMIN}><Remarks /></Only>} />
        <Route path="settings" element={<Only roles={ADMIN}><Settings /></Only>} />
        <Route path="marks" element={<Only roles={[...ADMIN, ...STAFF]}><MarksEntry /></Only>} />
        <Route path="import" element={<Only roles={[...ADMIN, ...STAFF]}><MarksImport /></Only>} />
        <Route path="marklist" element={<Only roles={[...ADMIN, ...STAFF]}><Marklist /></Only>} />
        <Route path="trends" element={<Only roles={[...ADMIN, ...STAFF]}><Trends /></Only>} />
        <Route path="students" element={<Only roles={STAFF}><Students /></Only>} />
        <Route path="report-cards" element={<Only roles={[...ADMIN, ...STAFF, "STUDENT"]}><ReportCards /></Only>} />
        <Route path="activity" element={<Activity />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
