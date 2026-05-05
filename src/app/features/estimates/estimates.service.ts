import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { Estimate, EstimateListResponse, EstimateStatus } from './estimate.model';

export interface EstimateCreatePayload {
  projectId: string;
  ataId: string;
  coverageGroupId: string;
  omId: string;
  notes?: string;
  items: Array<{
    ataItemId: string;
    quantity: number;
  }>;
}

export interface EstimateListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: EstimateStatus | '';
  projectCode?: number | null;
  omCode?: number | null;
  cityName?: string;
  stateUf?: 'AM' | 'RO' | 'RR' | 'AC' | '';
}

@Injectable({ providedIn: 'root' })
export class EstimatesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list(params?: EstimateListParams) {
    let httpParams = new HttpParams();

    if (params?.page) httpParams = httpParams.set('page', params.page);
    if (params?.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.projectCode) httpParams = httpParams.set('projectCode', params.projectCode);
    if (params?.omCode) httpParams = httpParams.set('omCode', params.omCode);
    if (params?.cityName) httpParams = httpParams.set('cityName', params.cityName);
    if (params?.stateUf) httpParams = httpParams.set('stateUf', params.stateUf);

    return this.http.get<EstimateListResponse>(`${this.apiUrl}/estimates`, { params: httpParams });
  }

  getByCode(code: string) {
    return this.http.get<Estimate>(`${this.apiUrl}/estimates/code/${encodeURIComponent(code)}`);
  }

  getByIdentifier(estimateIdentifier: string) {
    return this.http.get<Estimate>(`${this.apiUrl}/estimates/${estimateIdentifier}`);
  }

  create(payload: EstimateCreatePayload) {
    return this.http.post<Estimate>(`${this.apiUrl}/estimates`, payload);
  }

  finalizeEstimate(id: string) {
    return this.http.patch<Estimate>(`${this.apiUrl}/estimates/${id}/status`, {
      status: 'FINALIZADA',
    });
  }
}
