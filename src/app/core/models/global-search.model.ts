export type GlobalSearchKind =
  | 'project'
  | 'estimate'
  | 'diex'
  | 'service_order';

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchKind;
  typeLabel: string;
  title: string;
  code: string;
  subtitle: string;
  route: string[];
}

export interface GlobalSearchGroup {
  key: GlobalSearchKind;
  label: string;
  items: GlobalSearchResult[];
}

export type GlobalSearchApiItem = Record<string, unknown>;

export type GlobalSearchApiResponse =
  | GlobalSearchApiItem[]
  | {
      groups?: {
        projects?: GlobalSearchApiItem[];
        estimates?: GlobalSearchApiItem[];
        diexRequests?: GlobalSearchApiItem[];
        serviceOrders?: GlobalSearchApiItem[];
      };
      total?: number;
      [key: string]: unknown;
    };
