import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  GlobalSearchApiItem,
  GlobalSearchApiResponse,
  GlobalSearchGroup,
  GlobalSearchKind,
  GlobalSearchResult,
} from '../models/global-search.model';

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  search(query: string): Observable<GlobalSearchGroup[]> {
    const params = new HttpParams().set('q', query);

    return this.http
      .get<GlobalSearchApiResponse>(`${this.apiUrl}/search`, { params })
      .pipe(map((response) => this.normalizeResponse(response)));
  }

  private normalizeResponse(response: GlobalSearchApiResponse): GlobalSearchGroup[] {
    const groups = new Map<GlobalSearchKind, GlobalSearchResult[]>();

    this.extractItems(response).forEach((entry) => {
      const item = this.normalizeItem(entry.item, entry.kind);

      if (!item) {
        return;
      }

      groups.set(item.type, [...(groups.get(item.type) ?? []), item]);
    });

    return GROUP_ORDER.map((key) => ({
      key,
      label: GROUP_LABELS[key],
      items: groups.get(key) ?? [],
    })).filter((group) => group.items.length > 0);
  }

  private extractItems(
    response: GlobalSearchApiResponse,
  ): Array<{ item: GlobalSearchApiItem; kind?: GlobalSearchKind }> {
    if (Array.isArray(response)) {
      return response.map((item) => ({ item }));
    }

    const groupedResponse = response as Record<string, unknown>;
    const nestedGroups = this.asRecord(groupedResponse['groups']);
    const typedGroups: Array<[string, GlobalSearchKind]> = [
      ['projects', 'project'],
      ['estimates', 'estimate'],
      ['diexRequests', 'diex'],
      ['serviceOrders', 'service_order'],
    ];

    return typedGroups.flatMap(([key, kind]) =>
      this.asArray(nestedGroups[key]).map((item) => ({ item, kind })),
    );
  }

  private normalizeItem(
    item: GlobalSearchApiItem,
    fallbackKind?: GlobalSearchKind,
  ): GlobalSearchResult | null {
    const type = this.normalizeType(
      this.firstString(item, ['type', 'entityType', 'kind', 'resourceType', 'category']),
      fallbackKind,
    );

    if (!type) {
      return null;
    }

    const id =
      this.firstString(item, ['id', 'uuid', 'entityId', 'resourceId']) || this.codeFor(type, item);
    const code = this.codeFor(type, item);
    const title = this.titleFor(type, item, code);
    const subtitle = this.subtitleFor(type, item);
    const route = this.routeFor(type, item, id);

    if (!id || !route.length) {
      return null;
    }

    return {
      id,
      type,
      typeLabel: TYPE_LABELS[type],
      title,
      code,
      subtitle,
      route,
    };
  }

  private normalizeType(value: string, fallbackKind?: GlobalSearchKind): GlobalSearchKind | null {
    const normalized = value.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');

    if (fallbackKind) {
      return fallbackKind;
    }

    if (['project', 'projeto', 'projects'].includes(normalized)) return 'project';
    if (['estimate', 'estimativa', 'estimates'].includes(normalized)) return 'estimate';
    if (['diex', 'diex_request', 'diex_requisitorio'].includes(normalized)) return 'diex';
    if (['service_order', 'ordem_servico', 'os', 'service_orders'].includes(normalized))
      return 'service_order';

    return null;
  }

  private codeFor(type: GlobalSearchKind, item: GlobalSearchApiItem): string {
    const direct = this.firstString(item, [
      'humanCode',
      'humanIdentifier',
      'identifier',
      'displayCode',
      'code',
      'number',
    ]);

    if (direct) {
      return this.prefixCode(type, direct, item);
    }

    const numericCode = this.firstString(item, [
      'projectCode',
      'estimateCode',
      'diexCode',
      'serviceOrderCode',
    ]);

    return this.prefixCode(type, numericCode, item);
  }

  private prefixCode(type: GlobalSearchKind, value: string, item: GlobalSearchApiItem): string {
    const normalized = value.trim();

    if (!normalized) {
      return '';
    }

    if (/^(PRJ|EST|DIEX|OS)-/i.test(normalized)) {
      return normalized.toUpperCase();
    }

    if (type === 'project') return this.humanCode('PRJ', normalized, item, '2026');
    if (type === 'estimate') return this.humanCode('EST', normalized, item, '2026');
    if (type === 'diex') return this.humanCode('DIEX', normalized, item, '2026');
    if (type === 'service_order') return this.humanCode('OS', normalized, item);

    return normalized;
  }

  private humanCode(
    prefix: string,
    value: string,
    item: GlobalSearchApiItem,
    fallbackYear = '',
  ): string {
    const year = this.yearFrom(item) || fallbackYear;

    if (year && /^\d+$/.test(value)) {
      return `${prefix}-${year}-${value.padStart(4, '0')}`;
    }

    return `${prefix}-${value}`;
  }

  private routeFor(type: GlobalSearchKind, item: GlobalSearchApiItem, id: string): string[] {
    if (type === 'project') return ['/projects', this.routeCodeFor(type, item) || id];
    if (type === 'estimate') return ['/estimates', this.routeCodeFor(type, item) || id];
    if (type === 'diex') return ['/diex', this.routeCodeFor(type, item) || id];
    if (type === 'service_order') {
      return [
        '/service-orders',
        this.firstString(item, ['documentNumber', 'serviceOrderNumber']) || id,
      ];
    }

    return [];
  }

  private routeCodeFor(type: GlobalSearchKind, item: GlobalSearchApiItem): string {
    const numericCode = this.firstString(item, [
      type === 'project' ? 'projectCode' : type === 'estimate' ? 'estimateCode' : 'diexCode',
      'code',
    ]);

    if (!numericCode) {
      return '';
    }

    if (type === 'project') return this.prefixCode(type, numericCode, item);
    if (type === 'estimate') return this.prefixCode(type, numericCode, item);
    if (type === 'diex') return this.prefixCode(type, numericCode, item);

    return '';
  }

  private titleFor(type: GlobalSearchKind, item: GlobalSearchApiItem, code: string): string {
    if (type === 'estimate') {
      return this.firstString(item, ['title']) || (code ? `Estimativa ${code}` : TYPE_LABELS[type]);
    }

    return (
      this.firstString(item, [
        'title',
        'name',
        'label',
        'summary',
        'description',
        'sigla',
        'vendorName',
      ]) ||
      code ||
      TYPE_LABELS[type]
    );
  }

  private subtitleFor(type: GlobalSearchKind, item: GlobalSearchApiItem): string {
    if (type === 'estimate') {
      const project = this.firstString(item, ['projectTitle', 'projectName', 'project']);
      const om = this.firstString(item, ['omName', 'omSigla', 'militaryOrganizationName']);
      const location = [
        this.firstString(item, ['cityName', 'destinationCityName']),
        this.firstString(item, ['stateUf', 'destinationStateUf']),
      ]
        .filter(Boolean)
        .join('/');

      return [project, om, location].filter(Boolean).join(' - ') || TYPE_LABELS[type];
    }

    return (
      this.firstString(item, [
        'subtitle',
        'description',
        'status',
        'stage',
        'email',
        'cityName',
        'stateUf',
        'ownerName',
        'vendorName',
      ]) || TYPE_LABELS[type]
    );
  }

  private firstString(item: GlobalSearchApiItem, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return '';
  }

  private yearFrom(item: GlobalSearchApiItem): string {
    const dateLike = this.firstString(item, ['createdAt', 'issuedAt', 'updatedAt', 'date']);

    if (!dateLike) {
      return '';
    }

    const date = new Date(dateLike);
    return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear());
  }

  private asArray(value: unknown): GlobalSearchApiItem[] {
    return Array.isArray(value)
      ? value.filter(
          (item): item is GlobalSearchApiItem => Boolean(item) && typeof item === 'object',
        )
      : [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}

const GROUP_ORDER: GlobalSearchKind[] = [
  'project',
  'estimate',
  'diex',
  'service_order',
];

const GROUP_LABELS: Record<GlobalSearchKind, string> = {
  project: 'Projetos',
  estimate: 'Estimativas',
  diex: 'DIEx',
  service_order: 'Ordens de Serviço',
};

const TYPE_LABELS: Record<GlobalSearchKind, string> = {
  project: 'Projeto',
  estimate: 'Estimativa',
  diex: 'DIEx',
  service_order: 'Ordem de Serviço',
};
