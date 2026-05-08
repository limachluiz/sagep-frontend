export interface AuditActor {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface AuditLog {
  id?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  occurredAt?: string | null;
  timestamp?: string | null;
  date?: string | null;
  actor?: AuditActor | string | null;
  user?: AuditActor | string | null;
  performedBy?: AuditActor | string | null;
  actorName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  entity?: string | null;
  entityType?: string | null;
  entityName?: string | null;
  entityId?: string | null;
  resource?: string | null;
  tableName?: string | null;
  action?: string | null;
  event?: string | null;
  operation?: string | null;
  method?: string | null;
  summary?: string | null;
  description?: string | null;
  message?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditListResponse {
  items?: AuditLog[];
  data?: AuditLog[] | { items?: AuditLog[]; data?: AuditLog[]; results?: AuditLog[] };
  results?: AuditLog[];
  audits?: AuditLog[];
  logs?: AuditLog[];
  records?: AuditLog[];
  content?: AuditLog[];
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
