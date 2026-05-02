import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ProjectDetails,
  ProjectListResponse,
  ProjectTimelineItem,
} from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list(params?: { page?: number; pageSize?: number; search?: string; status?: string; stage?: string }) {
    let httpParams = new HttpParams();

    if (params?.page) httpParams = httpParams.set('page', params.page);
    if (params?.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.stage) httpParams = httpParams.set('stage', params.stage);

    return this.http.get<ProjectListResponse>(`${this.apiUrl}/projects`, { params: httpParams });
  }

  getDetails(id: string) {
    return forkJoin({
      details: this.http.get<ProjectDetails>(`${this.apiUrl}/projects/${id}/details`),
      timeline: this.http.get<ProjectTimelineItem[]>(`${this.apiUrl}/projects/${id}/timeline`),
      nextAction: this.http.get<Record<string, unknown>>(`${this.apiUrl}/projects/${id}/next-action`),
    }).pipe(
      map(({ details, timeline, nextAction }) => ({
        ...details,
        timeline,
        workflow: {
          ...details.workflow,
          nextAction,
        },
      })),
    );
  }
}
