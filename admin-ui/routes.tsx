import { useAuth } from "@admin/auth/context";
import { Loading } from "@admin/components/helpers";
import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router-dom";

import { Shell } from "@admin/components/Shell";
/* Eager: Shell + Login (always needed on first load). */
import { LoginPage } from "@admin/pages/LoginPage";

/* Lazy-loaded page chunks — Recharts and Sentry are heavy,
   so Stats/Usage pages are split into their own chunks. */
const ReviewsPage = lazy(() =>
	import("@admin/pages/ReviewsPage").then((m) => ({ default: m.ReviewsPage })),
);
const ReviewDetailPage = lazy(() =>
	import("@admin/pages/ReviewDetailPage").then((m) => ({
		default: m.ReviewDetailPage,
	})),
);
const SearchPage = lazy(() =>
	import("@admin/pages/SearchPage").then((m) => ({ default: m.SearchPage })),
);
const StatsPage = lazy(() =>
	import("@admin/pages/StatsPage").then((m) => ({ default: m.StatsPage })),
);
const UsagePage = lazy(() =>
	import("@admin/pages/UsagePage").then((m) => ({ default: m.UsagePage })),
);
const ModeratorsPage = lazy(() =>
	import("@admin/pages/ModeratorsPage").then((m) => ({
		default: m.ModeratorsPage,
	})),
);
const ModeratorEditPage = lazy(() =>
	import("@admin/pages/ModeratorEditPage").then((m) => ({
		default: m.ModeratorEditPage,
	})),
);
const TaboosPage = lazy(() =>
	import("@admin/pages/TaboosPage").then((m) => ({ default: m.TaboosPage })),
);
const ComponentsPage = lazy(() =>
	import("@admin/pages/ComponentsPage").then((m) => ({
		default: m.ComponentsPage,
	})),
);

/** Suspense wrapper for lazy routes. */
function Lazy({ children }: { children: ReactNode }) {
	return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

/** Redirect to login if not authenticated. */
function RequireAuth({ children }: { children: ReactNode }) {
	const { isAuthenticated } = useAuth();
	if (!isAuthenticated) return <Navigate to="/login" replace />;
	return <>{children}</>;
}

/** Redirect to login if not admin. */
function RequireAdmin({ children }: { children: ReactNode }) {
	const { isAuthenticated, isAdmin } = useAuth();
	if (!isAuthenticated) return <Navigate to="/login" replace />;
	if (!isAdmin) return <Navigate to="/reviews" replace />;
	return <>{children}</>;
}

/** Redirect to reviews if already authenticated. */
function GuestOnly({ children }: { children: ReactNode }) {
	const { isAuthenticated } = useAuth();
	if (isAuthenticated) return <Navigate to="/reviews" replace />;
	return <>{children}</>;
}

export const routes: RouteObject[] = [
	{
		path: "/login",
		element: (
			<GuestOnly>
				<LoginPage />
			</GuestOnly>
		),
	},
	{
		path: "/",
		element: (
			<RequireAuth>
				<Shell />
			</RequireAuth>
		),
		children: [
			{ index: true, element: <Navigate to="/reviews" replace /> },
			{
				path: "reviews",
				element: (
					<Lazy>
						<ReviewsPage />
					</Lazy>
				),
			},
			{
				path: "reviews/reported",
				element: (
					<Lazy>
						<ReviewsPage filter="reported" />
					</Lazy>
				),
			},
			{
				path: "reviews/app/:appId",
				element: (
					<Lazy>
						<ReviewsPage mode="by-app" />
					</Lazy>
				),
			},
			{
				path: "reviews/locale/:locale",
				element: (
					<Lazy>
						<ReviewsPage mode="by-locale" />
					</Lazy>
				),
			},
			{
				path: "reviews/user/:userHash",
				element: (
					<Lazy>
						<ReviewsPage mode="by-user" />
					</Lazy>
				),
			},
			{
				path: "reviews/:id",
				element: (
					<Lazy>
						<ReviewDetailPage />
					</Lazy>
				),
			},
			{
				path: "search",
				element: (
					<Lazy>
						<SearchPage />
					</Lazy>
				),
			},
			{
				path: "profile",
				element: (
					<Lazy>
						<ModeratorEditPage self />
					</Lazy>
				),
			},
			{
				path: "stats",
				element: (
					<RequireAdmin>
						<Lazy>
							<StatsPage />
						</Lazy>
					</RequireAdmin>
				),
			},
			{
				path: "usage",
				element: (
					<Lazy>
						<UsagePage />
					</Lazy>
				),
			},
			{
				path: "moderators",
				element: (
					<RequireAdmin>
						<Lazy>
							<ModeratorsPage />
						</Lazy>
					</RequireAdmin>
				),
			},
			{
				path: "moderators/:id",
				element: (
					<Lazy>
						<ModeratorEditPage />
					</Lazy>
				),
			},
			{
				path: "taboos",
				element: (
					<RequireAdmin>
						<Lazy>
							<TaboosPage />
						</Lazy>
					</RequireAdmin>
				),
			},
			{
				path: "components",
				element: (
					<RequireAdmin>
						<Lazy>
							<ComponentsPage />
						</Lazy>
					</RequireAdmin>
				),
			},
		],
	},
	{ path: "*", element: <Navigate to="/" replace /> },
];
