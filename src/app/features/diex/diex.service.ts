import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { Diex, DiexListResponse } from './diex.model';

export interface DiexListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  code?: number | null;
  projectCode?: number | null;
  estimateCode?: number | null;
}

@Injectable({ providedIn: 'root' })
export class DiexService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list(params?: DiexListParams) {
    let httpParams = new HttpParams();

    if (params?.page) httpParams = httpParams.set('page', params.page);
    if (params?.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.code) httpParams = httpParams.set('code', params.code);
    if (params?.projectCode) httpParams = httpParams.set('projectCode', params.projectCode);
    if (params?.estimateCode) httpParams = httpParams.set('estimateCode', params.estimateCode);

    return this.http.get<DiexListResponse>(`${this.apiUrl}/diex`, { params: httpParams });
  }

  getById(id: string) {
    return this.http.get<Diex>(`${this.apiUrl}/diex/${encodeURIComponent(id)}`);
  }

  getByCode(code: string) {
    return this.http.get<Diex>(`${this.apiUrl}/diex/code/${encodeURIComponent(code)}`);
  }

  getDocumentHtml(id: string) {
    return this.http.get(`${this.apiUrl}/diex/${encodeURIComponent(id)}/document/html`, {
      responseType: 'text',
    });
  }

  getDocumentPdf(id: string) {
    return this.http.get(`${this.apiUrl}/diex/${encodeURIComponent(id)}/document/pdf`, {
      responseType: 'blob',
    });
  }
}

