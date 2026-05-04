export interface MilitaryOrganization {
  id: string;
  omCode?: number | null;
  sigla?: string | null;
  name?: string | null;
  cityName?: string | null;
  stateUf?: string | null;
  isActive?: boolean | null;
}

export interface MilitaryOrganizationListResponse {
  items: MilitaryOrganization[];
}
