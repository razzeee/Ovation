export const config = {
  database: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://ovation:ovationpasswd@localhost:5432/ovation",
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    expiresIn: "24h",
  },
  reviewsSecret: process.env.REVIEWS_SECRET ?? "1",
  sentry: {
    dsn: process.env.SENTRY_DSN ?? "",
  },
  server: {
    port: Number.parseInt(process.env.PORT ?? "8080", 10),
  },
  env: (process.env.NODE_ENV ?? "development") as
    | "development"
    | "production"
    | "test",

  /** Number of years after which reviews are considered too old */
  cutoffYears: 5,
  /** Number of reports before a review is hidden */
  reportedThreshold: 2,
} as const;
