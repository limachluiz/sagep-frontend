import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MetadataGridComponent, MetadataItem } from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { EmptyValuePipe } from '../../shared/pipes/empty-value.pipe';
import {
  buildEstimateIdentifier,
  extractEstimateCodeFromFriendlyIdentifier,
  formatCurrency,
  formatDate,
  formatLabel,
} from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { Estimate } from './estimate.model';
import { EstimatesService } from './estimates.service';

@Component({
  selector: 'app-estimate-detail-page',
  imports: [
    CommonModule,
    EmptyValuePipe,
    AccessDeniedStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    MetadataGridComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
    SummaryCardComponent,
  ],
  template: `
    <section class="space-y-6">
      <app-page-header
        [title]="estimate()?.project?.title || 'Detalhe da estimativa'"
        [eyebrow]="estimateDisplayCode()"
        subtitle="Detalhe da estimativa com vínculo ao projeto, resumo geral e itens retornados pela API."
        badge="Fonte: GET /estimates/:identifier"
        backLabel="← Voltar para estimativas"
        backLink="/estimates"
      />

      @if (loading()) {
        <app-loading-state variant="detail" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite abrir esta estimativa."
          description="O backend bloqueou a visualização detalhada deste registro. Você pode voltar para a listagem sem encerrar a sessão."
          primaryLink="/estimates"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Nao foi possivel carregar o detalhe da estimativa"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="reload()"
        />
      } @else if (!estimate()) {
        <app-empty-state
          eyebrow="Sem dados"
          title="O backend não retornou conteúdo para esta estimativa"
          description="Retorne para a listagem e selecione outro registro."
        />
      } @else {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          @for (item of highlightFacts(); track item.label) {
            <app-summary-card [title]="item.label" [value]="item.value" tone="soft" />
          }
        </div>

        <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <app-section-card title="Dados gerais" subtitle="Resumo do vínculo com projeto, ata, grupo de cobertura e OM.">
            <app-status-badge
              section-card-actions
              [label]="formatLabel(estimate()?.status || '')"
              [status]="estimate()?.status"
            />
            <app-metadata-grid class="mt-5 block" [items]="generalFacts()" />
          </app-section-card>

          <app-section-card title="Projeto vinculado e observações">
            <div class="mt-5 rounded-[1.75rem] border border-teal-200 bg-teal-50 p-5">
              <p class="text-xs uppercase tracking-[0.18em] text-teal-700">Projeto vinculado</p>
              <p class="mt-3 text-lg font-semibold text-teal-950">
                #{{ estimate()?.project?.projectCode || estimate()?.projectCode }} - {{ estimate()?.project?.title || 'Projeto não informado' }}
              </p>
              <p class="mt-2 text-sm leading-6 text-teal-900/80">
                Status do projeto: {{ formatLabel(estimate()?.project?.status || '') }}
              </p>
            </div>
            <div class="mt-5 rounded-[1.75rem] border border-slate-200 p-5">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Observações</p>
              <p class="mt-3 text-sm leading-6 text-slate-700">
                {{ estimate()?.notes | emptyValue:'Sem observações registradas nesta estimativa.' }}
              </p>
            </div>
          </app-section-card>
        </div>

        <app-section-card title="Itens da estimativa" subtitle="Linhas retornadas pela API com quantidades, preços unitários, subtotais e observações.">
          <span section-card-actions class="text-sm text-slate-500">{{ (estimate()?.items ?? []).length }} item(ns)</span>

          @if ((estimate()?.items ?? []).length) {
            <div class="mt-6 hidden overflow-x-auto lg:block">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr class="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                    <th class="px-4 py-3">Item</th>
                    <th class="px-4 py-3">Qtd.</th>
                    <th class="px-4 py-3">Unidade</th>
                    <th class="px-4 py-3">Valor unit.</th>
                    <th class="px-4 py-3">Valor total</th>
                    <th class="px-4 py-3">Observações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (item of estimate()?.items ?? []; track item.id) {
                    <tr class="align-top">
                      <td class="px-4 py-4">
                        <p class="font-semibold text-slate-900">{{ item.referenceCode }} - {{ item.description }}</p>
                        <p class="mt-1 text-sm text-slate-500">
                          ATA item: {{ item.ataItem?.ataItemCode || 'Nao informado' }} • {{ item.ataItem?.referenceCode || 'Sem referencia' }}
                        </p>
                      </td>
                      <td class="px-4 py-4 text-sm text-slate-700">{{ item.quantity }}</td>
                      <td class="px-4 py-4 text-sm text-slate-700">{{ item.unit }}</td>
                      <td class="px-4 py-4 text-sm text-slate-700">{{ formatCurrency(item.unitPrice) }}</td>
                      <td class="px-4 py-4 text-sm font-semibold text-slate-900">{{ formatCurrency(item.subtotal) }}</td>
                      <td class="px-4 py-4 text-sm text-slate-700">{{ item.notes | emptyValue:'Sem observações' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="mt-6 grid gap-4 lg:hidden">
              @for (item of estimate()?.items ?? []; track item.id) {
                <article class="rounded-[1.5rem] border border-slate-200 p-4">
                  <p class="font-semibold text-slate-900">{{ item.referenceCode }} - {{ item.description }}</p>
                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <div class="rounded-2xl bg-slate-50 p-3">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Quantidade</p>
                      <p class="mt-2 text-sm font-medium text-slate-900">{{ item.quantity }}</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 p-3">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Unidade</p>
                      <p class="mt-2 text-sm font-medium text-slate-900">{{ item.unit }}</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 p-3">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Valor unitário</p>
                      <p class="mt-2 text-sm font-medium text-slate-900">{{ formatCurrency(item.unitPrice) }}</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 p-3">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Subtotal</p>
                      <p class="mt-2 text-sm font-medium text-slate-900">{{ formatCurrency(item.subtotal) }}</p>
                    </div>
                  </div>
                  <p class="mt-4 text-sm text-slate-600">{{ item.notes | emptyValue:'Sem observações para esta linha.' }}</p>
                </article>
              }
            </div>
          } @else {
            <div class="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              A API não retornou itens para esta estimativa.
            </div>
          }
        </app-section-card>
      }
    </section>
  `,
})
export class EstimateDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly estimatesService = inject(EstimatesService);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly estimate = signal<Estimate | null>(null);
  private estimateIdentifier: string | null = null;
  readonly estimateDisplayCode = computed(() => {
    const estimate = this.estimate();
    return estimate ? buildEstimateIdentifier(estimate.estimateCode, estimate.id, estimate.createdAt) : 'Estimativa';
  });

  readonly highlightFacts = computed(() => {
    const estimate = this.estimate();
    return [
      { label: 'Status', value: formatLabel(estimate?.status ?? '') },
      { label: 'Projeto', value: estimate?.project?.projectCode ? `#${estimate.project.projectCode}` : `#${estimate?.projectCode ?? '-'}` },
      { label: 'OM', value: estimate?.om?.sigla || estimate?.omName || 'Nao informado' },
      { label: 'Cidade / UF', value: this.locationLabel(estimate) },
      { label: 'Valor total', value: formatCurrency(estimate?.totalAmount) },
    ];
  });

  readonly generalFacts = computed<MetadataItem[]>(() => {
    const estimate = this.estimate();
    return [
      { label: 'Código da estimativa', value: estimate?.estimateCode ? `EST-${estimate.estimateCode}` : 'Nao informado' },
      { label: 'Projeto vinculado', value: estimate?.project?.title || 'Nao informado' },
      { label: 'Ata', value: estimate?.ata ? `ATA #${estimate.ata.ataCode} - ${estimate.ata.number}` : 'Nao informado' },
      { label: 'Fornecedor', value: estimate?.ata?.vendorName || 'Nao informado' },
      { label: 'Grupo de cobertura', value: estimate?.coverageGroup ? `${estimate.coverageGroup.code} - ${estimate.coverageGroup.name}` : 'Nao informado' },
      { label: 'OM', value: estimate?.om ? `${estimate.om.sigla} - ${estimate.om.name}` : estimate?.omName || 'Nao informado' },
      { label: 'Criada em', value: formatDate(estimate?.createdAt) },
      { label: 'Atualizada em', value: formatDate(estimate?.updatedAt || estimate?.createdAt) },
    ];
  });

  ngOnInit(): void {
    this.estimateIdentifier = this.route.snapshot.paramMap.get('id');

    if (!this.estimateIdentifier) {
      this.errorMessage.set('Identificador da estimativa nao informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(): void {
    if (!this.estimateIdentifier) return;

    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const routeIdentifier = this.estimateIdentifier;
    const codeCandidate = extractEstimateCodeFromFriendlyIdentifier(routeIdentifier);
    const shouldTryCodeLookup =
      routeIdentifier !== codeCandidate || /^\d+$/.test(routeIdentifier.trim());

    const estimateRequest$ = shouldTryCodeLookup
      ? this.estimatesService.getByCode(codeCandidate).pipe(
          catchError(() => this.estimatesService.getByIdentifier(routeIdentifier)),
        )
      : this.estimatesService.getByIdentifier(routeIdentifier).pipe(
          catchError((originalError) =>
            this.estimatesService.getByCode(codeCandidate).pipe(
              catchError(() => throwError(() => originalError)),
            ),
          ),
        );

    estimateRequest$.subscribe({
      next: (response) => {
        this.estimate.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(
          getErrorMessage(error, 'Estimativa não encontrada ou sem permissão de acesso.'),
        );
        this.estimate.set(null);
        this.loading.set(false);
      },
    });
  }

  locationLabel(estimate: Estimate | null): string {
    const city = estimate?.om?.cityName || estimate?.destinationCityName;
    const state = estimate?.om?.stateUf || estimate?.destinationStateUf;
    return [city, state].filter(Boolean).join(' / ') || 'Nao informado';
  }

  protected readonly formatLabel = formatLabel;
  protected readonly formatDate = formatDate;
  protected readonly formatCurrency = formatCurrency;
}
