import { Project } from '../../core/models/project.model';

export interface DiexProjectSummary {
  id: string;
  projectCode: number;
  title: string;
  stage?: string | null;
  status?: string | null;
}

export interface DiexEstimateSummary {
  id: string;
  estimateCode: number;
  status?: string | null;
  omName?: string | null;
  destinationCityName?: string | null;
  destinationStateUf?: string | null;
  totalAmount?: string | number | null;
  om?: {
    id: string;
    omCode: number;
    sigla: string;
    name: string;
    cityName: string;
    stateUf: string;
  } | null;
  ata?: {
    id: string;
    ataCode: number;
    number: string;
    type?: string | null;
    vendorName?: string | null;
  } | null;
}

export interface DiexItem {
  id: string;
  diexItemCode?: number | null;
  itemCode?: string | number | null;
  description: string;
  supplyUnit?: string | null;
  quantityRequested?: string | number | null;
  unitPrice?: string | number | null;
  totalPrice?: string | number | null;
  notes?: string | null;
  estimateItem?: {
    id: string;
    estimateItemCode?: number | null;
  } | null;
}

export interface Diex {
  id: string;
  diexCode: number;
  projectId: string;
  projectCode: number;
  estimateId: string;
  estimateCode: number;
  diexNumber?: string | null;
  issuedAt?: string | null;
  supplierCnpj: string;
  requesterName?: string | null;
  requesterRank?: string | null;
  requesterCpf?: string | null;
  requesterRole?: string | null;
  issuingOrganization?: string | null;
  commandName?: string | null;
  pregaoNumber?: string | null;
  uasg?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  totalAmount?: string | number | null;
  project?: DiexProjectSummary | Partial<Project> | null;
  estimate?: DiexEstimateSummary | null;
  items?: DiexItem[];
}

export interface DiexListResponse {
  items: Diex[];
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
