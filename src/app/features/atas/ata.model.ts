export interface AtaCoverageGroup {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  localities?: AtaCoverageLocality[];
}

export interface AtaCoverageLocality {
  id?: string | null;
  cityName?: string | null;
  stateUf?: AtaCoverageStateUf | null;
  createdAt?: string | null;
}

export type AtaCoverageStateUf = 'AM' | 'RO' | 'RR' | 'AC';

export interface AtaCoverageGroupPayload {
  code?: string;
  name: string;
  description?: string;
  localities: AtaCoverageLocalityPayload[];
}

export interface AtaCoverageGroupUpdatePayload {
  code?: string;
  name?: string;
  description?: string;
  localities?: AtaCoverageLocalityPayload[];
}

export interface AtaCoverageLocalityPayload {
  cityName: string;
  stateUf: AtaCoverageStateUf;
}

export interface Ata {
  id: string;
  ataCode?: number | null;
  number?: string | null;
  type?: string | null;
  vendorName?: string | null;
  managingAgency?: string | null;
  managerAgency?: string | null;
  observations?: string | null;
  notes?: string | null;
  isActive?: boolean | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  coverageGroups?: AtaCoverageGroup[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AtaPayload {
  number: string;
  type: 'CFTV' | 'FIBRA_OPTICA';
  vendorName: string;
  managingAgency?: string;
  startDate?: string;
  endDate?: string;
  observations?: string;
  isActive?: boolean;
}

export interface AtaItemBalance {
  initialQuantity?: string | number | null;
  reservedQuantity?: string | number | null;
  consumedQuantity?: string | number | null;
  availableQuantity?: string | number | null;
  initialAmount?: string | number | null;
  reservedAmount?: string | number | null;
  consumedAmount?: string | number | null;
  availableAmount?: string | number | null;
  lowStock?: boolean | null;
  insufficient?: boolean | null;
  lastMovementAt?: string | null;
}

export interface AtaItem {
  id: string;
  ataItemCode?: number | null;
  referenceCode?: string | null;
  description?: string | null;
  unit?: string | null;
  unitPrice?: string | number | null;
  initialQuantity?: string | number | null;
  isActive?: boolean | null;
  deletedAt?: string | null;
  coverageGroupId?: string | null;
  coverageGroup?: AtaCoverageGroup | null;
  balance?: AtaItemBalance | null;
}

export interface AtaListResponse {
  items: Ata[];
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
