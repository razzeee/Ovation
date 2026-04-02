import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { AllRatings } from "../openapi/schemas.js";
import fetchApp from "./fetch.js";
import moderateApp from "./moderate.js";
import ratingsApp from "./ratings.js";
import removeApp from "./remove.js";
import submitApp from "./submit.js";
import voteApp from "./vote.js";

/**
 * All public API routes mounted under /1.0/reviews/api
 * to maintain backward compatibility with GNOME Software clients.
 */
const api = new Hono();

api.route("/submit", submitApp);
api.route("/fetch", fetchApp);
api.route("/moderate", moderateApp);
api.route("/remove", removeApp);
api.route("/ratings", ratingsApp);

// The compact variant uses the same handler as /ratings
api.get(
  "/ratings_compact",
  describeRoute({
    tags: ["Ratings"],
    summary: "Get all ratings (compact)",
    description:
      "Alias for GET /ratings. Returns star ratings for all applications.",
    responses: {
      200: {
        description: "Map of app_id to rating breakdown",
        content: { "application/json": { schema: resolver(AllRatings) } },
      },
    },
  }),
  async (c) => {
    const { getAllRatings } = await import("../lib/ratings.js");
    const ratings = await getAllRatings();
    return c.json(ratings);
  },
);

// Vote routes are mounted at the top level (upvote, downvote, dismiss, report)
api.route("/", voteApp);

// GET /app/:app_id/:user_hash? is on the fetch module
api.route("/", fetchApp);

export default api;
