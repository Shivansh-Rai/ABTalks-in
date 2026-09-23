import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatAdminActionType } from "@/features/admin/get-overview-stats";
import { canonicalFullNameByUserId } from "@/repositories/candidate";

export const ADMIN_ACTIONS_PAGE_SIZE = 20;

export type AdminActionFilterType =
  | "all"
  | "grant_synergy"
  | "remark"
  | "reset_progress"
  | "other";

const REMARK_TYPES = ["ADD_REMARK", "UPDATE_REMARK", "DELETE_REMARK"] as const;
const NAMED_TYPES = [
  "GRANT_SYNERGY",
  "RESET_PROGRESS",
  ...REMARK_TYPES,
] as const;

function actionTypeWhere(
  type: AdminActionFilterType,
): Prisma.AdminActionWhereInput {
  if (type === "grant_synergy") return { actionType: "GRANT_SYNERGY" };
  if (type === "reset_progress") return { actionType: "RESET_PROGRESS" };
  if (type === "remark") return { actionType: { in: [...REMARK_TYPES] } };
  if (type === "other") return { actionType: { notIn: [...NAMED_TYPES] } };
  return {};
}

function displayName(
  profileName: string | null | undefined,
  email: string | null | undefined,
): string {
  return profileName?.trim() || email || "Unknown";
}

export function parseAdminActionFilterType(
  raw: string | undefined,
): AdminActionFilterType {
  if (
    raw === "grant_synergy" ||
    raw === "remark" ||
    raw === "reset_progress" ||
    raw === "other"
  ) {
    return raw;
  }
  return "all";
}

function searchWhere(q: string | null | undefined): Prisma.AdminActionWhereInput {
  const term = q?.trim();
  if (!term) return {};
  return {
    OR: [
      { actionType: { contains: term, mode: "insensitive" } },
      { entityId: term },
      { reason: { contains: term, mode: "insensitive" } },
      { actorUserId: term },
    ],
  };
}

export async function getAdminActionActors(): Promise<
  { id: string; name: string }[]
> {
  const groups = await prisma.adminAction.groupBy({
    by: ["adminUserId"],
    where: { adminUserId: { not: null } },
  });
  const ids = groups
    .map((g) => g.adminUserId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      email: true,
      candidateProfile: { select: { fullName: true } },
    },
  });

  const names = await canonicalFullNameByUserId(ids);
  return users
    .map((user) => ({
      id: user.id,
      name: displayName(names.get(user.id) ?? user.candidateProfile?.fullName, user.email),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAdminActionsFeed(input: {
  page?: number;
  type?: AdminActionFilterType;
  adminUserId?: string | null;
  q?: string | null;
}) {
  const page = Math.max(1, input.page ?? 1);
  const type = input.type ?? "all";
  const adminUserId = input.adminUserId?.trim() || null;
  const q = input.q?.trim() || null;

  const where: Prisma.AdminActionWhereInput = {
    AND: [
      actionTypeWhere(type),
      adminUserId ? { adminUserId } : {},
      searchWhere(q),
    ],
  };
  const skip = (page - 1) * ADMIN_ACTIONS_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    prisma.adminAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_ACTIONS_PAGE_SIZE,
      select: {
        id: true,
        actionType: true,
        reason: true,
        metadata: true,
        createdAt: true,
        actorUserId: true,
        entityType: true,
        entityId: true,
        admin: {
          select: {
            id: true,
            email: true,
            candidateProfile: { select: { fullName: true } },
          },
        },
        target: {
          select: {
            id: true,
            email: true,
            candidateProfile: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.adminAction.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_ACTIONS_PAGE_SIZE));

  const nameIds = [
    ...rows.map((row) => row.admin?.id),
    ...rows.map((row) => row.target?.id),
  ].filter((id): id is string => Boolean(id));
  const names = await canonicalFullNameByUserId(nameIds);

  return {
    items: rows.map((row) => {
      const targetUserId = row.target?.id ?? null;
      const targetName = row.target
        ? displayName(
            names.get(row.target.id) ?? row.target.candidateProfile?.fullName,
            row.target.email,
          )
        : [row.entityType, row.entityId].filter(Boolean).join(" ") || "—";
      return {
        id: row.id,
        actionType: row.actionType,
        actionLabel: formatAdminActionType(row.actionType),
        reason: row.reason,
        metadata: row.metadata,
        createdAt: row.createdAt,
        adminName: row.admin
          ? displayName(
              names.get(row.admin.id) ?? row.admin.candidateProfile?.fullName,
              row.admin.email,
            )
          : row.actorUserId,
        targetUserId,
        targetName,
      };
    }),
    total,
    page,
    pageSize: ADMIN_ACTIONS_PAGE_SIZE,
    totalPages,
    type,
    adminUserId,
    q,
  };
}
