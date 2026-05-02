import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyValuePipe } from '../../shared/pipes/empty-value.pipe';
import { formatCurrency, formatDate, formatLabel, getStatusBadgeClasses } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { Estimate } from './estimate.model';
import { EstimatesService } from './estimates.service';

@Component({
  selector: 'app-estimate-detail-page',
  imports: [CommonModule, RouterLink, EmptyValuePipe, AccessDeniedStateComponent],
  template: `
    <section class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <a routerLink="/estimates" class="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
          ← Voltar para estimativas
        </a>
        @if (estimate()) {
          <span class="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-600 shadow-sm">
            Fonte: GET /estimates/:id
          </span>
        }
      </div>

      @if (loading()) {
        <div class="grid gap-4">
          @for (item of [1, 2, 3]; track item) {
            <div class="h-36 animate-pulse rounded-[2rem] border border-slate-200 bg-white/80 shadow-[var(--sagep-shadow)]"></div>
          }
        </div>
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
        <div class="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700 shadow-[var(--sagep-shadow)]">
          <h2 class="text-lg font-semibold">Nao foi possivel carregar o detalhe da estimativa</h2>
          <p class="mt-2 text-sm leading-6">{{ errorMessage() }}</p>
          <div class="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              (click)="reload()"
              class="rounded-full border border-red-300 px-5 py-2 text-sm font-medium text-red-700 transition hover:border-red-500"
            >
              Tentar novamente
            </button>
            <a
              routerLink="/estimates"
              class="rounded-full border border-red-200 px-5 py-2 text-sm font-medium text-red-700 transition hover:border-red-400"
            >
              Voltar para listagem
            </a>
          </div>
        </div>
      } @else if (!estimate()) {
        <div class="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-[var(--sagep-shadow)]">
          <p class="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Sem dados</p>
          <h2 class="mt-3 text-2xl font-semibold text-slate-900">O backend não retornou conteúdo para esta estimativa</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">Retorne para a listagem e selecione outro registro.</p>
          <a
            routerLink="/estimates"
            class="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Voltar à listagem
          </a>
        </div>
      } @else {
        <section class="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[var(--sagep-shadow)]">
          <div class="bg-[linear-gradient(135deg,#0f172a_0%,#134e4a_100%)] px-6 py-8 text-white">
            <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">Estimativa EST-{{ estimate()?.estimateCode }}</p>
                <h1 class="mt-3 text-3xl font-semibold">{{ estimate()?.project?.title || 'Estimativa vinculada a projeto' }}</h1>
                <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                  {{ estimate()?.notes | emptyValue:'Sem observacoes cadastradas para esta estimativa.' }}
                </p>
              </div>
              <span class="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium">
                {{ formatLabel(estimate()?.status || '') }}
              </span>
            </div>
          </div>

          <div class="grid gap-4 border-t border-slate-200 bg-slate-50 p-5 md:grid-cols-2 xl:grid-cols-5">
            @for (item of highlightFacts(); track item.label) {
              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ item.label }}</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.value }}</p>
              </div>
            }
          </div>
        </section>

        <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-xl font-semibold text-slate-950">Dados gerais</h2>
                <p class="mt-2 text-sm text-slate-600">Resumo do vínculo com projeto, ata, grupo de cobertura e OM.</p>
              </div>
              <span class="rounded-full border px-3 py-1 text-xs font-medium" [class]="badgeClass(estimate()?.status)">
                {{ formatLabel(estimate()?.status || '') }}
              </span>
            </div>
            <div class="mt-5 grid gap-4 md:grid-cols-2">
              @for (item of generalFacts(); track item.label) {
                <div class="rounded-2xl bg-slate-50 p-4">
                  <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ item.label }}</p>
                  <p class="mt-2 text-sm font-medium text-slate-900">{{ item.value }}</p>
                </div>
              }
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Projeto vinculado e observações</h2>
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
          </section>
        </div>

        <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 class="text-xl font-semibold text-slate-950">Itens da estimativa</h2>
              <p class="mt-2 text-sm text-slate-600">Linhas retornadas pela API com quantidades, preços unitários, subtotais e observações.</p>
            </div>
            <span class="text-sm text-slate-500">{{ (estimate()?.items ?? []).length }} item(ns)</span>
          </div>

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
        </section>
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
  private estimateId: string | null = null;

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

  readonly generalFacts = computed(() => {
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
    this.estimateId = this.route.snapshot.paramMap.get('id');

    if (!this.estimateId) {
      this.errorMessage.set('Identificador da estimativa nao informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(): void {
    if (!this.estimateId) return;

    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    this.estimatesService.getById(this.estimateId).subscribe({
      next: (response) => {
        this.estimate.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao carregar o detalhe da estimativa.'));
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

  badgeClass(status: string | null | undefined): string {
    return getStatusBadgeClasses(status);
  }

  protected readonly formatLabel = formatLabel;
  protected readonly formatDate = formatDate;
  protected readonly formatCurrency = formatCurrency;
}
