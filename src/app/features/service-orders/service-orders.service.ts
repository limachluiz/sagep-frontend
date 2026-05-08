import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ServiceOrder, ServiceOrderListResponse } from './service-order.model';

export interface ServiceOrderListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  code?: number | null;
  projectCode?: number | null;
  estimateCode?: number | null;
  diexCode?: number | null;
  emergency?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class ServiceOrdersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list(params?: ServiceOrderListParams) {
    let httpParams = new HttpParams();

    if (params?.page) httpParams = httpParams.set('page', params.page);
    if (params?.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.code) httpParams = httpParams.set('code', params.code);
    if (params?.projectCode) httpParams = httpParams.set('projectCode', params.projectCode);
    if (params?.estimateCode) httpParams = httpParams.set('estimateCode', params.estimateCode);
    if (params?.diexCode) httpParams = httpParams.set('diexCode', params.diexCode);
    if (params?.emergency !== null && params?.emergency !== undefined) {
      httpParams = httpParams.set('emergency', params.emergency);
    }

    return this.http.get<ServiceOrderListResponse>(`${this.apiUrl}/service-orders`, { params: httpParams });
  }

  getById(id: string) {
    return this.http.get<ServiceOrder>(`${this.apiUrl}/service-orders/${encodeURIComponent(id)}`);
  }

  getByCode(code: string | number) {
    return this.http.get<ServiceOrder>(`${this.apiUrl}/service-orders/code/${encodeURIComponent(String(code))}`);
  }

  getByNumber(serviceOrderNumber: string) {
    return this.http.get<ServiceOrder>(`${this.apiUrl}/service-orders/number/${encodeURIComponent(serviceOrderNumber)}`);
  }

  getDocumentHtml(id: string) {
    return this.http.get(`${this.apiUrl}/service-orders/${encodeURIComponent(id)}/document/html`, {
      responseType: 'text',
    });
  }

  getDocumentPdf(id: string) {
    return this.http.get(`${this.apiUrl}/service-orders/${encodeURIComponent(id)}/document/pdf`, {
      responseType: 'blob',
    });
  }
}

