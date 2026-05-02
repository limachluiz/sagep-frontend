import { User } from './auth.model';

export type ProjectStatus =
  | 'PLANEJAMENTO'
  | 'EM_ANDAMENTO'
  | 'PAUSADO'
  | 'CONCLUIDO'
  | 'CANCELADO';

export type ProjectStage =
  | 'ESTIMATIVA_PRECO'
  | 'AGUARDANDO_NOTA_CREDITO'
  | 'DIEX_REQUISITORIO'
  | 'AGUARDANDO_NOTA_EMPENHO'
  | 'OS_LIBERADA'
  | 'SERVICO_EM_EXECUCAO'
  | 'ANALISANDO_AS_BUILT'
  | 'ATESTAR_NF'
  | 'SERVICO_CONCLUIDO'
  | 'CANCELADO';

export interface Project {
  id: string;
  projectCode: number;
  title: string;
  description?: string | null;
  status: ProjectStatus;
  stage: ProjectStage;
  ownerId?: string | null;
  ownerName?: string | null;
  owner?: Partial<User> | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  members?: Array<{
    id: string;
    role?: string;
    user?: Partial<User>;
  }>;
  estimates?: Array<Record<string, unknown>>;
}

export interface ProjectDetails {
  project: Project & {
    owner?: Partial<User> | null;
    members?: Array<{
      id: string;
      role?: string;
      user?: Partial<User>;
    }>;
  };
  workflow: {
    status: ProjectStatus;
    stage: ProjectStage;
    nextAction?: {
      code?: string;
      label?: string;
      description?: string;
      [key: string]: unknown;
    };
    milestones?: Record<string, unknown>;
    [key: string]: unknown;
  };
  pendingActions: Array<Record<string, unknown>>;
  timeline: ProjectTimelineItem[];
  documents: {
    estimates?: Array<Record<string, unknown>>;
    diexRequests?: Array<Record<string, unknown>>;
    serviceOrders?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  financialSummary?: Record<string, unknown>;
  operationalSummary?: Record<string, unknown>;
}

export interface ProjectTimelineItem {
  id: string;
  at: string;
  action: string;
  label: string;
  summary?: string | null;
  actorName?: string | null;
  entityType: string;
  entityId: string;
  source?: string | null;
  context?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ProjectListResponse {
  items: Project[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters?: Record<string, unknown>;
  links?: {
    self: string;
  };
}
