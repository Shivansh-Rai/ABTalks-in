import { prisma } from "@/lib/db";
import type { JobRow, JobStore } from "./service";

const SELECT = {
  id: true,
  title: true,
  company: true,
  description: true,
  location: true,
  workMode: true,
  type: true,
  skills: true,
  status: true,
  isOpen: true,
  recruiterId: true,
  createdByAdminId: true,
  publishedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  applyExternalUrl: true,
} as const;

export function prismaJobStore(): JobStore {
  return {
    async create({ data }): Promise<JobRow> {
      return prisma.job.create({ data, select: SELECT });
    },
    async findById(id: string): Promise<JobRow | null> {
      return prisma.job.findUnique({ where: { id }, select: SELECT });
    },
    async update(id: string, patch): Promise<JobRow> {
      return prisma.job.update({ where: { id }, data: patch, select: SELECT });
    },
    async listByRecruiter(recruiterId: string): Promise<JobRow[]> {
      return prisma.job.findMany({
        where: { recruiterId },
        orderBy: { createdAt: "desc" },
        select: SELECT,
      });
    },
  };
}
