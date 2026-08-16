ALTER TABLE "User"
  ADD COLUMN "avatarData" BYTEA,
  ADD COLUMN "avatarMimeType" VARCHAR(32),
  ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);

ALTER TABLE "User"
  ADD CONSTRAINT "User_avatar_consistency_check"
  CHECK (
    ("avatarData" IS NULL AND "avatarMimeType" IS NULL AND "avatarUpdatedAt" IS NULL)
    OR
    ("avatarData" IS NOT NULL AND "avatarMimeType" IS NOT NULL AND "avatarUpdatedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "User_avatar_mime_check"
  CHECK ("avatarMimeType" IS NULL OR "avatarMimeType" IN ('image/jpeg', 'image/png')),
  ADD CONSTRAINT "User_avatar_size_check"
  CHECK ("avatarData" IS NULL OR octet_length("avatarData") <= 716800);
