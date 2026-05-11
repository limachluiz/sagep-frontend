export interface AtaItemCoverageGroup {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
}

export interface AtaItemAtaSummary {
  id: string;
  ataCode?: number | null;
  number?: string | null;
  type?: string | null;
  vendorName?: string | null;
}

export interface AtaItemBalance {
  initialQuantity?: string | number | null;
  reservedQuantity?: string | number | null;
  consumedQuantity?: string | number | null;
  availableQuantity?: string | number | null;
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
  ataId?: string | null;
  ataCode?: number | null;
  ataNumber?: string | null;
  ata?: AtaItemAtaSummary | null;
  coverageGroupId?: string | null;
  coverageGroup?: AtaItemCoverageGroup | null;
  balance?: AtaItemBalance | null;
}

export interface AtaItemListResponse {
  items: AtaItem[];
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AtaItemUpdatePayload {
  coverageGroupCode?: string;
  referenceCode?: string;
  description?: string;
  unit?: string;
  unitPrice?: number;
  initialQuantity?: number;
  isActive?: boolean;
}
