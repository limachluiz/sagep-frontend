import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { Diex, DiexCreatePayload } from '../models/diex.model';

@Injectable({ providedIn: 'root' })
export class DiexService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  createDiex(payload: DiexCreatePayload) {
    return this.http.post<Diex>(`${this.apiUrl}/diex`, payload);
  }
}
