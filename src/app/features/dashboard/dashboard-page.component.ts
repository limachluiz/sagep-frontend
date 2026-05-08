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
import { formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';

type SummaryTone = 'default' | 'accent' | 'soft' | 'success' | 'warning' | 'danger';

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
      subtitle="Visão institucional para acompanhamento do fluxo de projetos, pendências, estoque e próximas ações."
      [badge]="dashboard() ? 'Atualizado em ' + formatDateValue(dashboard()?.generatedAt) : 'Painel operacional'"
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
      <div class="workspace dashboard-workspace">
        <div class="hero-panel">
          <section class="card command-card">
            <div class="card-body">
              <span class="badge b-neutral">4º CTA · Operação</span>
              <h2>Controle operacional em tempo real</h2>
              <p>
                Dados operacionais consolidados para leitura de comando: volume, alertas, fila,
                pendências por etapa e sinais de estoque.
              </p>
              <div class="command-tiles">
                <div class="command-tile">
                  <b>{{ stageCountLabel() }}</b>
                  <span>etapas com pendência</span>
                </div>
                <div class="command-tile">
                  <b>{{ arrayCountLabel(dashboard()?.operationalQueue) }}</b>
                  <span>itens na fila</span>
                </div>
                <div class="command-tile">
                  <b>{{ arrayCountLabel(dashboard()?.frequentNextActions) }}</b>
                  <span>ações agregadas</span>
                </div>
                <div class="command-tile">
                  <b>{{ inventoryCountLabel() }}</b>
                  <span>indicadores de ATA</span>
                </div>
              </div>
            </div>
          </section>

          <app-section-card title="Leitura rápida" subtitle="Sinais disponíveis no payload atual.">
            <div class="detail-grid command-summary">
              <div class="detail-item">
                <label>Geração</label>
                <b>{{ formatDateValue(dashboard()?.generatedAt) }}</b>
              </div>
              <div class="detail-item">
                <label>Filtros</label>
                <b>{{ objectCountLabel(dashboard()?.filters) }}</b>
              </div>
              <div class="detail-item">
                <label>Alertas</label>
                <b>{{ objectCountLabel(dashboard()?.alerts) }}</b>
              </div>
            </div>
          </app-section-card>
        </div>

        <div class="grid grid-4">
          @for (card of summaryCards(); track card.label) {
            <app-summary-card
              [title]="card.label"
              [value]="card.value"
              [description]="card.description"
              [tone]="card.tone"
              [icon]="card.icon"
            />
          }
        </div>

        <div class="grid grid-2">
          <app-section-card title="Pendências por etapa" subtitle="Distribuição informada pelo dashboard operacional.">
            <div class="dashboard-list">
              @for (item of pendingStageEntries(); track item.label) {
                <div class="dashboard-row">
                  <div>
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
            <div class="inventory-grid">
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

        <div class="grid grid-2">
          <app-section-card title="Fila operacional" subtitle="Itens priorizados conforme resposta do dashboard.">
            <div class="dashboard-list">
              @for (item of dashboard()?.operationalQueue ?? []; track $index) {
                <article class="queue-item">
                  <span class="badge b-info">{{ getFirstString(item, ['status', 'stage', 'type']) }}</span>
                  <h3>{{ getFirstString(item, ['title', 'label', 'projectTitle', 'projectName', 'code']) }}</h3>
                  <p>{{ stringifyItem(item) }}</p>
                </article>
              } @empty {
                <div class="empty">
                  <p>Sem itens na fila operacional.</p>
                </div>
              }
            </div>
          </app-section-card>

          <app-section-card title="Próximas ações mais frequentes" subtitle="Agregados operacionais calculados pelo backend.">
            <div class="dashboard-list">
              @for (item of dashboard()?.frequentNextActions ?? []; track $index) {
                <div class="action-row">
                  <div>
                    <b>{{ getFirstString(item, ['label', 'code', 'action', 'name']) }}</b>
                    <span>{{ stringifyItem(item) }}</span>
                  </div>
                  <span class="badge b-info">{{ getFirstString(item, ['count', 'value', 'total']) }}</span>
                </div>
              } @empty {
                <div class="empty">
                  <p>Sem agregados de próxima ação no momento.</p>
                </div>
              }
            </div>
          </app-section-card>
        </div>

        @if (dashboard()?.latestMovements?.length) {
          <app-section-card title="Movimentações recentes" subtitle="Eventos recentes retornados pelo backend.">
            <div class="dashboard-list dashboard-list-compact">
              @for (item of dashboard()?.latestMovements ?? []; track $index) {
                <div class="action-row">
                  <div>
                    <b>{{ getFirstString(item, ['title', 'label', 'type', 'code']) }}</b>
                    <span>{{ stringifyItem(item) }}</span>
                  </div>
                </div>
              }
            </div>
          </app-section-card>
        }
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

  readonly summaryCards = computed<Array<{ label: string; value: string; description: string; icon: string; tone: SummaryTone }>>(() => {
    const summary = this.dashboard()?.summary ?? {};
    const inventorySummary = this.dashboard()?.inventory?.summary ?? {};
    const alerts = this.dashboard()?.alerts ?? {};

    return [
      {
        label: 'Projetos no resumo',
        value: this.readMetric(summary, ['totalProjects', 'projectsCount', 'projects']),
        description: 'Total informado em summary',
        icon: '▣',
        tone: 'default',
      },
      {
        label: 'Alertas ativos',
        value: this.readMetric(summary, ['totalAlerts', 'alertsCount', 'attentionItems'], false, alerts),
        description: 'Sinais de atenção no payload',
        icon: '!',
        tone: 'warning',
      },
      {
        label: 'Estoque baixo',
        value: this.readMetric(inventorySummary, ['lowStockItems', 'itemsAtRisk']),
        description: 'Itens em risco na ATA',
        icon: '▥',
        tone: 'danger',
      },
      {
        label: 'Saldo disponível',
        value: this.readMetric(inventorySummary, ['totalAvailableAmount'], true),
        description: 'Valor agregado retornado',
        icon: 'R$',
        tone: 'accent',
      },
    ];
  });

  readonly pendingStageEntries = computed(() =>
    Object.entries(this.dashboard()?.pendingByStage ?? {}).map(([key, value]) => ({
      label: formatLabel(key),
      value: this.displayValue(value),
    })),
  );

  readonly inventoryEntries = computed(() =>
    Object.entries(this.dashboard()?.inventory?.summary ?? {}).map(([key, value]) => ({
      label: formatLabel(key),
      value: key.toLowerCase().includes('amount') ? formatCurrency(value) : this.displayValue(value),
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

  readMetric(source: Record<string, unknown>, keys: string[], currency = false, fallbackObject?: Record<string, unknown>): string {
    const key = keys.find((item) => source[item] !== undefined && source[item] !== null);
    const value = key ? source[key] : null;

    if (value !== null && value !== undefined) {
      return currency ? formatCurrency(value) : this.displayValue(value);
    }

    if (fallbackObject && Object.keys(fallbackObject).length > 0) {
      return String(Object.keys(fallbackObject).length);
    }

    return 'Não informado';
  }

  getFirstString(source: Record<string, unknown>, keys: string[]): string {
    const key = keys.find((item) => source[item] !== undefined && source[item] !== null && source[item] !== '');
    return key ? this.displayValue(source[key]) : 'Não informado';
  }

  stringifyItem(item: Record<string, unknown>): string {
    const entries = Object.entries(item)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .slice(0, 4);

    if (!entries.length) {
      return 'Não informado';
    }

    return entries
      .map(([key, value]) => `${formatLabel(key)}: ${typeof value === 'object' ? JSON.stringify(value) : this.displayValue(value)}`)
      .join(' | ');
  }

  barWidth(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(8, Math.min(100, parsed * 10)) : 12;
  }

  formatDateValue(value: unknown): string {
    return formatDate(value);
  }

  arrayCountLabel(value: unknown[] | undefined): string {
    return Array.isArray(value) ? String(value.length) : 'Não informado';
  }

  objectCountLabel(value: Record<string, unknown> | undefined): string {
    return value ? String(Object.keys(value).length) : 'Não informado';
  }

  stageCountLabel(): string {
    return this.dashboard()?.pendingByStage ? String(this.pendingStageEntries().length) : 'Não informado';
  }

  inventoryCountLabel(): string {
    return this.dashboard()?.inventory?.summary ? String(this.inventoryEntries().length) : 'Não informado';
  }

  private displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return 'Não informado';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }
}
