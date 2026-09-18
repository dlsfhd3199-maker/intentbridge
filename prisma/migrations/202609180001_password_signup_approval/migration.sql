-- Additive migration: existing users, memberships and sessions remain intact.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
