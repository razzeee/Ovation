import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analytics = pgTable(
	"analytics",
	{
		datestr: integer("datestr").notNull(),
		appId: varchar("app_id", { length: 128 }).notNull(),
		fetchCnt: integer("fetch_cnt").default(1),
	},
	(table) => [
		primaryKey({ columns: [table.datestr, table.appId] }),
		uniqueIndex("analytics_datestr_app_id_idx").on(table.datestr, table.appId),
	],
);

// ─── Taboos ──────────────────────────────────────────────────────────────────

export const taboos = pgTable(
	"taboos",
	{
		tabooId: serial("taboo_id").primaryKey(),
		locale: varchar("locale", { length: 8 }).notNull(),
		value: text("value").notNull(),
		description: text("description"),
		severity: integer("severity").default(0),
	},
	(table) => [index("taboos_locale_idx").on(table.locale)],
);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
	"users",
	{
		userId: serial("user_id").primaryKey(),
		dateCreated: timestamp("date_created", { withTimezone: true }).notNull().defaultNow(),
		userHash: varchar("user_hash", { length: 40 }),
		karma: integer("karma").default(0),
		isBanned: boolean("is_banned").default(false),
	},
	(table) => [index("users_hash_idx").on(table.userHash)],
);

export const usersRelations = relations(users, ({ many }) => ({
	reviews: many(reviews),
	votes: many(votes),
}));

// ─── Components ──────────────────────────────────────────────────────────────

export const components = pgTable("components", {
	componentId: serial("component_id").primaryKey(),
	componentIdParent: integer("component_id_parent").references(
		(): AnyPgColumn => components.componentId,
	),
	appId: text("app_id"),
	fetchCnt: integer("fetch_cnt").default(0),
	reviewCnt: integer("review_cnt").default(1),
});

export const componentsRelations = relations(components, ({ one, many }) => ({
	parent: one(components, {
		fields: [components.componentIdParent],
		references: [components.componentId],
		relationName: "parent_child",
	}),
	children: many(components, { relationName: "parent_child" }),
	reviews: many(reviews),
}));

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviews = pgTable(
	"reviews",
	{
		reviewId: serial("review_id").primaryKey(),
		dateCreated: timestamp("date_created", { withTimezone: true }).notNull().defaultNow(),
		dateDeleted: timestamp("date_deleted", { withTimezone: true }),
		componentId: integer("component_id")
			.notNull()
			.references(() => components.componentId),
		locale: text("locale"),
		summary: text("summary"),
		description: text("description"),
		userId: integer("user_id").references(() => users.userId),
		userAddrHash: text("user_addr"),
		userDisplay: text("user_display"),
		version: text("version"),
		distro: text("distro"),
		rating: integer("rating").default(0),
		karmaUp: integer("karma_up").default(0),
		karmaDown: integer("karma_down").default(0),
		reported: integer("reported").default(0),
	},
	(table) => [
		check("rating_constraint", sql`rating >= 0 AND rating <= 100`),
		index("reviews_date_created_idx").on(table.dateCreated),
		index("reviews_reported_idx").on(table.reported),
	],
);

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
	user: one(users, {
		fields: [reviews.userId],
		references: [users.userId],
	}),
	component: one(components, {
		fields: [reviews.componentId],
		references: [components.componentId],
	}),
	votes: many(votes),
}));

// ─── Votes ───────────────────────────────────────────────────────────────────

export const votes = pgTable("votes", {
	voteId: serial("vote_id").primaryKey(),
	dateCreated: timestamp("date_created", { withTimezone: true }).notNull().defaultNow(),
	reviewId: integer("review_id").references(() => reviews.reviewId),
	userId: integer("user_id").references(() => users.userId),
	val: integer("val").default(0),
});

export const votesRelations = relations(votes, ({ one }) => ({
	review: one(reviews, {
		fields: [votes.reviewId],
		references: [reviews.reviewId],
	}),
	user: one(users, {
		fields: [votes.userId],
		references: [users.userId],
	}),
}));

// ─── Event Log ───────────────────────────────────────────────────────────────

export const eventlog = pgTable(
	"eventlog",
	{
		eventlogId: serial("eventlog_id").primaryKey(),
		dateCreated: timestamp("date_created", { withTimezone: true }).notNull().defaultNow(),
		userAddr: text("user_addr"),
		userId: integer("user_id").references(() => users.userId),
		message: text("message"),
		appId: text("app_id"),
		important: boolean("important").default(false),
	},
	(table) => [
		index("eventlog_date_created_idx").on(table.dateCreated),
		index("eventlog_message_idx").on(table.message),
	],
);

export const eventlogRelations = relations(eventlog, ({ one }) => ({
	user: one(users, {
		fields: [eventlog.userId],
		references: [users.userId],
	}),
}));

// ─── Moderators ──────────────────────────────────────────────────────────────

export const moderators = pgTable("moderators", {
	moderatorId: serial("moderator_id").primaryKey(),
	username: text("username"),
	passwordHash: text("password"),
	displayName: text("display_name"),
	isEnabled: boolean("is_enabled").default(false),
	isAdmin: boolean("is_admin").default(false),
	userId: integer("user_id").references(() => users.userId),
	locales: text("locales"),
});

export const moderatorsRelations = relations(moderators, ({ one }) => ({
	user: one(users, {
		fields: [moderators.userId],
		references: [users.userId],
	}),
}));
