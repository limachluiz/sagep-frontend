import { Project } from '../../core/models/project.model';

export interface ServiceOrderProjectSummary {
  id: string;
  projectCode: number;
  title: string;
  stage?: string | null;
  status?: string | null;
}

export interface ServiceOrderEstimateSummary {
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

export interface ServiceOrderDiexSummary {
  id: string;
  diexCode?: number | null;
  diexNumber?: string | null;
  issuedAt?: string | null;
}

export interface ServiceOrderItem {
  id: string;
  serviceOrderItemCode?: number | null;
  itemCode?: string | number | null;
  description: string;
  supplyUnit?: string | null;
  quantityOrdered?: string | number | null;
  unitPrice?: string | number | null;
  totalPrice?: string | number | null;
  notes?: string | null;
  estimateItem?: {
    id: string;
    estimateItemCode?: number | null;
  } | null;
}

export interface ServiceOrderScheduleItem {
  id: string;
  orderIndex: number;
  taskStep: string;
  scheduleText: string;
}

export interface ServiceOrderDeliveredDocument {
  id: string;
  description: string;
  isChecked?: boolean | null;
}

export interface ServiceOrder {
  id: string;
  serviceOrderCode: number;
  projectId: string;
  projectCode: number;
  estimateId: string;
  estimateCode: number;
  diexId?: string | null;
  diexCode?: number | null;
  serviceOrderNumber: string;
  issuedAt: string;
  contractorName?: string | null;
  contractorCnpj: string;
  commitmentNoteNumber?: string | null;
  requesterName?: string | null;
  requesterRank?: string | null;
  requesterCpf?: string | null;
  requesterRole?: string | null;
  issuingOrganization?: string | null;
  isEmergency?: boolean | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  requestingArea?: string | null;
  projectDisplayName?: string | null;
  projectAcronym?: string | null;
  contractNumber?: string | null;
  executionLocation?: string | null;
  executionHours?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactExtension?: string | null;
  contractTotalTerm?: string | null;
  originProcess?: string | null;
  contractorRepresentativeName?: string | null;
  contractorRepresentativeRole?: string | null;
  notes?: string | null;
  totalAmount?: string | number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  project?: ServiceOrderProjectSummary | Partial<Project> | null;
  estimate?: ServiceOrderEstimateSummary | null;
  diexRequest?: ServiceOrderDiexSummary | null;
  items?: ServiceOrderItem[];
  scheduleItems?: ServiceOrderScheduleItem[];
  deliveredDocuments?: ServiceOrderDeliveredDocument[];
}

export interface ServiceOrderListResponse {
  items: ServiceOrder[];
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

