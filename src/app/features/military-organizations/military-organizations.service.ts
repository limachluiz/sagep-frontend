import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { MilitaryOrganization, MilitaryOrganizationListResponse } from './military-organization.model';

@Injectable({ providedIn: 'root' })
export class MilitaryOrganizationsFeatureService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<MilitaryOrganizationListResponse | MilitaryOrganization[]>(
      `${this.apiUrl}/military-organizations`,
    );
  }
}
