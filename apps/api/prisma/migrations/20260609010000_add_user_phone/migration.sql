-- Add optional phone identity for mobile app email/phone login.
ALTER TABLE "public"."users" ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "users_phone_key" ON "public"."users"("phone");
