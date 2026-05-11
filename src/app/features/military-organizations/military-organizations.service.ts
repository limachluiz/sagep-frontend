import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  MilitaryOrganization,
  MilitaryOrganizationListResponse,
  MilitaryOrganizationPayload,
  MilitaryOrganizationUpdatePayload,
} from './military-organization.model';

@Injectable({ providedIn: 'root' })
export class MilitaryOrganizationsFeatureService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<MilitaryOrganizationListResponse | MilitaryOrganization[]>(
      `${this.apiUrl}/military-organizations`,
    );
  }

  getById(id: string) {
    return this.http.get<MilitaryOrganization>(`${this.apiUrl}/military-organizations/${encodeURIComponent(id)}`);
  }

  create(payload: MilitaryOrganizationPayload) {
    return this.http.post<MilitaryOrganization>(`${this.apiUrl}/military-organizations`, payload);
  }

  update(id: string, payload: MilitaryOrganizationUpdatePayload) {
    return this.http.patch<MilitaryOrganization>(
      `${this.apiUrl}/military-organizations/${encodeURIComponent(id)}`,
      payload,
    );
  }

  delete(id: string) {
    return this.http.delete(`${this.apiUrl}/military-organizations/${encodeURIComponent(id)}`);
  }
}
