import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ProjectDetails,
  ProjectLookupResponse,
  ProjectListResponse,
  ProjectTimelineItem,
} from '../models/project.model';

export interface ProjectFlowUpdatePayload {
  stage:
    | 'ESTIMATIVA_PRECO'
    | 'AGUARDANDO_NOTA_CREDITO'
    | 'DIEX_REQUISITORIO'
    | 'AGUARDANDO_NOTA_EMPENHO'
    | 'OS_LIBERADA'
    | 'SERVICO_EM_EXECUCAO'
    | 'ANALISANDO_AS_BUILT'
    | 'ATESTAR_NF'
    | 'SERVICO_CONCLUIDO'
    | 'CANCELADO';
  creditNoteNumber?: string | null;
  creditNoteReceivedAt?: string | null;
  commitmentNoteNumber?: string | null;
  commitmentNoteReceivedAt?: string | null;
}

export interface InformCommitmentNotePayload {
  commitmentNoteNumber: string;
  commitmentNoteReceivedAt?: string | null;
}

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

  getByCode(code: string) {
    return this.http.get<ProjectLookupResponse>(`${this.apiUrl}/projects/code/${encodeURIComponent(code)}`);
  }

  getDetails(projectIdentifier: string) {
    return forkJoin({
      details: this.http.get<ProjectDetails>(`${this.apiUrl}/projects/${projectIdentifier}/details`),
      timeline: this.http.get<ProjectTimelineItem[]>(`${this.apiUrl}/projects/${projectIdentifier}/timeline`),
      nextAction: this.http.get<Record<string, unknown>>(`${this.apiUrl}/projects/${projectIdentifier}/next-action`),
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

  updateFlow(projectId: string, payload: ProjectFlowUpdatePayload) {
    return this.http.patch<ProjectLookupResponse>(`${this.apiUrl}/projects/${projectId}/flow`, payload);
  }

  informCommitmentNote(projectId: string, payload: InformCommitmentNotePayload) {
    return this.updateFlow(projectId, {
      stage: 'OS_LIBERADA',
      commitmentNoteNumber: payload.commitmentNoteNumber,
      commitmentNoteReceivedAt: payload.commitmentNoteReceivedAt ?? new Date().toISOString(),
    });
  }
}
