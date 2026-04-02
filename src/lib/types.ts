/** Shared type definitions for the Ovation application */

/** JSON shape returned by the public review API */
export interface ReviewApiResponse {
  app_id: string;
  date_created: number;
  description: string | null;
  distro: string | null;
  karma_down: number;
  karma_up: number;
  locale: string | null;
  rating: number;
  reported: number;
  review_id: number;
  summary: string | null;
  user_display: string | null;
  user_hash?: string;
  user_skey?: string;
  version: string | null;
  score?: number;
  vote_id?: number;
}

/** JSON shape for submitting a review */
export interface ReviewSubmitRequest {
  app_id: string;
  locale: string;
  summary: string;
  description: string;
  user_hash: string;
  version: string;
  distro: string;
  rating: number;
  user_display: string;
}

/** JSON shape for fetching reviews */
export interface ReviewFetchRequest {
  app_id: string;
  user_hash: string;
  locale: string;
  distro: string;
  limit: number;
  version: string;
  compat_ids?: string[];
  start?: number;
}

/** JSON shape for vote/remove requests */
export interface VoteRequest {
  review_id: number;
  app_id: string;
  user_hash: string;
  user_skey: string;
}

/** Rating bucket response */
export interface RatingResponse {
  total: number;
  star0: number;
  star1: number;
  star2: number;
  star3: number;
  star4: number;
  star5: number;
}

/** API success/error response */
export interface ApiResponse {
  success: boolean;
  msg?: string;
  review_id?: number;
}

/** JWT payload for admin auth */
export interface JwtPayload {
  moderatorId: number;
  username: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

/** Admin stats response */
export interface StatsResponse {
  [key: string]: number;
}
