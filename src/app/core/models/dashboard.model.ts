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

export interface ExecutiveDashboardSummary {
  generatedAt?: string;
  filters?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  projects?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  byStatus?: Record<string, unknown>;
  byStage?: Record<string, unknown>;
  valueByStatus?: Record<string, unknown>;
  valueByStage?: Record<string, unknown>;
  projectsByUf?: Record<string, unknown>;
  projectsByRegion?: Record<string, unknown>;
  documents?: Record<string, unknown>;
  issuedDocuments?: Record<string, unknown>;
  ata?: Record<string, unknown>;
  ataBalance?: Record<string, unknown>;
  risks?: Record<string, unknown>;
  topProjects?: Record<string, unknown>[];
  projectsAtRisk?: Record<string, unknown>[];
  criticalActions?: Record<string, unknown>[];
  nextCriticalActions?: Record<string, unknown>[];
  criticalAtaItems?: Record<string, unknown>[];
  relevantAlerts?: Record<string, unknown>[];
  alerts?: Record<string, unknown>[] | Record<string, unknown>;
  latestMovements?: Record<string, unknown>[];
  movements?: Record<string, unknown>[];
  projectsSummary?: Record<string, unknown>[];
  projectSummaries?: Record<string, unknown>[];
  timeline?: Record<string, unknown>[] | Record<string, unknown>;
  evolution?: Record<string, unknown>[] | Record<string, unknown>;
  timeSeries?: Record<string, unknown>[] | Record<string, unknown>;
  bySupplier?: Record<string, unknown>;
  byAtaType?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExecutiveDashboardFilters {
  periodType?: 'month' | 'quarter' | 'semester' | 'year';
  referenceDate?: string;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
}
