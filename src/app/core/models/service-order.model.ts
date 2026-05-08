export interface ServiceOrderScheduleItem {
  orderIndex: number;
  taskStep: string;
  scheduleText: string;
}

export interface ServiceOrderDeliveredDocument {
  description: string;
  isChecked?: boolean | null;
}

export interface ServiceOrder {
  id: string;
  serviceOrderCode?: number | null;
  projectId?: string | null;
  projectCode?: number | null;
  estimateId?: string | null;
  estimateCode?: number | null;
  diexId?: string | null;
  diexCode?: number | null;
  serviceOrderNumber: string;
  issuedAt: string;
  contractorCnpj: string;
  requesterName?: string | null;
  requesterRank?: string | null;
  requesterCpf?: string | null;
  requesterRole?: string | null;
  issuingOrganization?: string | null;
  isEmergency?: boolean | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  notes?: string | null;
  scheduleItems?: ServiceOrderScheduleItem[];
  deliveredDocuments?: ServiceOrderDeliveredDocument[];
  archivedAt?: string | null;
  deletedAt?: string | null;
}

export interface ServiceOrderCreatePayload {
  projectId?: string;
  projectCode?: number;
  estimateId?: string;
  estimateCode?: number;
  diexId?: string;
  diexCode?: number;
  issuedAt: string;
  contractorCnpj: string;
  requesterName?: string;
  requesterRank?: string;
  requesterCpf?: string;
  requesterRole?: string;
  issuingOrganization?: string;
  isEmergency?: boolean;
  plannedStartDate?: string;
  plannedEndDate?: string;
  notes?: string;
}
