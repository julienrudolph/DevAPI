import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "./auth-context";

export function ProtectedRoute() {
  const { configurationError, loading, user } = useAuth();
  const location = useLocation();

  if (configurationError) {
    return (
      <main className="centered-state">
        <h1>Authentifizierung nicht konfiguriert</h1>
        <p>
          Hinterlege die öffentlichen Supabase-Werte aus <code>.env.example</code>.
        </p>
      </main>
    );
  }
  if (loading) {
    return <main className="centered-state">Sitzung wird geprüft …</main>;
  }
  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }
  return <Outlet />;
}
