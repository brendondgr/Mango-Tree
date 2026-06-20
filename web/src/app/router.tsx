import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from "@tanstack/react-router";

import { AppProviders } from "@/app/providers";
import { ChatPage } from "@/pages/chat/ChatPage";
import { ExercisePage } from "@exercise/pages/ExercisePage";

function RootLayout() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/chat" />,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: ChatPage,
});

const exerciseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exercise",
  component: ExercisePage,
});

const routeTree = rootRoute.addChildren([indexRoute, chatRoute, exerciseRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
