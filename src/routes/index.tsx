import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const App = lazy(() => import("../App"));

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRoute,
});

function IndexRoute() {
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}