export interface MilitaryOrganizationEstimateSummary {
  id: string;
  estimateCode?: number | string | null;
  status?: string | null;
  totalAmount?: string | number | null;
  createdAt?: string | null;
  project?: {
    id?: string | null;
    projectCode?: number | string | null;
    title?: string | null;
  } | null;
}

export interface MilitaryOrganization {
  id: string;
  omCode?: number | null;
  sigla?: string | null;
  name?: string | null;
  cityName?: string | null;
  stateUf?: string | null;
  isActive?: boolean | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  estimates?: MilitaryOrganizationEstimateSummary[] | null;
}

export interface MilitaryOrganizationListResponse {
  items: MilitaryOrganization[];
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
