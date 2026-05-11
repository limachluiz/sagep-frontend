import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  ComprasGovAtaImportPayload,
  ComprasGovAtaImportResponse,
  ComprasGovAtaPreview,
  ComprasGovAtaPreviewParams,
} from './compras-gov.model';

@Injectable({ providedIn: 'root' })
export class ComprasGovService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  previewAta(params: ComprasGovAtaPreviewParams) {
    return this.http.get<ComprasGovAtaPreview>(
      `${this.apiUrl}/integrations/compras-gov/atas/preview`,
      { params: this.previewParams(params) },
    );
  }

  importAta(payload: ComprasGovAtaImportPayload) {
    return this.http.post<ComprasGovAtaImportResponse>(
      `${this.apiUrl}/integrations/compras-gov/atas/import`,
      payload,
    );
  }

  private previewParams(params: ComprasGovAtaPreviewParams): HttpParams {
    let httpParams = new HttpParams()
      .set('uasg', params.uasg)
      .set('numeroPregao', params.numeroPregao)
      .set('anoPregao', params.anoPregao);

    if (params.numeroAta) {
      httpParams = httpParams.set('numeroAta', params.numeroAta);
    }

    return httpParams;
  }
}
