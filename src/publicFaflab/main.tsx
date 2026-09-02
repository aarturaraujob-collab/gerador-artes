import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Route, Router, Switch } from "wouter";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FafLabDashboard } from "@/pages/faflab/FafLabDashboard";
import NotFound from "@/pages/NotFound";

import "@/index.css";

/**
 * Standalone entry for the public FAF Lab page — built separately (see
 * vite.faflab.config.ts) and deployed to its own top-level path
 * (futeboldealagoas.net/faflab), independent from the Urano admin tool at
 * /urano/. Reuses the exact same FafLabDashboard component the main app
 * mounts at /publico/faf-lab in publicMode — only the surrounding shell
 * (this file) and the deploy target differ.
 *
 * FafLabDashboard's internal navigate() calls are hardcoded to
 * "/publico/faf-lab" in publicMode (see basePath in FafLabDashboard.tsx),
 * so that path is mirrored here too — "/" and "/:competitionId" just give
 * the same page a clean short URL for the top-level landing/share link.
 */
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Router base={routerBase}>
        <Switch>
          <Route path="/publico/faf-lab" component={() => <FafLabDashboard publicMode />} />
          <Route path="/publico/faf-lab/:competitionId" component={() => <FafLabDashboard publicMode />} />
          <Route path="/" component={() => <FafLabDashboard publicMode />} />
          <Route path="/:competitionId" component={() => <FafLabDashboard publicMode />} />
          <Route component={NotFound} />
        </Switch>
      </Router>
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  </ErrorBoundary>,
);
