DROP INDEX "visits_one_open_service_uq";--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "tagline" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "company_reg_no" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "mobile" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "service_kind" text DEFAULT 'FIRE_ALARM' NOT NULL;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "service_date" date;--> statement-breakpoint
CREATE UNIQUE INDEX "visits_one_open_service_uq" ON "visits" USING btree ("site_id","service_kind") WHERE "visits"."type" = 'SERVICE' AND "visits"."status" IN ('DUE','BOOKED');