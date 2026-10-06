-- Plan 169. The partial unique index that makes one live grant per
-- (user, role, scope) a database invariant rather than a convention.
--
-- Prisma cannot express a partial unique index, so `schema.prisma` carries it
-- only as a comment on `UserRoleAssignment` and it was applied to the live
-- hosts by hand. That left every rebuilt environment without it, so the
-- read-then-create in `grantPlatformAdminAction` and `recruiterIdentityWrites`
-- had nothing underneath it and a concurrent request could produce two live
-- rows for the same role.
--
-- IF NOT EXISTS: both production hosts already have this index under this
-- exact name, so this is expected to be a no-op there.
CREATE UNIQUE INDEX IF NOT EXISTS "role_assignment_active_unique"
  ON "UserRoleAssignment" ("userId", "role", "scopeType", COALESCE("scopeId", ''))
  WHERE "revokedAt" IS NULL;
