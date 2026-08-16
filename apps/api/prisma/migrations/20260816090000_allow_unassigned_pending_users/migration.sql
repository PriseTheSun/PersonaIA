-- A standard identity can exist without a legacy tenant while it waits for a
-- Super Admin to assign its first organization. Only SUPER_ADMIN identities
-- are required to remain global permanently.
ALTER TABLE "User"
DROP CONSTRAINT IF EXISTS "super_admin_has_no_tenant";

ALTER TABLE "User"
ADD CONSTRAINT "super_admin_has_no_tenant"
CHECK ("role" <> 'SUPER_ADMIN' OR "tenantId" IS NULL);
