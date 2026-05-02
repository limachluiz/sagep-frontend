import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { DashboardSummary } from '../models/dashboard.model';

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
}
