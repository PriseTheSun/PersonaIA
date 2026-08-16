ALTER TABLE "User"
  DROP CONSTRAINT "User_avatar_size_check";

ALTER TABLE "User"
  ADD CONSTRAINT "User_avatar_size_check"
  CHECK ("avatarData" IS NULL OR octet_length("avatarData") <= 5242880);
