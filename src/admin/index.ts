import { Hono } from "hono";
import componentsApp from "./components.js";
import loginApp from "./login.js";
import moderatorsApp from "./moderators.js";
import reviewsApp from "./reviews.js";
import statsApp from "./stats.js";
import taboosApp from "./taboos.js";
import usersApp from "./users.js";

/**
 * All admin API routes mounted under /admin/api.
 *
 * Public (no auth):
 *   POST /admin/api/login
 *
 * Authenticated:
 *   /admin/api/reviews/*
 *   /admin/api/moderators/*
 *   /admin/api/taboos/*       (admin only)
 *   /admin/api/components/*   (admin only)
 *   /admin/api/stats/*        (admin only)
 *   /admin/api/users/*        (admin only)
 */
const admin = new Hono();

// Login is unauthenticated
admin.route("/", loginApp);

// Authenticated admin routes
admin.route("/reviews", reviewsApp);
admin.route("/moderators", moderatorsApp);
admin.route("/taboos", taboosApp);
admin.route("/components", componentsApp);
admin.route("/stats", statsApp);
admin.route("/users", usersApp);

export default admin;
