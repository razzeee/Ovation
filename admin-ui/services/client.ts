/**
 * Admin API client — thin fetch wrapper with JWT auth.
 */

const BASE = "/admin/api";

let tokenGetter: (() => string | null) | null = null;

/** Called by AuthProvider to wire up token access. */
export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};

  const token = tokenGetter?.();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      if (json.msg) msg = json.msg;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, msg);
  }

  return res.json();
}

// ─── Typed API methods ──────────────────────────────────────────────────────

// Login
export interface LoginResponse {
  success: boolean;
  token: string;
  moderator: {
    moderator_id: number;
    username: string;
    display_name: string;
    is_admin: boolean;
    locales: string;
  };
}

export function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return request("POST", "/login", { username, password });
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export interface ReviewSummary {
  review_id: number;
  date_created: string;
  date_deleted: string | null;
  app_id: string;
  locale: string;
  summary: string;
  description: string;
  version: string;
  distro: string;
  rating: number;
  karma_up: number;
  karma_down: number;
  reported: number;
  user_display: string;
  user_hash: string;
}

export interface ReviewsListResponse {
  success: boolean;
  reviews: ReviewSummary[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface ReviewDetail extends ReviewSummary {
  user_id: number;
  component_id: number;
  user_addr_hash: string;
}

export interface ReviewDetailResponse {
  success: boolean;
  review: ReviewDetail;
  vote_exists: number | null;
  matched_taboos: string[];
}

export function fetchReviews(params: {
  page?: number;
  per_page?: number;
  filter?: string;
}): Promise<ReviewsListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  if (params.filter) qs.set("filter", params.filter);
  return request("GET", `/reviews?${qs}`);
}

export function searchReviews(value: string): Promise<ReviewsListResponse> {
  return request("GET", `/reviews/search?value=${encodeURIComponent(value)}`);
}

export function fetchReview(id: number): Promise<ReviewDetailResponse> {
  return request("GET", `/reviews/${id}`);
}

export function modifyReview(
  id: number,
  data: Partial<{
    summary: string;
    description: string;
    version: string;
    distro: string;
    locale: string;
    user_display: string;
  }>,
): Promise<{ success: boolean }> {
  return request("PUT", `/reviews/${id}`, data);
}

export function unreportReview(id: number): Promise<{ success: boolean }> {
  return request("POST", `/reviews/${id}/unreport`);
}

export function unremoveReview(id: number): Promise<{ success: boolean }> {
  return request("POST", `/reviews/${id}/unremove`);
}

export function englishifyReview(id: number): Promise<{ success: boolean }> {
  return request("POST", `/reviews/${id}/englishify`);
}

export function anonifyReview(id: number): Promise<{ success: boolean }> {
  return request("POST", `/reviews/${id}/anonify`);
}

export function deleteReview(id: number): Promise<{ success: boolean }> {
  return request("DELETE", `/reviews/${id}`);
}

export function voteReview(
  id: number,
  val: "up" | "down" | "meh",
): Promise<{ success: boolean }> {
  return request("POST", `/reviews/${id}/vote/${val}`);
}

export function fetchReviewsByApp(appId: string): Promise<ReviewsListResponse> {
  return request("GET", `/reviews/by-app/${encodeURIComponent(appId)}`);
}

export function fetchReviewsByLocale(
  locale: string,
): Promise<ReviewsListResponse> {
  return request("GET", `/reviews/by-locale/${encodeURIComponent(locale)}`);
}

export function fetchReviewsByUser(
  userHash: string,
): Promise<ReviewsListResponse> {
  return request("GET", `/reviews/by-user/${encodeURIComponent(userHash)}`);
}

// ─── Moderators ─────────────────────────────────────────────────────────────

export interface Moderator {
  moderator_id: number;
  username: string;
  display_name: string;
  is_enabled: boolean;
  is_admin: boolean;
  locales: string;
  user_id: number | null;
  user_hash?: string | null;
}

export interface ModeratorsListResponse {
  success: boolean;
  moderators: Moderator[];
}

export interface ModeratorDetailResponse {
  success: boolean;
  moderator: Moderator;
}

export function fetchModerators(): Promise<ModeratorsListResponse> {
  return request("GET", "/moderators");
}

export function fetchModerator(id: number): Promise<ModeratorDetailResponse> {
  return request("GET", `/moderators/${id}`);
}

export function addModerator(data: {
  username: string;
  password: string;
  display_name: string;
}): Promise<{ success: boolean }> {
  return request("POST", "/moderators", data);
}

export function updateModerator(
  id: number,
  data: Partial<{
    display_name: string;
    user_hash: string;
    locales: string;
    password: string;
    is_enabled: boolean;
    is_admin: boolean;
  }>,
): Promise<{ success: boolean }> {
  return request("PUT", `/moderators/${id}`, data);
}

export function deleteModerator(id: number): Promise<{ success: boolean }> {
  return request("DELETE", `/moderators/${id}`);
}

// ─── Taboos ─────────────────────────────────────────────────────────────────

export interface Taboo {
  taboo_id: number;
  locale: string;
  value: string;
  description: string;
  severity: number;
}

export interface TaboosListResponse {
  success: boolean;
  taboos: Taboo[];
}

export function fetchTaboos(): Promise<TaboosListResponse> {
  return request("GET", "/taboos");
}

export function addTaboo(data: {
  locale: string;
  value: string;
  description: string;
  severity: number;
}): Promise<{ success: boolean }> {
  return request("POST", "/taboos", data);
}

export function deleteTaboo(id: number): Promise<{ success: boolean }> {
  return request("DELETE", `/taboos/${id}`);
}

// ─── Components ─────────────────────────────────────────────────────────────

export interface AppComponent {
  component_id: number;
  app_id: string;
  component_id_parent: number | null;
  review_cnt: number;
  fetch_cnt: number;
}

export interface ComponentsListResponse {
  success: boolean;
  components: AppComponent[];
}

export function fetchComponents(): Promise<ComponentsListResponse> {
  return request("GET", "/components");
}

export function joinComponents(data: {
  parent: string;
  children: string[];
}): Promise<{ success: boolean }> {
  return request("POST", "/components/join", data);
}

export function deleteComponent(id: number): Promise<{ success: boolean }> {
  return request("DELETE", `/components/${id}`);
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface StatsResponse {
  success: boolean;
  stats: Record<string, number>;
  popularity_viewed: { app_id: string; fetch_cnt: number }[];
  popularity_submitted: { app_id: string; review_cnt: number }[];
  users_awesome: { user_id: number; user_hash: string; karma: number }[];
  users_haters: { user_id: number; user_hash: string; karma: number }[];
  distros: { name: string; count: number }[];
}

export interface GraphResponse {
  success: boolean;
  labels: string[];
  data_requests: number[];
  data_submitted: number[];
}

export function fetchStats(): Promise<StatsResponse> {
  return request("GET", "/stats");
}

export function fetchGraphMonth(): Promise<GraphResponse> {
  return request("GET", "/stats/graph/month");
}

export function fetchGraphYear(): Promise<GraphResponse> {
  return request("GET", "/stats/graph/year");
}

// ─── Users ──────────────────────────────────────────────────────────────────

export interface UserInfo {
  user_id: number;
  user_hash: string;
  karma: number;
  is_banned: boolean;
  date_created: string;
  review_count: number;
}

export interface UserInfoResponse {
  success: boolean;
  user: UserInfo;
}

export function fetchUser(userHash: string): Promise<UserInfoResponse> {
  return request("GET", `/users/${encodeURIComponent(userHash)}`);
}

export function banUser(
  userHash: string,
): Promise<{ success: boolean; msg: string }> {
  return request("POST", `/users/${encodeURIComponent(userHash)}/ban`);
}
