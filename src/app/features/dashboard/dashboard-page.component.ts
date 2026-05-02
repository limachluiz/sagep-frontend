import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { DashboardSummary } from '../../core/models/dashboard.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
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
    PageHeaderComponent,
    SectionCardComponent,
    SummaryCardComponent,
  ],
  template: `
    <section class="space-y-6">
      <app-page-header
        title="Visão inicial do fluxo de projetos"
        eyebrow="Dashboard operacional"
        subtitle="Dados vindos de /dashboard/operational, respeitando as permissões efetivas do usuário logado."
        [badge]="dashboard() ? 'Atualizado em ' + (dashboard()?.generatedAt | date: 'short') : ''"
      />

      @if (loading()) {
        <app-loading-state variant="cards" [count]="4" />
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
        <app-error-state
          title="Nao foi possivel carregar o dashboard"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadDashboard()"
        />
      } @else if (!dashboard()) {
        <app-empty-state
          title="Nenhum dado foi retornado pela API para o dashboard operacional"
          description="Verifique se existem dados disponíveis no backend ou tente novamente mais tarde."
        />
      } @else {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          @for (card of summaryCards(); track card.label) {
            <app-summary-card [title]="card.label" [value]="card.value" />
          }
        </div>

        <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <app-section-card title="Pendências por etapa">
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
          </app-section-card>

          <app-section-card title="Estoque e saldo da ATA">
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
          </app-section-card>
        </div>

        <div class="grid gap-6 xl:grid-cols-2">
          <app-section-card title="Fila operacional">
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
          </app-section-card>

          <app-section-card title="Proximas acoes mais frequentes">
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
    return key ? String(source[key]) : 'Sem descricao';
  }

  stringifyItem(item: Record<string, unknown>): string {
    return Object.entries(item)
      .slice(0, 4)
      .map(([key, value]) => `${formatLabel(key)}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
      .join(' | ');
  }
}
