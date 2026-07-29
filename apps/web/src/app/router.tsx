import { createBrowserRouter, RouterProvider } from "react-router";

import { LoginPage } from "../features/auth/login-page";
import { ProtectedRoute } from "../features/auth/protected-route";
import { WorkspacePage } from "../features/workspaces/workspace-page";
import { RootLayout } from "./root-layout";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
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
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
