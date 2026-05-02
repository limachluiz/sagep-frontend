export type EstimateStatus = 'RASCUNHO' | 'FINALIZADA' | 'CANCELADA';

export interface EstimateProjectSummary {
  id: string;
  projectCode: number;
  title: string;
  status?: string;
  ownerId?: string | null;
}

export interface EstimateAtaSummary {
  id: string;
  ataCode: number;
  number: string;
  type?: string;
  vendorName?: string | null;
  isActive?: boolean;
}

export interface EstimateCoverageLocality {
  id: string;
  cityName: string;
  stateUf: string;
}

export interface EstimateCoverageGroup {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  localities?: EstimateCoverageLocality[];
}

export interface EstimateOmSummary {
  id: string;
  omCode: number;
  sigla: string;
  name: string;
  cityName: string;
  stateUf: string;
  isActive?: boolean;
}

export interface EstimateAtaItemBalance {
  initialQuantity?: string | number;
  reservedQuantity?: string | number;
  consumedQuantity?: string | number;
  availableQuantity?: string | number;
  initialAmount?: string | number;
  reservedAmount?: string | number;
  consumedAmount?: string | number;
  availableAmount?: string | number;
  lowStock?: boolean;
  insufficient?: boolean;
  lastMovementAt?: string | null;
}

export interface EstimateAtaItemSummary {
  id: string;
  ataItemCode: number;
  referenceCode: string;
  description: string;
  unit: string;
  unitPrice: string | number;
  initialQuantity?: string | number;
  isActive?: boolean;
  deletedAt?: string | null;
  balance?: EstimateAtaItemBalance | null;
}

export interface EstimateItem {
  id: string;
  estimateItemCode: number;
  referenceCode: string;
  description: string;
  unit: string;
  quantity: string | number;
  unitPrice: string | number;
  subtotal: string | number;
  notes?: string | null;
  ataItem?: EstimateAtaItemSummary;
}

export interface Estimate {
  id: string;
  estimateCode: number;
  projectId: string;
  projectCode: number;
  status: EstimateStatus;
  notes?: string | null;
  totalAmount?: string | number | null;
  omName?: string | null;
  destinationCityName?: string | null;
  destinationStateUf?: string | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  project?: EstimateProjectSummary;
  ata?: EstimateAtaSummary;
  coverageGroup?: EstimateCoverageGroup;
  om?: EstimateOmSummary | null;
  items?: EstimateItem[];
}

export interface EstimateListResponse {
  items: Estimate[];
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
