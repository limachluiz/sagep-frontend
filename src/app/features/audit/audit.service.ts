import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuditListResponse, AuditLog } from './audit.model';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<AuditListResponse | AuditLog[]>(`${this.apiUrl}/audits`);
  }
}
