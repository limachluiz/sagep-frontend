import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AtaItem, AtaItemListResponse, AtaItemUpdatePayload } from './ata-item.model';

@Injectable({ providedIn: 'root' })
export class AtaItemsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<AtaItemListResponse | AtaItem[]>(`${this.apiUrl}/ata-items`);
  }

  update(id: string, payload: AtaItemUpdatePayload) {
    return this.http.patch<AtaItem>(`${this.apiUrl}/ata-items/${encodeURIComponent(id)}`, payload);
  }

  delete(id: string) {
    return this.http.delete(`${this.apiUrl}/ata-items/${encodeURIComponent(id)}`);
  }
}
