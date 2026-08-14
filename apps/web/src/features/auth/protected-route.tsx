import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "./auth-context";
import { DesktopServerSetup } from "./desktop-server-setup";

export function ProtectedRoute() {
  const { t } = useTranslation("auth");
  const { configurationError, loading, user } = useAuth();
  const location = useLocation();

  if (configurationError) {
    return <DesktopServerSetup />;
  }
  if (loading) {
    return (
      <main className="centered-state">
        {t("protectedRoute.checkingSession")}
      </main>
    );
  }
  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }
  return <Outlet />;
}
