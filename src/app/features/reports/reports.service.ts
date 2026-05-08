import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  exportProjectsXlsx() {
    return this.http.get(`${this.apiUrl}/exports/projects.xlsx`, {
      responseType: 'blob',
    });
  }

  getProjectDossierHtml(projectIdentifier: string) {
    return this.http.get(`${this.apiUrl}/reports/projects/${encodeURIComponent(projectIdentifier)}/dossier`, {
      responseType: 'blob',
    });
  }

  getProjectDossierPdf(projectIdentifier: string) {
    return this.http.get(`${this.apiUrl}/reports/projects/${encodeURIComponent(projectIdentifier)}/dossier.pdf`, {
      responseType: 'blob',
    });
  }
}
