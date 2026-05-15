import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  AtaBalanceItem,
  AtaBalanceListResponse,
  AtaBalanceMovement,
  AtaBalanceMovementListResponse,
  AtaExternalBalanceComparison,
  AtaExternalBalanceListResponse,
  AtaRegisterExternalConsumptionPayload,
} from './ata-balance.model';

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

  getAtaExternalBalance(ataId: string) {
    return this.http.get<AtaExternalBalanceListResponse | AtaExternalBalanceComparison[]>(
      `${this.apiUrl}/atas/${encodeURIComponent(ataId)}/external-balance`,
    );
  }

  syncAtaExternalBalance(ataId: string) {
    return this.http.post<AtaExternalBalanceListResponse>(
      `${this.apiUrl}/atas/${encodeURIComponent(ataId)}/sync-external-balance`,
      {},
    );
  }

  syncItemExternalBalance(itemId: string) {
    return this.http.post<AtaExternalBalanceComparison>(
      `${this.apiUrl}/ata-items/${encodeURIComponent(itemId)}/sync-external-balance`,
      {},
    );
  }

  getItemBalanceComparison(itemId: string) {
    return this.http.get<AtaExternalBalanceComparison>(
      `${this.apiUrl}/ata-items/${encodeURIComponent(itemId)}/balance-comparison`,
    );
  }

  registerExternalConsumption(itemId: string, payload: AtaRegisterExternalConsumptionPayload) {
    return this.http.post<AtaBalanceItem | { item?: AtaBalanceItem | null; message?: string | null }>(
      `${this.apiUrl}/ata-items/${encodeURIComponent(itemId)}/register-external-consumption`,
      payload,
    );
  }
}
