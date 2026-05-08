import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  DashboardSummary,
  ExecutiveDashboardFilters,
  ExecutiveDashboardSummary,
} from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getOperationalDashboard(filters?: { staleDays?: number; limit?: number }) {
    let params = new HttpParams();

    if (filters?.staleDays) {
      params = params.set('staleDays', filters.staleDays);
    }

    if (filters?.limit) {
      params = params.set('limit', filters.limit);
    }

    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard/operational`, { params });
  }

  getExecutiveDashboard(filters?: ExecutiveDashboardFilters) {
    let params = new HttpParams();

    if (filters?.periodType) {
      params = params.set('periodType', filters.periodType);
    }

    if (filters?.referenceDate) {
      params = params.set('referenceDate', filters.referenceDate);
    }

    if (filters?.startDate) {
      params = params.set('startDate', filters.startDate);
    }

    if (filters?.endDate) {
      params = params.set('endDate', filters.endDate);
    }

    if (filters?.asOfDate) {
      params = params.set('asOfDate', filters.asOfDate);
    }

    return this.http.get<ExecutiveDashboardSummary>(`${this.apiUrl}/dashboard/executive`, {
      params,
    });
  }
}
