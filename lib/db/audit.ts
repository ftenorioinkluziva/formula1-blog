import { getDb } from "./client"
import { adminAuditLog } from "./schema"

export interface LogActionParams {
  actorUserId: string
  actorRole: string
  action: string
  targetType: string
  targetId?: string
  metadataJson?: Record<string, unknown>
}

export async function logAdminAction(params: LogActionParams): Promise<boolean> {
  const db = getDb()
  if (!db) {
    console.error("Could not write to audit log: DB unavailable.")
    return false
  }

  try {
    await db.insert(adminAuditLog).values({
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId || null,
      metadataJson: params.metadataJson || {},
    })
    return true
  } catch (error) {
    console.error("Failed to insert admin audit log:", error)
    return false
  }
}
