import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

import "./styles.css";

import App from "./App.tsx";
import { SlideRoute } from "./components/SlideRoute.tsx";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: App,
});

const validateSearchParams = (search: Record<string, unknown>) => {
  if (Object.keys(search).length > 0) {
    const thumbnailValue = search.thumbnail;
    return {
      thumbnail: thumbnailValue === true || thumbnailValue === "true",
      lang: typeof search.lang === "string" ? search.lang : undefined,
    };
  }
  return null;
};

// Single dynamic route — replaces the static-routes-from-metadata.json approach.
// Index is parsed and looked up against /deck at render time.
const slideByIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/by-index/$index",
  component: () => <SlideRoute kind="index" />,
  validateSearch: validateSearchParams,
});

const slideByIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/by-id/$slideId",
  component: () => <SlideRoute kind="id" />,
  validateSearch: validateSearchParams,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  slideByIdRoute,
  slideByIndexRoute,
]);

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
