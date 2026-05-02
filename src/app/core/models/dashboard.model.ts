export interface DashboardSummary {
  generatedAt: string;
  filters?: Record<string, unknown>;
  summary: Record<string, unknown>;
  alerts?: Record<string, unknown>;
  pendingByStage?: Record<string, unknown>;
  inventory?: {
    summary?: Record<string, unknown>;
    criticalItems?: Record<string, unknown>[];
    staleReservations?: Record<string, unknown>[];
    recentReversals?: Record<string, unknown>[];
  };
  operationalQueue?: Record<string, unknown>[];
  frequentNextActions?: Record<string, unknown>[];
  latestMovements?: Record<string, unknown>[];
}
