import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "./auth-context";
import { DesktopServerSetup } from "./desktop-server-setup";

export function ProtectedRoute() {
  const { configurationError, loading, user } = useAuth();
  const location = useLocation();

  if (configurationError) {
    return <DesktopServerSetup />;
  }
  if (loading) {
    return <main className="centered-state">Sitzung wird geprüft …</main>;
  }
  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }
  return <Outlet />;
}
