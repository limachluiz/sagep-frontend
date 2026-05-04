import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { Ata, AtaItem, AtaListResponse } from '../models/ata.model';

@Injectable({ providedIn: 'root' })
export class AtasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<AtaListResponse | Ata[]>(`${this.apiUrl}/atas`);
  }

  listItems(ataId: string) {
    return this.http.get<{ items: AtaItem[] } | AtaItem[]>(`${this.apiUrl}/atas/${ataId}/items`);
  }
}
