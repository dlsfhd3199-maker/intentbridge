-- Preserve users, passwords, sessions, and N:N membership rows.
UPDATE "User" SET "role" = 'SUPER_ADMIN' WHERE "role" = 'ADMIN';
UPDATE "AdvertiserMember" SET "role" = 'SUPER_ADMIN' WHERE "role" = 'ADMIN';
