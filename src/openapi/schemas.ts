import { z } from "zod";

// ─── Shared schemas ─────────────────────────────────────────────────────────

export const ErrorResponse = z.object({
  success: z.literal(false),
  msg: z.string(),
});

export const SuccessMsg = z.object({
  success: z.literal(true),
  msg: z.string(),
});

// ─── Public API: Submit ─────────────────────────────────────────────────────

export const SubmitRequest = z.object({
  app_id: z.string().describe("AppStream component ID"),
  locale: z.string().describe("User locale (e.g. en_US)"),
  summary: z.string().max(70).describe("Short review summary"),
  description: z.string().max(3000).describe("Full review text"),
  user_hash: z.string().length(40).describe("SHA-1 machine identifier"),
  version: z.string().describe("Application version"),
  distro: z.string().describe("Distribution name"),
  rating: z.number().int().min(0).max(100).describe("Rating from 0 to 100"),
  user_display: z.string().describe("Display name of the reviewer"),
});

export const SubmitResponse = z.object({
  success: z.literal(true),
  review_id: z.number().int(),
});

// ─── Public API: Fetch ──────────────────────────────────────────────────────

export const FetchRequest = z.object({
  app_id: z.string(),
  user_hash: z.string().length(40),
  locale: z.string(),
  distro: z.string(),
  limit: z.number().int().min(0),
  version: z.string(),
  compat_ids: z.array(z.string()).optional(),
  start: z.number().int().optional(),
});

export const ReviewApiItem = z.object({
  app_id: z.string(),
  date_created: z.number().int().describe("Unix timestamp"),
  description: z.string().nullable(),
  distro: z.string().nullable(),
  karma_down: z.number().int(),
  karma_up: z.number().int(),
  locale: z.string().nullable(),
  rating: z.number().int(),
  reported: z.number().int(),
  review_id: z.number().int(),
  summary: z.string().nullable(),
  user_display: z.string().nullable(),
  user_hash: z.string(),
  user_skey: z.string().describe("Session key for voting"),
  version: z.string().nullable(),
});

export const ReviewApiItemWithScore = ReviewApiItem.extend({
  score: z.number().int(),
  vote_id: z
    .number()
    .int()
    .optional()
    .describe("Present if user already voted"),
});

export const FetchResponse = z.array(ReviewApiItemWithScore);

// ─── Public API: Vote / Report ──────────────────────────────────────────────

export const VoteRequest = z.object({
  review_id: z.number().int(),
  app_id: z.string(),
  user_hash: z.string().length(40),
  user_skey: z.string().length(40).describe("Session key from fetch"),
});

export const VoteResponse = SuccessMsg;

// ─── Public API: Remove ─────────────────────────────────────────────────────

export const RemoveRequest = VoteRequest;
export const RemoveResponse = SuccessMsg;

// ─── Public API: Ratings ────────────────────────────────────────────────────

export const AppRating = z.object({
  total: z.number().int(),
  star0: z.number().int(),
  star1: z.number().int(),
  star2: z.number().int(),
  star3: z.number().int(),
  star4: z.number().int(),
  star5: z.number().int(),
});

export const AllRatings = z.record(z.string(), AppRating);

// ─── Admin: Login ───────────────────────────────────────────────────────────

export const LoginRequest = z.object({
  username: z.string(),
  password: z.string(),
});

export const LoginResponse = z.object({
  success: z.literal(true),
  token: z.string().describe("JWT authentication token"),
  moderator: z.object({
    moderator_id: z.number().int(),
    username: z.string(),
    display_name: z.string(),
    is_admin: z.boolean(),
    is_enabled: z.boolean(),
    locales: z.string().nullable(),
  }),
});

// ─── Admin: Reviews ─────────────────────────────────────────────────────────

export const AdminReviewSummary = z.object({
  review_id: z.number().int(),
  date_created: z.string().describe("ISO 8601 date"),
  date_deleted: z.string().nullable().optional(),
  locale: z.string(),
  summary: z.string(),
  description: z.string(),
  user_display: z.string().nullable(),
  version: z.string(),
  distro: z.string(),
  rating: z.number().int(),
  karma_up: z.number().int(),
  karma_down: z.number().int(),
  reported: z.number().int(),
  app_id: z.string(),
  user_hash: z.string(),
});

export const AdminReviewListResponse = z.object({
  success: z.literal(true),
  reviews: z.array(AdminReviewSummary),
  pagination: z
    .object({
      page: z.number().int(),
      per_page: z.number().int(),
      total: z.number().int(),
      pages: z.number().int(),
    })
    .optional(),
});

export const AdminReviewDetail = AdminReviewSummary.extend({
  user_id: z.number().int(),
  component_id: z.number().int(),
  user_addr_hash: z.string(),
});

export const AdminReviewDetailResponse = z.object({
  success: z.literal(true),
  review: AdminReviewDetail,
  vote_exists: z
    .number()
    .int()
    .nullable()
    .describe("Moderator's existing vote, or null"),
  matched_taboos: z
    .array(z.string())
    .describe("Taboo words found in review text"),
});

export const AdminReviewModifyRequest = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  distro: z.string().optional(),
  locale: z.string().optional(),
  user_display: z.string().optional(),
});

// ─── Admin: Moderators ──────────────────────────────────────────────────────

export const ModeratorItem = z.object({
  moderator_id: z.number().int(),
  username: z.string(),
  display_name: z.string(),
  is_enabled: z.boolean(),
  is_admin: z.boolean(),
  locales: z.string().nullable(),
  user_id: z.number().int().nullable(),
  user_hash: z.string().nullable().optional(),
});

export const ModeratorsListResponse = z.object({
  success: z.literal(true),
  moderators: z.array(ModeratorItem),
});

export const ModeratorDetailResponse = z.object({
  success: z.literal(true),
  moderator: ModeratorItem,
});

export const AddModeratorRequest = z.object({
  username: z.string().min(5).describe("Email address"),
  password: z
    .string()
    .min(8)
    .describe("Must contain at least one non-alphanumeric character"),
  display_name: z.string().min(3),
});

export const AddModeratorResponse = z.object({
  success: z.literal(true),
  msg: z.string(),
  moderator_id: z.number().int(),
});

export const UpdateModeratorRequest = z.object({
  display_name: z.string().optional(),
  password: z.string().min(8).optional(),
  user_hash: z.string().optional(),
  locales: z.string().optional(),
  is_enabled: z.boolean().optional(),
  is_admin: z.boolean().optional(),
});

// ─── Admin: Components ──────────────────────────────────────────────────────

export const ComponentItem = z.object({
  component_id: z.number().int(),
  component_id_parent: z.number().int().nullable(),
  app_id: z.string(),
  fetch_cnt: z.number().int(),
  review_cnt: z.number().int(),
});

export const ComponentsListResponse = z.object({
  success: z.literal(true),
  components: z.array(ComponentItem),
});

export const JoinComponentsRequest = z.object({
  parent: z.string().describe("Parent app_id"),
  children: z.array(z.string()).describe("Child app_ids"),
});

// ─── Admin: Taboos ──────────────────────────────────────────────────────────

export const TabooItem = z.object({
  taboo_id: z.number().int(),
  locale: z.string(),
  value: z.string(),
  description: z.string().nullable(),
  severity: z.number().int(),
});

export const TaboosListResponse = z.object({
  success: z.literal(true),
  taboos: z.array(TabooItem),
});

export const AddTabooRequest = z.object({
  locale: z.string(),
  value: z.string(),
  description: z.string().optional(),
  severity: z.number().int().optional(),
});

export const AddTabooResponse = z.object({
  success: z.literal(true),
  msg: z.string(),
  taboo_id: z.number().int(),
});

// ─── Admin: Users ───────────────────────────────────────────────────────────

export const UserInfo = z.object({
  user_id: z.number().int(),
  user_hash: z.string(),
  date_created: z.string().describe("ISO 8601 date"),
  karma: z.number().int(),
  is_banned: z.boolean(),
  review_count: z.number().int(),
});

export const UserInfoResponse = z.object({
  success: z.literal(true),
  user: UserInfo,
});

// ─── Admin: Query param schemas ─────────────────────────────────────────────

export const AdminReviewListQuery = z.object({
  page: z.coerce.number().int().optional().describe("Page number (default: 1)"),
  per_page: z.coerce
    .number()
    .int()
    .optional()
    .describe("Results per page (default: 20)"),
  filter: z
    .string()
    .optional()
    .describe("'reported', 'all', or an app_id / locale / user_hash"),
});

export const AdminReviewSearchQuery = z.object({
  value: z.string().optional().describe("Search term"),
  max: z.coerce.number().int().optional().describe("Max results (default: 19)"),
});

// ─── Admin: Stats ───────────────────────────────────────────────────────────

export const StatsResponse = z.object({
  success: z.literal(true),
  stats: z.record(z.string(), z.number()),
  popularity_viewed: z.array(
    z.object({ app_id: z.string(), fetch_cnt: z.number().int() }),
  ),
  popularity_submitted: z.array(
    z.object({ app_id: z.string(), review_cnt: z.number().int() }),
  ),
  users_awesome: z.array(
    z.object({
      user_id: z.number().int(),
      user_hash: z.string(),
      karma: z.number().int(),
    }),
  ),
  users_haters: z.array(
    z.object({
      user_id: z.number().int(),
      user_hash: z.string(),
      karma: z.number().int(),
    }),
  ),
  distros: z.array(z.object({ name: z.string(), count: z.number().int() })),
});

export const GraphResponse = z.object({
  success: z.literal(true),
  labels: z.array(z.string()),
  data_requests: z.array(z.number().int()),
  data_submitted: z.array(z.number().int()),
});
