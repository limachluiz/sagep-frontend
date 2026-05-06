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
    <app-page-header
      title="Painel de Comando"
      eyebrow="Dashboard operacional"
      subtitle="Visão padrão para acompanhamento rápido do fluxo de projetos, gargalos e próximas ações."
      [badge]="dashboard() ? 'Atualizado em ' + (dashboard()?.generatedAt | date: 'short') : 'Fonte: /dashboard/operational'"
    />

    @if (loading()) {
      <div class="workspace">
        <div class="card">
          <div class="card-body">
            <app-loading-state variant="cards" [count]="4" />
          </div>
        </div>
      </div>
    } @else if (forbidden()) {
      <div class="workspace">
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
      <div class="workspace">
        <app-error-state
          title="Não foi possível carregar o dashboard"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadDashboard()"
        />
      </div>
    } @else if (!dashboard()) {
      <div class="workspace">
        <app-empty-state
          title="Nenhum dado foi retornado pela API para o dashboard operacional"
          description="Verifique se existem dados disponíveis no backend ou tente novamente mais tarde."
        />
      </div>
    } @else {
      <div class="workspace">
        <div class="hero-panel">
          <section class="card command-card">
            <div class="card-body">
              <span class="badge b-neutral">4º CTA · Operação</span>
              <h2>Controle diário do fluxo de projetos</h2>
              <p>
                Leitura consolidada dos dados reais retornados pelo backend para orientar priorização, pendências e acompanhamento documental.
              </p>
              <div class="command-tiles">
                <div class="command-tile">
                  <b>{{ pendingStageEntries().length }}</b>
                  <span>etapas com pendência</span>
                </div>
                <div class="command-tile">
                  <b>{{ dashboard()?.operationalQueue?.length ?? 0 }}</b>
                  <span>itens na fila</span>
                </div>
                <div class="command-tile">
                  <b>{{ dashboard()?.frequentNextActions?.length ?? 0 }}</b>
                  <span>ações agregadas</span>
                </div>
                <div class="command-tile">
                  <b>{{ inventoryEntries().length }}</b>
                  <span>indicadores de ATA</span>
                </div>
              </div>
            </div>
          </section>

          <app-section-card title="Resumo do comando" subtitle="Sinais operacionais disponíveis no payload atual.">
            <div class="detail-grid">
              <div class="detail-item">
                <label>Geração</label>
                <b>{{ dashboard()?.generatedAt ? (dashboard()?.generatedAt | date: 'short') : 'Não informado' }}</b>
              </div>
              <div class="detail-item">
                <label>Fila</label>
                <b>{{ dashboard()?.operationalQueue?.length ?? 'Não informado' }}</b>
              </div>
              <div class="detail-item">
                <label>Ações</label>
                <b>{{ dashboard()?.frequentNextActions?.length ?? 'Não informado' }}</b>
              </div>
            </div>
          </app-section-card>
        </div>

        <div class="grid grid-4" style="margin-top:16px">
          @for (card of summaryCards(); track card.label) {
            <app-summary-card [title]="card.label" [value]="card.value" [tone]="card.tone" />
          }
        </div>

        <div class="grid grid-2" style="margin-top:16px">
          <app-section-card title="Pendências por etapa" subtitle="Distribuição informada pelo dashboard operacional.">
            <div class="grid">
              @for (item of pendingStageEntries(); track item.label) {
                <div>
                  <div class="mb-1 flex justify-between text-sm">
                    <b>{{ item.label }}</b>
                    <span>{{ item.value }}</span>
                  </div>
                  <div class="progress"><i [style.width.%]="barWidth(item.value)"></i></div>
                </div>
              } @empty {
                <div class="empty">
                  <p>Nenhuma etapa pendente retornada.</p>
                </div>
              }
            </div>
          </app-section-card>

          <app-section-card title="Estoque e saldo da ATA" subtitle="Resumo de disponibilidade retornado pela API.">
            <div class="grid">
              @for (item of inventoryEntries(); track item.label) {
                <div class="detail-item">
                  <label>{{ item.label }}</label>
                  <b>{{ item.value }}</b>
                </div>
              } @empty {
                <div class="empty">
                  <p>O backend não retornou resumo de inventário.</p>
                </div>
              }
            </div>
          </app-section-card>
        </div>

        <div class="grid grid-2" style="margin-top:16px">
          <app-section-card title="Fila operacional" subtitle="Itens priorizados conforme resposta do dashboard.">
            <div class="grid">
              @for (item of dashboard()?.operationalQueue ?? []; track $index) {
                <article class="detail-item">
                  <label>{{ getFirstString(item, ['title', 'label', 'projectTitle']) }}</label>
                  <b>{{ stringifyItem(item) }}</b>
                </article>
              } @empty {
                <div class="empty">
                  <p>Sem itens na fila operacional.</p>
                </div>
              }
            </div>
          </app-section-card>

          <app-section-card title="Próximas ações mais frequentes" subtitle="Agregados operacionais calculados pelo backend.">
            <div class="grid">
              @for (item of dashboard()?.frequentNextActions ?? []; track $index) {
                <div class="flex items-center justify-between border-b border-[var(--line)] py-3">
                  <span>{{ getFirstString(item, ['label', 'code', 'action']) }}</span>
                  <span class="badge b-info">{{ getFirstString(item, ['count', 'value']) }}</span>
                </div>
              } @empty {
                <div class="empty">
                  <p>Sem agregados de próxima ação no momento.</p>
                </div>
              }
            </div>
          </app-section-card>
        </div>
      </div>
    }
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

  barWidth(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(8, Math.min(100, parsed * 10)) : 12;
  }
}
