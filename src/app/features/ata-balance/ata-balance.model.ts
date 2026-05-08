export interface AtaBalanceAtaSummary {
  id: string;
  ataCode?: number | null;
  number?: string | null;
  type?: string | null;
  vendorName?: string | null;
}

export interface AtaBalanceCoverageGroup {
  id: string;
  code?: string | null;
  name?: string | null;
}

export interface AtaBalanceValues {
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

export interface AtaBalanceMovement {
  id?: string | null;
  type?: string | null;
  movementType?: string | null;
  summary?: string | null;
  description?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  totalPrice?: string | number | null;
  amount?: string | number | null;
  balanceAfter?: string | number | null;
  actorName?: string | null;
  actor?: {
    id?: string | null;
    name?: string | null;
    fullName?: string | null;
  } | null;
  projectCode?: string | number | null;
  projectNumber?: string | null;
  project?: {
    id?: string | null;
    projectCode?: string | number | null;
    title?: string | null;
  } | null;
  estimateCode?: string | number | null;
  estimate?: {
    id?: string | null;
    estimateCode?: string | number | null;
  } | null;
  diexCode?: string | number | null;
  diexNumber?: string | null;
  diex?: {
    id?: string | null;
    diexCode?: string | number | null;
    diexNumber?: string | null;
  } | null;
  serviceOrderCode?: string | number | null;
  serviceOrderNumber?: string | null;
  serviceOrder?: {
    id?: string | null;
    serviceOrderCode?: string | number | null;
    serviceOrderNumber?: string | null;
  } | null;
  createdAt?: string | null;
  occurredAt?: string | null;
  source?: string | null;
  documentNumber?: string | null;
}

export interface AtaBalanceMovementListResponse {
  items: AtaBalanceMovement[];
}

export interface AtaBalanceItem {
  id: string;
  ataItemCode?: number | null;
  referenceCode?: string | null;
  description?: string | null;
  unit?: string | null;
  unitPrice?: string | number | null;
  initialQuantity?: string | number | null;
  isActive?: boolean | null;
  deletedAt?: string | null;
  ataId?: string | null;
  ataCode?: number | null;
  ataNumber?: string | null;
  ata?: AtaBalanceAtaSummary | null;
  coverageGroupId?: string | null;
  coverageGroup?: AtaBalanceCoverageGroup | null;
  balance?: AtaBalanceValues | null;
}

export interface AtaBalanceListResponse {
  items: AtaBalanceItem[];
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
