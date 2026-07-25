import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatAdminActionType } from "@/features/admin/get-overview-stats";

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

export async function getAdminActionActors(): Promise<
  { id: string; name: string }[]
> {
  const groups = await prisma.adminAction.groupBy({
    by: ["adminUserId"],
  });
  if (groups.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: groups.map((g) => g.adminUserId) } },
    select: {
      id: true,
      email: true,
      studentProfile: { select: { fullName: true } },
    },
  });

  return users
    .map((user) => ({
      id: user.id,
      name: displayName(user.studentProfile?.fullName, user.email),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAdminActionsFeed(input: {
  page?: number;
  type?: AdminActionFilterType;
  adminUserId?: string | null;
}) {
  const page = Math.max(1, input.page ?? 1);
  const type = input.type ?? "all";
  const adminUserId = input.adminUserId?.trim() || null;

  const where: Prisma.AdminActionWhereInput = {
    ...actionTypeWhere(type),
    ...(adminUserId ? { adminUserId } : {}),
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
        admin: {
          select: {
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
        target: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.adminAction.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_ACTIONS_PAGE_SIZE));

  return {
    items: rows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      actionLabel: formatAdminActionType(row.actionType),
      reason: row.reason,
      metadata: row.metadata,
      createdAt: row.createdAt,
      adminName: displayName(row.admin.studentProfile?.fullName, row.admin.email),
      targetUserId: row.target.id,
      targetName: displayName(
        row.target.studentProfile?.fullName,
        row.target.email,
      ),
    })),
    total,
    page,
    pageSize: ADMIN_ACTIONS_PAGE_SIZE,
    totalPages,
    type,
    adminUserId,
  };
}
