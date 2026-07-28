import { createBrowserRouter, RouterProvider } from "react-router";

import { WorkspacePage } from "../features/workspaces/workspace-page";
import { RootLayout } from "./root-layout";

const router = createBrowserRouter([
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
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

