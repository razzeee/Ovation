import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { db } from "../db/index.js";
import {
  analytics,
  components,
  eventlog,
  reviews,
  users,
  votes,
} from "../db/schema.js";
import { getDatestrFromDt } from "../lib/util.js";
import {
  ErrorResponse,
  GraphResponse,
  StatsResponse,
} from "../openapi/schemas.js";
import { requireAdmin, requireAuth } from "./auth.js";

const app = new Hono();

app.use("*", requireAuth);
app.use("*", requireAdmin);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getChartLabelsMonths(): string[] {
  const now = new Date();
  const labels: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString("en", { month: "long" }));
  }
  return labels;
}

function getChartLabelsDays(): string[] {
  const now = new Date();
  const labels: string[] = [];
  for (let i = 0; i < 30; i++) {
    const then = new Date(now.getTime() - i * 86_400_000);
    const y = then.getFullYear();
    const m = String(then.getMonth() + 1).padStart(2, "0");
    const d = String(then.getDate()).padStart(2, "0");
    labels.push(`${y}-${m}-${d}`);
  }
  return labels;
}

async function getAnalyticsByInterval(
  size: number,
  intervalDays: number,
): Promise<number[]> {
  const now = new Date();
  const array: number[] = [];

  for (let i = 0; i < size; i++) {
    const startDate = new Date(
      now.getTime() - (i * intervalDays + intervalDays - 1) * 86_400_000,
    );
    const endDate = new Date(
      now.getTime() - (i * intervalDays - 1) * 86_400_000,
    );
    const start = getDatestrFromDt(startDate);
    const end = getDatestrFromDt(endDate);

    const [result] = await db
      .select({ total: sql<number>`coalesce(sum(${analytics.fetchCnt}), 0)` })
      .from(analytics)
      .where(sql`${analytics.datestr} BETWEEN ${start} AND ${end}`);

    array.push(Number(result?.total ?? 0));
  }
  return array;
}

async function getStatsByInterval(
  size: number,
  intervalDays: number,
  msg: string,
): Promise<number[]> {
  const now = new Date();
  const counts: number[] = [];

  for (let i = 0; i < size; i++) {
    const startDate = new Date(
      now.getTime() - (i * intervalDays + intervalDays - 1) * 86_400_000,
    );
    const endDate = new Date(
      now.getTime() - (i * intervalDays - 1) * 86_400_000,
    );

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventlog)
      .where(
        sql`${eventlog.message} = ${msg} AND ${eventlog.dateCreated} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}`,
      );

    counts.push(Number(result?.count ?? 0));
  }
  return counts;
}

const statsDesc = (
  summary: string,
  description: string,
  responseSchema: import("zod").ZodType,
) =>
  describeRoute({
    tags: ["Admin Stats"],
    security: [{ bearerAuth: [] }],
    summary,
    description,
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: resolver(responseSchema) } },
      },
      400: {
        description: "Error",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  });

// ─── GET /stats — aggregate statistics ──────────────────────────────────

app.get(
  "/",
  statsDesc(
    "Get statistics",
    "Aggregate dashboard statistics including review counts, popularity, karma leaderboards, and distro distribution.",
    StatsResponse,
  ),
  async (c) => {
    const stats: Record<string, number> = {};

    // Run all stat queries in parallel
    const [
      totalReviews,
      uniqueReviewers,
      upvotes,
      downvotes,
      uniqueVoters,
      uniqueLanguages,
      uniqueDistros,
      uniqueApps,
      reportedReviews,
      star1,
      star2,
      star3,
      star4,
      star5,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(reviews),
      db
        .select({ count: sql<number>`count(distinct ${reviews.userId})` })
        .from(reviews),
      db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(eq(votes.val, 1)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(eq(votes.val, -1)),
      db
        .select({ count: sql<number>`count(distinct ${votes.userId})` })
        .from(votes),
      db
        .select({ count: sql<number>`count(distinct ${reviews.locale})` })
        .from(reviews),
      db
        .select({ count: sql<number>`count(distinct ${reviews.distro})` })
        .from(reviews),
      db.select({ count: sql<number>`count(*)` }).from(components),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(sql`${reviews.reported} > 0`),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(eq(reviews.rating, 20)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(eq(reviews.rating, 40)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(eq(reviews.rating, 60)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(eq(reviews.rating, 80)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(eq(reviews.rating, 100)),
    ]);

    stats["Active reviews"] = Number(totalReviews[0]?.count ?? 0);
    stats["Unique reviewers"] = Number(uniqueReviewers[0]?.count ?? 0);
    stats["User upvotes"] = Number(upvotes[0]?.count ?? 0);
    stats["User downvotes"] = Number(downvotes[0]?.count ?? 0);
    stats["Unique voters"] = Number(uniqueVoters[0]?.count ?? 0);
    stats["Unique languages"] = Number(uniqueLanguages[0]?.count ?? 0);
    stats["Unique distros"] = Number(uniqueDistros[0]?.count ?? 0);
    stats["Unique apps reviewed"] = Number(uniqueApps[0]?.count ?? 0);
    stats["Reported reviews"] = Number(reportedReviews[0]?.count ?? 0);
    stats["1 star reviews"] = Number(star1[0]?.count ?? 0);
    stats["2 star reviews"] = Number(star2[0]?.count ?? 0);
    stats["3 star reviews"] = Number(star3[0]?.count ?? 0);
    stats["4 star reviews"] = Number(star4[0]?.count ?? 0);
    stats["5 star reviews"] = Number(star5[0]?.count ?? 0);

    // Popularity by fetches (top 50)
    const viewed = await db
      .select({ appId: components.appId, fetchCnt: components.fetchCnt })
      .from(components)
      .where(sql`${components.appId} IS NOT NULL`)
      .orderBy(desc(components.fetchCnt))
      .limit(50);

    // Popularity by reviews (top 50)
    const submitted = await db
      .select({ appId: components.appId, reviewCnt: components.reviewCnt })
      .from(components)
      .where(sql`${components.appId} IS NOT NULL`)
      .orderBy(desc(components.reviewCnt))
      .limit(50);

    // Top karma users
    const usersAwesome = await db
      .select({
        userId: users.userId,
        userHash: users.userHash,
        karma: users.karma,
      })
      .from(users)
      .where(sql`${users.karma} != 0`)
      .orderBy(desc(users.karma))
      .limit(10);

    const usersHaters = await db
      .select({
        userId: users.userId,
        userHash: users.userHash,
        karma: users.karma,
      })
      .from(users)
      .where(sql`${users.karma} != 0`)
      .orderBy(users.karma)
      .limit(10);

    // Distro distribution (top 8)
    const distroRows = await db
      .select({
        distro: reviews.distro,
        total: sql<number>`count(${reviews.distro})`,
      })
      .from(reviews)
      .groupBy(reviews.distro)
      .orderBy(sql`count(${reviews.distro}) DESC`)
      .limit(8);

    const distros = distroRows.map((row) => {
      let name = row.distro ?? "Unknown";
      for (const suffix of [" Linux", " GNU/Linux", " OS"]) {
        if (name.endsWith(suffix)) {
          name = name.slice(0, -suffix.length);
        }
      }
      return { name, count: Number(row.total) };
    });

    return c.json({
      success: true,
      stats,
      popularity_viewed: viewed.map((v) => ({
        app_id: v.appId,
        fetch_cnt: v.fetchCnt,
      })),
      popularity_submitted: submitted.map((s) => ({
        app_id: s.appId,
        review_cnt: s.reviewCnt,
      })),
      users_awesome: usersAwesome.map((u) => ({
        user_id: u.userId,
        user_hash: u.userHash,
        karma: u.karma,
      })),
      users_haters: usersHaters.map((u) => ({
        user_id: u.userId,
        user_hash: u.userHash,
        karma: u.karma,
      })),
      distros,
    });
  },
);

// ─── GET /stats/graph/month — daily data for the last 30 days ───────────────

app.get(
  "/graph/month",
  statsDesc(
    "Monthly graph data",
    "Daily fetch and submission counts for the last 30 days.",
    GraphResponse,
  ),
  async (c) => {
    const [dataFetch, dataReview] = await Promise.all([
      getAnalyticsByInterval(30, 1),
      getStatsByInterval(30, 1, "reviewed"),
    ]);

    return c.json({
      success: true,
      labels: getChartLabelsDays().reverse(),
      data_requests: dataFetch.reverse(),
      data_submitted: dataReview.reverse(),
    });
  },
);

// ─── GET /stats/graph/year — monthly data for the last 12 months ────────────

app.get(
  "/graph/year",
  statsDesc(
    "Yearly graph data",
    "Monthly fetch and submission counts for the last 12 months.",
    GraphResponse,
  ),
  async (c) => {
    const [dataFetch, dataReview] = await Promise.all([
      getAnalyticsByInterval(12, 30),
      getStatsByInterval(12, 30, "reviewed"),
    ]);

    return c.json({
      success: true,
      labels: getChartLabelsMonths().reverse(),
      data_requests: dataFetch.reverse(),
      data_submitted: dataReview.reverse(),
    });
  },
);

export default app;
