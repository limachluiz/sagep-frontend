import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { DashboardSummary } from '../../core/models/dashboard.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { formatCurrency, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, AccessDeniedStateComponent],
  template: `
    <section class="space-y-6">
      <div class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
        <p class="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Dashboard operacional</p>
        <div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 class="text-3xl font-semibold text-slate-950">Visão inicial do fluxo de projetos</h1>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Dados vindos de <code>/dashboard/operational</code>, respeitando as permissões efetivas do usuário logado.
            </p>
          </div>
          @if (dashboard()) {
            <div class="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
              Atualizado em {{ dashboard()?.generatedAt | date: 'short' }}
            </div>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="h-32 animate-pulse rounded-3xl bg-white/80 shadow-[var(--sagep-shadow)]"></div>
          }
        </div>
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu perfil atual não possui acesso a este dashboard."
          description="A API retornou acesso negado para a visão operacional. A sessão permanece ativa e você pode seguir para outros módulos disponíveis."
          primaryLink="/projects"
          primaryLabel="Ir para projetos"
          secondaryLink="/dashboard"
          secondaryLabel="Recarregar rota"
        />
      } @else if (errorMessage()) {
        <div class="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 class="text-lg font-semibold">Nao foi possivel carregar o dashboard</h2>
          <p class="mt-2 text-sm">{{ errorMessage() }}</p>
        </div>
      } @else if (!dashboard()) {
        <div class="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-[var(--sagep-shadow)]">
          Nenhum dado foi retornado pela API para o dashboard operacional.
        </div>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          @for (card of summaryCards(); track card.label) {
            <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-[var(--sagep-shadow)]">
              <p class="text-xs uppercase tracking-[0.24em] text-slate-500">{{ card.label }}</p>
              <p class="mt-4 text-3xl font-semibold text-slate-950">{{ card.value }}</p>
            </article>
          }
        </div>

        <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Pendências por etapa</h2>
            <div class="mt-5 space-y-3">
              @for (item of pendingStageEntries(); track item.label) {
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span class="text-sm font-medium text-slate-700">{{ item.label }}</span>
                  <span class="text-sm font-semibold text-slate-950">{{ item.value }}</span>
                </div>
              } @empty {
                <p class="text-sm text-slate-500">Nenhuma etapa pendente retornada.</p>
              }
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Estoque e saldo da ATA</h2>
            <div class="mt-5 space-y-3">
              @for (item of inventoryEntries(); track item.label) {
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span class="text-sm text-slate-700">{{ item.label }}</span>
                  <span class="text-sm font-semibold text-slate-950">{{ item.value }}</span>
                </div>
              } @empty {
                <p class="text-sm text-slate-500">O backend nao retornou resumo de inventario.</p>
              }
            </div>
          </section>
        </div>

        <div class="grid gap-6 xl:grid-cols-2">
          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Fila operacional</h2>
            <div class="mt-5 space-y-3">
              @for (item of dashboard()?.operationalQueue ?? []; track $index) {
                <div class="rounded-2xl border border-slate-200 p-4">
                  <p class="text-sm font-semibold text-slate-900">{{ getFirstString(item, ['title', 'label', 'projectTitle']) }}</p>
                  <p class="mt-2 text-sm text-slate-600">{{ stringifyItem(item) }}</p>
                </div>
              } @empty {
                <p class="text-sm text-slate-500">Sem itens na fila operacional.</p>
              }
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Proximas acoes mais frequentes</h2>
            <div class="mt-5 space-y-3">
              @for (item of dashboard()?.frequentNextActions ?? []; track $index) {
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span class="text-sm text-slate-700">{{ getFirstString(item, ['label', 'code', 'action']) }}</span>
                  <span class="text-sm font-semibold text-slate-950">{{ getFirstString(item, ['count', 'value']) }}</span>
                </div>
              } @empty {
                <p class="text-sm text-slate-500">Sem agregados de proxima acao no momento.</p>
              }
            </div>
          </section>
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

  readonly summaryCards = computed(() => {
    const summary = this.dashboard()?.summary ?? {};
    const inventorySummary = this.dashboard()?.inventory?.summary ?? {};

    return [
      { label: 'Projetos no resumo', value: this.readMetric(summary, ['totalProjects', 'projectsCount', 'projects']) },
      { label: 'Alertas ativos', value: this.readMetric(summary, ['totalAlerts', 'alertsCount', 'attentionItems']) },
      { label: 'Itens com estoque baixo', value: this.readMetric(inventorySummary, ['lowStockItems', 'itemsAtRisk']) },
      {
        label: 'Saldo disponivel',
        value: this.readMetric(inventorySummary, ['totalAvailableAmount'], true),
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
    return key ? String(source[key]) : 'Sem descricao';
  }

  stringifyItem(item: Record<string, unknown>): string {
    return Object.entries(item)
      .slice(0, 4)
      .map(([key, value]) => `${formatLabel(key)}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
      .join(' | ');
  }
}
