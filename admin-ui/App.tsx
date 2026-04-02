import { AuthProvider } from "@admin/auth/context";
import { routes } from "@admin/routes";
import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
	BrowserRouter,
	createRoutesFromChildren,
	matchRoutes,
	useLocation,
	useNavigationType,
	useRoutes,
} from "react-router-dom";

// ─── Sentry init ────────────────────────────────────────────────────────────

Sentry.init({
	dsn: import.meta.env.VITE_SENTRY_DSN || "",
	enabled: !!import.meta.env.VITE_SENTRY_DSN,
	integrations: [
		Sentry.reactRouterV6BrowserTracingIntegration({
			useEffect,
			useLocation,
			useNavigationType,
			createRoutesFromChildren,
			matchRoutes,
		}),
		Sentry.replayIntegration(),
	],
	tracesSampleRate: 0.2,
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1.0,
});

// ─── App ────────────────────────────────────────────────────────────────────

function AppRoutes() {
	return useRoutes(routes);
}

const SentryErrorBoundary = Sentry.ErrorBoundary;

export function App() {
	return (
		<SentryErrorBoundary
			fallback={({ error }) => (
				<div className="login-page">
					<div className="login-card">
						<h1 className="login-title" style={{ color: "var(--danger)" }}>
							Something went wrong
						</h1>
						<p className="login-subtitle">
							{error instanceof Error ? error.message : "Unknown error"}
						</p>
						<button
							type="button"
							className="btn btn-primary w-full mt-4"
							onClick={() => window.location.reload()}
						>
							Reload
						</button>
					</div>
				</div>
			)}
		>
			<BrowserRouter basename="/admin">
				<AuthProvider>
					<AppRoutes />
				</AuthProvider>
			</BrowserRouter>
		</SentryErrorBoundary>
	);
}
