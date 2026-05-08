import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AtaItem, AtaItemListResponse } from './ata-item.model';

@Injectable({ providedIn: 'root' })
export class AtaItemsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<AtaItemListResponse | AtaItem[]>(`${this.apiUrl}/ata-items`);
  }
}
