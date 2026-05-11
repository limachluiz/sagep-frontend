import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  Ata,
  AtaCoverageGroup,
  AtaCoverageGroupPayload,
  AtaCoverageGroupUpdatePayload,
  AtaItem,
  AtaItemPayload,
  AtaItemUpdatePayload,
  AtaListResponse,
  AtaPayload,
} from './ata.model';

@Injectable({ providedIn: 'root' })
export class AtasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<AtaListResponse | Ata[]>(`${this.apiUrl}/atas`);
  }

  getById(id: string) {
    return this.http.get<Ata>(`${this.apiUrl}/atas/${encodeURIComponent(id)}`);
  }

  create(payload: AtaPayload) {
    return this.http.post<Ata>(`${this.apiUrl}/atas`, payload);
  }

  update(id: string, payload: Partial<AtaPayload>) {
    return this.http.patch<Ata>(`${this.apiUrl}/atas/${encodeURIComponent(id)}`, payload);
  }

  listItems(ataId: string) {
    return this.http.get<{ items: AtaItem[] } | AtaItem[]>(`${this.apiUrl}/atas/${encodeURIComponent(ataId)}/items`);
  }

  createItem(ataId: string, payload: AtaItemPayload) {
    return this.http.post<AtaItem>(`${this.apiUrl}/atas/${encodeURIComponent(ataId)}/items`, payload);
  }

  updateItem(itemId: string, payload: AtaItemUpdatePayload) {
    return this.http.patch<AtaItem>(`${this.apiUrl}/ata-items/${encodeURIComponent(itemId)}`, payload);
  }

  deleteItem(itemId: string) {
    return this.http.delete(`${this.apiUrl}/ata-items/${encodeURIComponent(itemId)}`);
  }

  createCoverageGroup(ataId: string, payload: AtaCoverageGroupPayload) {
    return this.http.post<AtaCoverageGroup>(
      `${this.apiUrl}/atas/${encodeURIComponent(ataId)}/coverage-groups`,
      payload,
    );
  }

  updateCoverageGroup(ataId: string, groupId: string, payload: AtaCoverageGroupUpdatePayload) {
    return this.http.patch<AtaCoverageGroup>(
      `${this.apiUrl}/atas/${encodeURIComponent(ataId)}/coverage-groups/${encodeURIComponent(groupId)}`,
      payload,
    );
  }

  deleteCoverageGroup(ataId: string, groupId: string) {
    return this.http.delete(`${this.apiUrl}/atas/${encodeURIComponent(ataId)}/coverage-groups/${encodeURIComponent(groupId)}`);
  }
}
