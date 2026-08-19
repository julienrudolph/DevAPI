import { createBrowserRouter, RouterProvider } from "react-router";

import { AccountSettingsPage } from "../features/auth/account-settings-page";
import { LoginPage } from "../features/auth/login-page";
import { AuthConfirmPage } from "../features/auth/auth-confirm-page";
import { ProtectedRoute } from "../features/auth/protected-route";
import { InvitationAcceptPage } from "../features/invitations/invitation-accept-page";
import { WorkspacePage } from "../features/workspaces/workspace-page";
import { RootLayout } from "./root-layout";
import { UpdatePasswordPage } from "../features/auth/update-password-page";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/auth/confirm",
    element: <AuthConfirmPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/auth/password",
        element: <UpdatePasswordPage />,
      },
      {
        path: "/",
        element: <RootLayout />,
        children: [
          {
            index: true,
            element: <WorkspacePage />,
          },
          {
            path: "workspaces/:workspaceId",
            element: <WorkspacePage />,
          },
          {
            path: "invitations/:token",
            element: <InvitationAcceptPage />,
          },
          {
            path: "account",
            element: <AccountSettingsPage />,
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
