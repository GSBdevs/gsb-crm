import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/context/auth";
import AccountsPage from "@/pages/accounts";
import ActivitiesPage from "@/pages/activities";
import ContactsPage from "@/pages/contacts";
import DashboardPage from "@/pages/dashboard";
import LeadsPage from "@/pages/leads";
import LoginPage from "@/pages/login";
import PipelinePage from "@/pages/pipeline";
import WorkflowsPage from "@/pages/workflows";
import { Navigate, Route, Routes } from "react-router";

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/contatos" element={<ContactsPage />} />
        <Route path="/contas" element={<AccountsPage />} />
        <Route path="/atividades" element={<ActivitiesPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
