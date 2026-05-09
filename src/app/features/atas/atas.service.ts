import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { Ata, AtaItem, AtaListResponse, AtaPayload } from './ata.model';

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
}
