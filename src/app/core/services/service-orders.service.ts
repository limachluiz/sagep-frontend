import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ServiceOrder, ServiceOrderCreatePayload } from '../models/service-order.model';

@Injectable({ providedIn: 'root' })
export class ServiceOrdersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  createServiceOrder(payload: ServiceOrderCreatePayload) {
    return this.http.post<ServiceOrder>(`${this.apiUrl}/service-orders`, payload);
  }
}
