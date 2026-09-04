import { prisma } from './db';

/**
 * Attendance decides whether someone keeps their membership, so every mutation
 * that touches attendance, roles, rules or removal leaves a row here. Actor
 * name is denormalized on purpose — the log has to stay readable after the
 * officer who wrote it graduates and their membership is gone.
 */
export async function writeAudit(input: {
  clubId: string;
  actorMembershipId?: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      clubId: input.clubId,
      actorMembershipId: input.actorMembershipId ?? null,
      actorName: input.actorName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      beforeJson: input.before === undefined ? null : JSON.stringify(input.before),
      afterJson: input.after === undefined ? null : JSON.stringify(input.after),
    },
  });
}
