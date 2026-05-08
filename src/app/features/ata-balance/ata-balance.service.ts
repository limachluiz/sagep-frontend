import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AtaBalanceItem, AtaBalanceListResponse, AtaBalanceMovement, AtaBalanceMovementListResponse } from './ata-balance.model';

@Injectable({ providedIn: 'root' })
export class AtaBalanceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<AtaBalanceListResponse | AtaBalanceItem[]>(`${this.apiUrl}/ata-items`);
  }

  getItemMovements(itemId: string) {
    return this.http.get<AtaBalanceMovementListResponse | AtaBalanceMovement[]>(
      `${this.apiUrl}/ata-items/${encodeURIComponent(itemId)}/movements`,
    );
  }
}
