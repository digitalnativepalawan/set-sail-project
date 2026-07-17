import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const App = lazy(() => import("../App"));

export const Route = createFileRoute("/$")({
  ssr: false,
  component: AppRoute,
});

function AppRoute() {
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}