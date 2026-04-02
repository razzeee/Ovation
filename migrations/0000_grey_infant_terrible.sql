CREATE TABLE "analytics" (
	"datestr" integer NOT NULL,
	"app_id" varchar(128) NOT NULL,
	"fetch_cnt" integer DEFAULT 1,
	CONSTRAINT "analytics_datestr_app_id_pk" PRIMARY KEY("datestr","app_id")
);
--> statement-breakpoint
CREATE TABLE "components" (
	"component_id" serial PRIMARY KEY NOT NULL,
	"component_id_parent" integer,
	"app_id" text,
	"fetch_cnt" integer DEFAULT 0,
	"review_cnt" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "eventlog" (
	"eventlog_id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"user_addr" text,
	"user_id" integer,
	"message" text,
	"app_id" text,
	"important" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "moderators" (
	"moderator_id" serial PRIMARY KEY NOT NULL,
	"username" text,
	"password" text,
	"display_name" text,
	"is_enabled" boolean DEFAULT false,
	"is_admin" boolean DEFAULT false,
	"user_id" integer,
	"locales" text
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"review_id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_deleted" timestamp with time zone,
	"component_id" integer NOT NULL,
	"locale" text,
	"summary" text,
	"description" text,
	"user_id" integer,
	"user_addr" text,
	"user_display" text,
	"version" text,
	"distro" text,
	"rating" integer DEFAULT 0,
	"karma_up" integer DEFAULT 0,
	"karma_down" integer DEFAULT 0,
	"reported" integer DEFAULT 0,
	CONSTRAINT "rating_constraint" CHECK (rating >= 0 AND rating <= 100)
);
--> statement-breakpoint
CREATE TABLE "taboos" (
	"taboo_id" serial PRIMARY KEY NOT NULL,
	"locale" varchar(8) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"severity" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"user_hash" varchar(40),
	"karma" integer DEFAULT 0,
	"is_banned" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"vote_id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"review_id" integer,
	"user_id" integer,
	"val" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_component_id_parent_components_component_id_fk" FOREIGN KEY ("component_id_parent") REFERENCES "public"."components"("component_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventlog" ADD CONSTRAINT "eventlog_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderators" ADD CONSTRAINT "moderators_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_component_id_components_component_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("component_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_review_id_reviews_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_datestr_app_id_idx" ON "analytics" USING btree ("datestr","app_id");--> statement-breakpoint
CREATE INDEX "eventlog_date_created_idx" ON "eventlog" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "eventlog_message_idx" ON "eventlog" USING btree ("message");--> statement-breakpoint
CREATE INDEX "reviews_date_created_idx" ON "reviews" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "reviews_reported_idx" ON "reviews" USING btree ("reported");--> statement-breakpoint
CREATE INDEX "taboos_locale_idx" ON "taboos" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "users_hash_idx" ON "users" USING btree ("user_hash");