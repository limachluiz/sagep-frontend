import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { DashboardSummary } from '../../core/models/dashboard.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { formatCurrency, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    CommonModule,
    AccessDeniedStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    SectionCardComponent,
    SummaryCardComponent,
  ],
  template: `
    <section class="space-y-6">
      <header class="overflow-hidden rounded-[var(--sagep-radius)] border border-[rgba(200,166,75,0.22)] bg-[radial-gradient(circle_at_88%_18%,rgba(200,166,75,0.18),transparent_32%),linear-gradient(135deg,var(--sagep-brand-dark),var(--sagep-brand-deep))] text-white shadow-[var(--sagep-shadow)]">
        <div class="px-5 py-6 sm:px-6 lg:px-7">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <p class="text-xs font-black uppercase tracking-[0.24em] text-[var(--sagep-gold)]">Painel de comando · 4º CTA</p>
              <h1 class="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Visão inicial do fluxo de projetos</h1>
              <p class="mt-3 max-w-3xl text-sm leading-6 text-white/[0.68]">
                Dados reais de /dashboard/operational, respeitando as permissões efetivas do usuário logado.
              </p>
            </div>

            @if (dashboard()) {
              <span class="inline-flex w-fit rounded-full border border-white/[0.12] bg-white/[0.07] px-4 py-2 text-xs font-semibold text-white/[0.72]">
                Atualizado em {{ dashboard()?.generatedAt | date: 'short' }}
              </span>
            }
          </div>

          @if (dashboard()) {
            <div class="mt-6 grid gap-3 md:grid-cols-3">
              <div class="rounded-[16px] border border-white/[0.12] bg-white/[0.06] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.42]">Etapas pendentes</p>
                <p class="mt-2 text-2xl font-semibold text-[var(--sagep-gold)]">{{ pendingStageEntries().length }}</p>
              </div>
              <div class="rounded-[16px] border border-white/[0.12] bg-white/[0.06] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.42]">Fila operacional</p>
                <p class="mt-2 text-2xl font-semibold text-[var(--sagep-gold)]">{{ dashboard()?.operationalQueue?.length ?? 0 }}</p>
              </div>
              <div class="rounded-[16px] border border-white/[0.12] bg-white/[0.06] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.18em] text-white/[0.42]">Próximas ações</p>
                <p class="mt-2 text-2xl font-semibold text-[var(--sagep-gold)]">{{ dashboard()?.frequentNextActions?.length ?? 0 }}</p>
              </div>
            </div>
          }
        </div>
      </header>

      @if (loading()) {
        <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-5 shadow-[var(--sagep-shadow-soft)]">
          <app-loading-state variant="cards" [count]="4" />
        </div>
      } @else if (forbidden()) {
        <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-4 shadow-[var(--sagep-shadow-soft)]">
          <app-access-denied-state
            title="Seu perfil atual não possui acesso a este dashboard."
            description="A API retornou acesso negado para a visão operacional. A sessão permanece ativa e você pode seguir para outros módulos disponíveis."
            primaryLink="/projects"
            primaryLabel="Ir para projetos"
            secondaryLink="/dashboard"
            secondaryLabel="Recarregar rota"
          />
        </div>
      } @else if (errorMessage()) {
        <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-4 shadow-[var(--sagep-shadow-soft)]">
          <app-error-state
            title="Não foi possível carregar o dashboard"
            [message]="errorMessage()"
            retryLabel="Tentar novamente"
            (retry)="loadDashboard()"
          />
        </div>
      } @else if (!dashboard()) {
        <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-4 shadow-[var(--sagep-shadow-soft)]">
          <app-empty-state
            title="Nenhum dado foi retornado pela API para o dashboard operacional"
            description="Verifique se existem dados disponíveis no backend ou tente novamente mais tarde."
          />
        </div>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          @for (card of summaryCards(); track card.label) {
            <app-summary-card [title]="card.label" [value]="card.value" [tone]="card.tone" />
          }
        </div>

        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <app-section-card title="Pendências por etapa" subtitle="Distribuição informada pelo dashboard operacional.">
            <div class="divide-y divide-[var(--sagep-line)]">
              @for (item of pendingStageEntries(); track item.label) {
                <div class="flex items-center justify-between gap-4 py-3">
                  <span class="text-sm font-medium text-[var(--sagep-ink)]">{{ item.label }}</span>
                  <span class="rounded-full bg-[var(--sagep-surface-subtle)] px-3 py-1 text-sm font-semibold text-[var(--sagep-brand-deep)]">{{ item.value }}</span>
                </div>
              } @empty {
                <p class="rounded-[14px] border border-dashed border-[var(--sagep-line-strong)] bg-[var(--sagep-surface-subtle)] px-4 py-5 text-sm text-[var(--sagep-muted)]">
                  Nenhuma etapa pendente retornada.
                </p>
              }
            </div>
          </app-section-card>

          <app-section-card title="Estoque e saldo da ATA" subtitle="Resumo de disponibilidade retornado pela API.">
            <div class="divide-y divide-[var(--sagep-line)]">
              @for (item of inventoryEntries(); track item.label) {
                <div class="flex items-center justify-between gap-4 py-3">
                  <span class="text-sm text-[var(--sagep-ink)]">{{ item.label }}</span>
                  <span class="text-sm font-semibold text-[var(--sagep-brand-deep)]">{{ item.value }}</span>
                </div>
              } @empty {
                <p class="rounded-[14px] border border-dashed border-[var(--sagep-line-strong)] bg-[var(--sagep-surface-subtle)] px-4 py-5 text-sm text-[var(--sagep-muted)]">
                  O backend não retornou resumo de inventário.
                </p>
              }
            </div>
          </app-section-card>
        </div>

        <div class="grid gap-6 xl:grid-cols-2">
          <app-section-card title="Fila operacional" subtitle="Itens priorizados conforme resposta do dashboard.">
            <div class="space-y-3">
              @for (item of dashboard()?.operationalQueue ?? []; track $index) {
                <article class="rounded-[14px] border border-[var(--sagep-line)] bg-[var(--sagep-surface-subtle)] px-4 py-3">
                  <p class="text-sm font-semibold text-[var(--sagep-brand-deep)]">{{ getFirstString(item, ['title', 'label', 'projectTitle']) }}</p>
                  <p class="mt-2 text-sm leading-6 text-[var(--sagep-muted)]">{{ stringifyItem(item) }}</p>
                </article>
              } @empty {
                <p class="rounded-[14px] border border-dashed border-[var(--sagep-line-strong)] bg-[var(--sagep-surface-subtle)] px-4 py-5 text-sm text-[var(--sagep-muted)]">
                  Sem itens na fila operacional.
                </p>
              }
            </div>
          </app-section-card>

          <app-section-card title="Próximas ações mais frequentes" subtitle="Agregados operacionais calculados pelo backend.">
            <div class="divide-y divide-[var(--sagep-line)]">
              @for (item of dashboard()?.frequentNextActions ?? []; track $index) {
                <div class="flex items-center justify-between gap-4 py-3">
                  <span class="text-sm text-[var(--sagep-ink)]">{{ getFirstString(item, ['label', 'code', 'action']) }}</span>
                  <span class="rounded-full bg-[var(--sagep-brand-soft)] px-3 py-1 text-sm font-semibold text-[var(--sagep-brand-dark)]">
                    {{ getFirstString(item, ['count', 'value']) }}
                  </span>
                </div>
              } @empty {
                <p class="rounded-[14px] border border-dashed border-[var(--sagep-line-strong)] bg-[var(--sagep-surface-subtle)] px-4 py-5 text-sm text-[var(--sagep-muted)]">
                  Sem agregados de próxima ação no momento.
                </p>
              }
            </div>
          </app-section-card>
        </div>
      }
    </section>
  `,
})
export class DashboardPageComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly dashboard = signal<DashboardSummary | null>(null);

  readonly summaryCards = computed<Array<{ label: string; value: string; tone: 'default' | 'accent' | 'soft' }>>(() => {
    const summary = this.dashboard()?.summary ?? {};
    const inventorySummary = this.dashboard()?.inventory?.summary ?? {};

    return [
      { label: 'Projetos no resumo', value: this.readMetric(summary, ['totalProjects', 'projectsCount', 'projects']), tone: 'default' },
      { label: 'Alertas ativos', value: this.readMetric(summary, ['totalAlerts', 'alertsCount', 'attentionItems']), tone: 'accent' },
      { label: 'Itens com estoque baixo', value: this.readMetric(inventorySummary, ['lowStockItems', 'itemsAtRisk']), tone: 'soft' },
      {
        label: 'Saldo disponível',
        value: this.readMetric(inventorySummary, ['totalAvailableAmount'], true),
        tone: 'default',
      },
    ];
  });

  readonly pendingStageEntries = computed(() =>
    Object.entries(this.dashboard()?.pendingByStage ?? {}).map(([key, value]) => ({
      label: formatLabel(key),
      value: String(value),
    })),
  );

  readonly inventoryEntries = computed(() =>
    Object.entries(this.dashboard()?.inventory?.summary ?? {}).map(([key, value]) => ({
      label: formatLabel(key),
      value: key.toLowerCase().includes('amount') ? formatCurrency(value) : String(value),
    })),
  );

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    this.dashboardService.getOperationalDashboard().subscribe({
      next: (response) => {
        this.dashboard.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar o dashboard operacional.'));
        this.dashboard.set(null);
        this.loading.set(false);
      },
    });
  }

  readMetric(source: Record<string, unknown>, keys: string[], currency = false): string {
    const key = keys.find((item) => item in source);
    const value = key ? source[key] : null;
    return currency ? formatCurrency(value) : value !== null && value !== undefined ? String(value) : '0';
  }

  getFirstString(source: Record<string, unknown>, keys: string[]): string {
    const key = keys.find((item) => source[item] !== undefined && source[item] !== null);
    return key ? String(source[key]) : 'Sem descrição';
  }

  stringifyItem(item: Record<string, unknown>): string {
    return Object.entries(item)
      .slice(0, 4)
      .map(([key, value]) => `${formatLabel(key)}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
      .join(' | ');
  }
}
