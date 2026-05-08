import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import {
  DashboardSummary,
  ExecutiveDashboardFilters,
  ExecutiveDashboardSummary,
} from '../../core/models/dashboard.model';
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
type DashboardMode = 'operational' | 'executive';
type ExecutivePeriod = 'month' | 'quarter' | 'semester' | 'year' | 'manual';
type ChartEntry = { label: string; value: string; raw: unknown; percent: number };

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
      [eyebrow]="viewMode() === 'executive' ? 'Dashboard executivo' : 'Dashboard operacional'"
      [subtitle]="viewMode() === 'executive'
        ? 'Visão executiva para acompanhamento de projetos, valores, documentos emitidos e sinais de risco.'
        : 'Visão institucional para acompanhamento do fluxo de projetos, pendências, estoque e próximas ações.'"
      [badge]="currentBadge()"
    />

    <div class="workspace dashboard-controls">
      <div class="dashboard-switch" aria-label="Alternar visão do dashboard">
        <button
          type="button"
          [class.active]="viewMode() === 'operational'"
          (click)="setViewMode('operational')"
        >
          Operacional
        </button>
        <button
          type="button"
          [class.active]="viewMode() === 'executive'"
          (click)="setViewMode('executive')"
        >
          Executivo
        </button>
      </div>

      @if (viewMode() === 'executive') {
        <div class="executive-filters" aria-label="Filtros executivos">
          @for (option of executivePeriodOptions; track option.value) {
            <button
              type="button"
              [class.active]="executivePeriod() === option.value"
              (click)="setExecutivePeriod(option.value)"
            >
              {{ option.label }}
            </button>
          }
          @if (executivePeriod() === 'manual') {
            <input
              type="date"
              class="input"
              aria-label="Data inicial"
              [value]="executiveStartDate()"
              (change)="setExecutiveDate('startDate', $any($event.target).value)"
            />
            <input
              type="date"
              class="input"
              aria-label="Data final"
              [value]="executiveEndDate()"
              (change)="setExecutiveDate('endDate', $any($event.target).value)"
            />
          } @else {
            <input
              type="date"
              class="input"
              aria-label="Data de referência"
              [value]="executiveReferenceDate()"
              (change)="setExecutiveDate('referenceDate', $any($event.target).value)"
            />
          }
          <input
            type="date"
            class="input"
            aria-label="Data de posição"
            [value]="executiveAsOfDate()"
            (change)="setExecutiveDate('asOfDate', $any($event.target).value)"
          />
          <button type="button" class="active" (click)="loadDashboard()">Aplicar</button>
        </div>
      }
    </div>

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
    } @else if (viewMode() === 'executive' && !executiveDashboard()) {
      <div class="workspace">
        <app-empty-state
          title="Nenhum dado foi retornado pela API para o dashboard executivo"
          description="A visão executiva está disponível, mas o backend não retornou indicadores para exibir."
        />
      </div>
    } @else if (viewMode() === 'executive') {
      <div class="workspace dashboard-workspace executive-workspace">
        <div class="hero-panel">
          <section class="card command-card">
            <div class="card-body">
              <span class="badge b-neutral">4º CTA · Executivo</span>
              <h2>Visão executiva consolidada</h2>
              <p>
                Indicadores agregados para leitura de gestão: projetos, valores, documentos,
                distribuição territorial e sinais de saldo ou risco da ATA.
              </p>
              <div class="command-tiles">
                <div class="command-tile">
                  <b>{{ executiveMetric(['totalProjects', 'projectsCount', 'projectsTotal']) }}</b>
                  <span>projetos</span>
                </div>
                <div class="command-tile">
                  <b>{{ executiveCurrency(['totalEstimatedValue', 'estimatedTotal', 'estimatedAmount']) }}</b>
                  <span>valor estimado</span>
                </div>
                <div class="command-tile">
                  <b>{{ executiveMetric(['issuedDocuments', 'documentsIssued', 'documentsTotal']) }}</b>
                  <span>documentos emitidos</span>
                </div>
                <div class="command-tile">
                  <b>{{ executiveAtaRiskLabel() }}</b>
                  <span>saldo/risco ATA</span>
                </div>
              </div>
            </div>
          </section>

          <app-section-card title="Filtros" subtitle="Controles de período disponíveis para a visão executiva.">
            <div class="detail-grid command-summary">
              <div class="detail-item">
                <label>Período selecionado</label>
                <b>{{ executivePeriodLabel() }}</b>
              </div>
              <div class="detail-item">
                <label>Filtros aplicados pela API</label>
                <b>{{ objectCountLabel(executiveDashboard()?.filters) }}</b>
              </div>
              <div class="detail-item">
                <label>Geração</label>
                <b>{{ formatDateValue(executiveDashboard()?.generatedAt) }}</b>
              </div>
            </div>
          </app-section-card>
        </div>

        <div class="grid grid-4">
          @for (card of executiveCards(); track card.label) {
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
          <app-section-card title="Valor por status/fase" subtitle="Distribuição financeira retornada pelo backend.">
            <div class="dashboard-list">
              @for (item of executiveValueEntries(); track item.label) {
                <div class="dashboard-row">
                  <div>
                    <b>{{ item.label }}</b>
                    <span>{{ item.value }}</span>
                  </div>
                  <div class="progress"><i [style.width.%]="barWidth(item.raw)"></i></div>
                </div>
              } @empty {
                <div class="empty">
                  <p>Sem distribuição por status ou fase.</p>
                </div>
              }
            </div>
          </app-section-card>

          <app-section-card title="Projetos por UF/região" subtitle="Distribuição territorial da carteira.">
            <div class="dashboard-list">
              @for (item of executiveLocationEntries(); track item.label) {
                <div class="action-row">
                  <div>
                    <b>{{ item.label }}</b>
                    <span>{{ item.value }}</span>
                  </div>
                </div>
              } @empty {
                <div class="empty">
                  <p>Sem distribuição territorial no payload.</p>
                </div>
              }
            </div>
          </app-section-card>
        </div>

        <div class="grid grid-2">
          <app-section-card title="Documentos emitidos" subtitle="Totais de documentos informados pela API.">
            <div class="inventory-grid">
              @for (item of executiveDocumentEntries(); track item.label) {
                <div class="detail-item">
                  <label>{{ item.label }}</label>
                  <b>{{ item.value }}</b>
                </div>
              } @empty {
                <div class="empty">
                  <p>Sem indicadores de documentos emitidos.</p>
                </div>
              }
            </div>
          </app-section-card>

          <app-section-card title="Saldo e risco da ATA" subtitle="Indicadores retornados quando disponíveis no payload.">
            <div class="inventory-grid">
              @for (item of executiveAtaEntries(); track item.label) {
                <div class="detail-item">
                  <label>{{ item.label }}</label>
                  <b>{{ item.value }}</b>
                </div>
              } @empty {
                <div class="empty">
                  <p>Sem indicadores de saldo ou risco da ATA.</p>
                </div>
              }
            </div>
          </app-section-card>
        </div>

        <section class="executive-chart-grid">
          @if (executivePhaseEntries().length) {
            <article class="executive-panel">
              <header>
                <h3>Projetos por fase</h3>
                <span>{{ executivePhaseEntries().length }} fases</span>
              </header>
              <div class="executive-bars">
                @for (item of executivePhaseEntries(); track item.label) {
                  <div class="executive-bar-row">
                    <div>
                      <b>{{ item.label }}</b>
                      <span>{{ item.value }}</span>
                    </div>
                    <i><em [style.width.%]="item.percent"></em></i>
                  </div>
                }
              </div>
            </article>
          }

          @if (executiveEvolutionEntries().length) {
            <article class="executive-panel">
              <header>
                <h3>Evolução no tempo</h3>
                <span>{{ executiveEvolutionEntries().length }} pontos</span>
              </header>
              <div class="sparkline-bars">
                @for (item of executiveEvolutionEntries(); track item.label) {
                  <i [style.height.%]="item.percent" [title]="item.label + ': ' + item.value"></i>
                }
              </div>
              <div class="sparkline-caption">
                <span>{{ executiveEvolutionEntries()[0]?.label }}</span>
                <span>{{ executiveEvolutionEntries()[executiveEvolutionEntries().length - 1]?.label }}</span>
              </div>
            </article>
          }

          @if (executiveSupplierEntries().length) {
            <article class="executive-panel">
              <header>
                <h3>Fornecedor / tipo de ATA</h3>
                <span>{{ executiveSupplierEntries().length }} grupos</span>
              </header>
              <div class="executive-bars">
                @for (item of executiveSupplierEntries(); track item.label) {
                  <div class="executive-bar-row">
                    <div>
                      <b>{{ item.label }}</b>
                      <span>{{ item.value }}</span>
                    </div>
                    <i><em [style.width.%]="item.percent"></em></i>
                  </div>
                }
              </div>
            </article>
          }
        </section>

        <section class="executive-list-grid">
          @if (topProjectEntries().length) {
            <article class="executive-panel">
              <header><h3>Top projetos por valor</h3></header>
              <div class="executive-list">
                @for (item of topProjectEntries(); track $index) {
                  <div>
                    <b>{{ getFirstString(item, ['title', 'projectTitle', 'projectName', 'name', 'code']) }}</b>
                    <span>{{ getFirstString(item, ['om', 'omName', 'phase', 'stage', 'status']) }}</span>
                    <strong>{{ firstCurrency(item, ['value', 'totalValue', 'estimatedValue', 'amount']) }}</strong>
                  </div>
                }
              </div>
            </article>
          }

          @if (riskProjectEntries().length) {
            <article class="executive-panel">
              <header><h3>Projetos com risco</h3></header>
              <div class="executive-list risk">
                @for (item of riskProjectEntries(); track $index) {
                  <div>
                    <b>{{ getFirstString(item, ['title', 'projectTitle', 'projectName', 'name', 'code']) }}</b>
                    <span>{{ getFirstString(item, ['risk', 'riskLevel', 'reason', 'status']) }}</span>
                    <strong>{{ getFirstString(item, ['nextAction', 'action', 'stage']) }}</strong>
                  </div>
                }
              </div>
            </article>
          }

          @if (criticalActionEntries().length) {
            <article class="executive-panel">
              <header><h3>Próximas ações críticas</h3></header>
              <div class="executive-list">
                @for (item of criticalActionEntries(); track $index) {
                  <div>
                    <b>{{ getFirstString(item, ['title', 'action', 'nextAction', 'label']) }}</b>
                    <span>{{ getFirstString(item, ['projectTitle', 'projectName', 'owner', 'omName']) }}</span>
                    <strong>{{ getFirstString(item, ['dueDate', 'deadline', 'status', 'priority']) }}</strong>
                  </div>
                }
              </div>
            </article>
          }

          @if (criticalAtaItemEntries().length) {
            <article class="executive-panel">
              <header><h3>Itens críticos da ATA</h3></header>
              <div class="executive-list risk">
                @for (item of criticalAtaItemEntries(); track $index) {
                  <div>
                    <b>{{ getFirstString(item, ['description', 'itemDescription', 'name', 'code']) }}</b>
                    <span>{{ getFirstString(item, ['ataNumber', 'ataCode', 'supplierName', 'status']) }}</span>
                    <strong>{{ getFirstString(item, ['balance', 'availableBalance', 'risk', 'quantity']) }}</strong>
                  </div>
                }
              </div>
            </article>
          }

          @if (executiveAlertEntries().length) {
            <article class="executive-panel">
              <header><h3>Alertas relevantes</h3></header>
              <div class="executive-list risk">
                @for (item of executiveAlertEntries(); track $index) {
                  <div>
                    <b>{{ getFirstString(item, ['title', 'label', 'type', 'message']) }}</b>
                    <span>{{ stringifyItem(item) }}</span>
                  </div>
                }
              </div>
            </article>
          }
        </section>

        @if (executiveTableRows().length) {
          <article class="executive-panel executive-table-panel">
            <header>
              <h3>Resumo executivo da carteira</h3>
              <span>{{ executiveTableRows().length }} registros</span>
            </header>
            <div class="table-wrap">
              <table class="data-table executive-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>OM</th>
                    <th>Fase</th>
                    <th>Valor</th>
                    <th>Próxima ação</th>
                    <th>Risco</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of executiveTableRows(); track $index) {
                    <tr>
                      <td>{{ getFirstString(item, ['title', 'projectTitle', 'projectName', 'name', 'code']) }}</td>
                      <td>{{ getFirstString(item, ['om', 'omName', 'militaryOrganizationName', 'omSigla']) }}</td>
                      <td>{{ getFirstString(item, ['phase', 'stage', 'status']) }}</td>
                      <td>{{ firstCurrency(item, ['value', 'totalValue', 'estimatedValue', 'amount']) }}</td>
                      <td>{{ getFirstString(item, ['nextAction', 'action', 'pendingAction']) }}</td>
                      <td>{{ getFirstString(item, ['risk', 'riskLevel', 'riskStatus']) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </article>
        }
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
  readonly executiveDashboard = signal<ExecutiveDashboardSummary | null>(null);
  readonly viewMode = signal<DashboardMode>('operational');
  readonly executivePeriod = signal<ExecutivePeriod>('month');
  readonly executiveReferenceDate = signal('');
  readonly executiveStartDate = signal('');
  readonly executiveEndDate = signal('');
  readonly executiveAsOfDate = signal('');

  readonly executivePeriodOptions: Array<{ label: string; value: ExecutivePeriod }> = [
    { label: 'Mês', value: 'month' },
    { label: 'Trimestre', value: 'quarter' },
    { label: 'Semestre', value: 'semester' },
    { label: 'Ano', value: 'year' },
    { label: 'Intervalo manual', value: 'manual' },
  ];

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

  readonly executiveCards = computed<Array<{ label: string; value: string; description: string; icon: string; tone: SummaryTone }>>(() => [
    {
      label: 'Total de projetos',
      value: this.executiveMetric(['totalProjects', 'projectsCount', 'projectsTotal']),
      description: 'Carteira consolidada',
      icon: '□',
      tone: 'default',
    },
    {
      label: 'Valor estimado total',
      value: this.executiveCurrency(['totalEstimatedValue', 'estimatedTotal', 'estimatedAmount']),
      description: 'Soma informada pela API',
      icon: 'R$',
      tone: 'accent',
    },
    {
      label: 'Valor em execução',
      value: this.executiveCurrency(['valueInExecution', 'executionValue', 'inExecutionAmount']),
      description: 'Carteira em andamento',
      icon: '▶',
      tone: 'soft',
    },
    {
      label: 'Valor concluído',
      value: this.executiveCurrency(['completedValue', 'concludedValue', 'finishedAmount']),
      description: 'Valor encerrado',
      icon: '✓',
      tone: 'success',
    },
    {
      label: 'Projetos com risco',
      value: this.executiveMetric(['projectsAtRiskCount', 'riskProjects', 'projectsAtRisk']),
      description: 'Risco informado pela API',
      icon: '!',
      tone: 'danger',
    },
    {
      label: 'Saldo disponível ATA',
      value: this.executiveCurrency(['availableAtaBalance', 'ataAvailableBalance', 'totalAvailableAmount']),
      description: 'Saldo disponível',
      icon: 'R$',
      tone: 'accent',
    },
    {
      label: 'Itens críticos ATA',
      value: this.executiveMetric(['criticalAtaItemsCount', 'criticalAtaItems', 'lowStockItems', 'itemsAtRisk']),
      description: 'Itens em atenção',
      icon: '!',
      tone: 'warning',
    },
    {
      label: 'Taxa de conclusão',
      value: this.executivePercent(['completionRate', 'conclusionRate', 'completedPercent']),
      description: 'Percentual consolidado',
      icon: '%',
      tone: 'success',
    },
    {
      label: 'Documentos emitidos',
      value: this.executiveMetric(['issuedDocuments', 'documentsIssued', 'documentsTotal']),
      description: 'DIEx, OS e demais documentos',
      icon: '§',
      tone: 'success',
    },
    {
      label: 'Saldo/risco ATA',
      value: this.executiveAtaRiskLabel(),
      description: 'Indicadores retornados no payload',
      icon: '!',
      tone: 'warning',
    },
  ]);

  readonly executiveValueEntries = computed(() =>
    this.chartEntriesFromRecords(
      [
        this.asRecord(this.executiveDashboard()?.valueByStatus),
        this.asRecord(this.executiveDashboard()?.valueByStage),
        this.asRecord(this.executiveDashboard()?.byStatus),
        this.asRecord(this.executiveDashboard()?.byStage),
      ],
      true,
    ),
  );

  readonly executiveLocationEntries = computed(() =>
    this.chartEntriesFromRecords([
      this.asRecord(this.executiveDashboard()?.projectsByUf),
      this.asRecord(this.executiveDashboard()?.projectsByRegion),
    ]),
  );

  readonly executiveDocumentEntries = computed(() =>
    this.chartEntriesFromRecords([
      this.asRecord(this.executiveDashboard()?.issuedDocuments),
      this.asRecord(this.executiveDashboard()?.documents),
    ]),
  );

  readonly executiveAtaEntries = computed(() =>
    this.chartEntriesFromRecords([
      this.asRecord(this.executiveDashboard()?.ataBalance),
      this.asRecord(this.executiveDashboard()?.ata),
      this.asRecord(this.executiveDashboard()?.risks),
    ]),
  );

  readonly executivePhaseEntries = computed(() =>
    this.chartEntriesFromRecords([
      this.asRecord(this.executiveDashboard()?.byStage),
      this.asRecord(this.executiveDashboard()?.byStatus),
    ]),
  );

  readonly executiveEvolutionEntries = computed(() =>
    this.chartEntriesFromUnknown(
      this.executiveDashboard()?.timeline ??
        this.executiveDashboard()?.evolution ??
        this.executiveDashboard()?.timeSeries,
    ),
  );

  readonly executiveSupplierEntries = computed(() =>
    this.chartEntriesFromRecords([
      this.asRecord(this.executiveDashboard()?.bySupplier),
      this.asRecord(this.executiveDashboard()?.byAtaType),
    ]),
  );

  readonly topProjectEntries = computed(() =>
    this.asArray(this.executiveDashboard()?.topProjects).slice(0, 6),
  );

  readonly riskProjectEntries = computed(() =>
    this.asArray(this.executiveDashboard()?.projectsAtRisk).slice(0, 6),
  );

  readonly criticalActionEntries = computed(() =>
    [
      ...this.asArray(this.executiveDashboard()?.nextCriticalActions),
      ...this.asArray(this.executiveDashboard()?.criticalActions),
    ].slice(0, 6),
  );

  readonly criticalAtaItemEntries = computed(() =>
    this.asArray(this.executiveDashboard()?.criticalAtaItems).slice(0, 6),
  );

  readonly executiveAlertEntries = computed(() =>
    [
      ...this.asArray(this.executiveDashboard()?.relevantAlerts),
      ...this.asArray(this.executiveDashboard()?.alerts),
      ...this.asArray(this.executiveDashboard()?.latestMovements),
      ...this.asArray(this.executiveDashboard()?.movements),
    ].slice(0, 6),
  );

  readonly executiveTableRows = computed(() =>
    [
      ...this.asArray(this.executiveDashboard()?.projectsSummary),
      ...this.asArray(this.executiveDashboard()?.projectSummaries),
      ...this.topProjectEntries(),
      ...this.riskProjectEntries(),
    ].slice(0, 12),
  );

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    if (this.viewMode() === 'executive') {
      this.dashboardService.getExecutiveDashboard(this.executiveFilters()).subscribe({
        next: (response) => {
          this.executiveDashboard.set(response);
          this.loading.set(false);
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar o dashboard executivo.'));
          this.executiveDashboard.set(null);
          this.loading.set(false);
        },
      });
      return;
    }

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

  setViewMode(mode: DashboardMode): void {
    if (this.viewMode() === mode) {
      return;
    }

    this.viewMode.set(mode);
    this.loadDashboard();
  }

  setExecutivePeriod(period: ExecutivePeriod): void {
    this.executivePeriod.set(period);
    if (period !== 'manual') {
      this.loadDashboard();
    }
  }

  setExecutiveDate(
    field: 'referenceDate' | 'startDate' | 'endDate' | 'asOfDate',
    value: string,
  ): void {
    if (field === 'referenceDate') this.executiveReferenceDate.set(value);
    if (field === 'startDate') this.executiveStartDate.set(value);
    if (field === 'endDate') this.executiveEndDate.set(value);
    if (field === 'asOfDate') this.executiveAsOfDate.set(value);
  }

  currentBadge(): string {
    if (this.viewMode() === 'executive') {
      return this.executiveDashboard()?.generatedAt
        ? 'Atualizado em ' + this.formatDateValue(this.executiveDashboard()?.generatedAt)
        : 'Painel executivo';
    }

    return this.dashboard() ? 'Atualizado em ' + this.formatDateValue(this.dashboard()?.generatedAt) : 'Painel operacional';
  }

  activeExecutiveFilterSummary(): string {
    const filters = this.executiveFilters();
    const parts = [
      `Período: ${this.executivePeriodLabel()}`,
      filters.referenceDate ? `referência ${this.formatDateValue(filters.referenceDate)}` : '',
      filters.startDate && filters.endDate
        ? `${this.formatDateValue(filters.startDate)} a ${this.formatDateValue(filters.endDate)}`
        : '',
      filters.asOfDate ? `posição ${this.formatDateValue(filters.asOfDate)}` : '',
    ].filter(Boolean);

    return parts.join(' · ') || 'Sem filtros adicionais aplicados.';
  }

  executiveRecordLabel(): string {
    const count =
      this.topProjectEntries().length +
      this.riskProjectEntries().length +
      this.criticalActionEntries().length +
      this.executiveAlertEntries().length;

    return count ? `${count} sinais executivos` : 'Dados consolidados';
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

  barWidth(value: unknown): number {
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

  executiveMetric(keys: string[]): string {
    const value = this.firstExecutiveValue(keys);
    return value === undefined ? 'Não informado' : this.displayValue(value);
  }

  executiveCurrency(keys: string[]): string {
    const value = this.firstExecutiveValue(keys);
    return value === undefined ? 'Não informado' : formatCurrency(value);
  }

  executivePercent(keys: string[]): string {
    const value = this.firstExecutiveValue(keys);
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return value === undefined ? 'Não informado' : this.displayValue(value);
    }

    return `${parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed)}%`;
  }

  executivePeriodLabel(): string {
    return this.executivePeriodOptions.find((option) => option.value === this.executivePeriod())?.label ?? 'Mês';
  }

  executiveAtaRiskLabel(): string {
    const value = this.firstExecutiveValue([
      'ataRisk',
      'riskLevel',
      'criticalAtaItems',
      'itemsAtRisk',
      'lowBalanceItems',
    ]);

    if (value !== undefined) {
      return this.displayValue(value);
    }

    return this.executiveAtaEntries().length ? String(this.executiveAtaEntries().length) : 'Não informado';
  }

  firstCurrency(source: Record<string, unknown>, keys: string[]): string {
    const key = keys.find((item) => source[item] !== undefined && source[item] !== null && source[item] !== '');
    return key ? formatCurrency(source[key]) : 'Não informado';
  }

  private executiveFilters(): ExecutiveDashboardFilters {
    const filters: ExecutiveDashboardFilters = {};
    const period = this.executivePeriod();

    if (period !== 'manual') {
      filters.periodType = period;
    }

    if (period === 'manual') {
      if (this.executiveStartDate()) filters.startDate = this.executiveStartDate();
      if (this.executiveEndDate()) filters.endDate = this.executiveEndDate();
    } else if (this.executiveReferenceDate()) {
      filters.referenceDate = this.executiveReferenceDate();
    }

    if (this.executiveAsOfDate()) {
      filters.asOfDate = this.executiveAsOfDate();
    }

    return filters;
  }

  private firstExecutiveValue(keys: string[]): unknown {
    const dashboard = this.executiveDashboard();

    if (!dashboard) {
      return undefined;
    }

    const sources = [
      dashboard,
      this.asRecord(dashboard.summary),
      this.asRecord(dashboard.totals),
      this.asRecord(dashboard.projects),
      this.asRecord(dashboard.financial),
      this.asRecord(dashboard.documents),
      this.asRecord(dashboard.issuedDocuments),
      this.asRecord(dashboard.ata),
      this.asRecord(dashboard.ataBalance),
      this.asRecord(dashboard.risks),
    ];

    for (const source of sources) {
      const key = keys.find((item) => source[item] !== undefined && source[item] !== null && source[item] !== '');

      if (key) {
        return source[key];
      }
    }

    return undefined;
  }

  private chartEntriesFromRecords(records: Record<string, unknown>[], currency = false): ChartEntry[] {
    const entries = records
      .flatMap((record) => Object.entries(record))
      .filter(([, value]) => value !== undefined && value !== null && value !== '');

    return this.withPercent(
      entries.map(([key, value]) => ({
        label: formatLabel(key),
        value: currency ? formatCurrency(value) : this.displayValue(value),
        raw: value,
      })),
    );
  }

  private chartEntriesFromUnknown(value: unknown): ChartEntry[] {
    if (Array.isArray(value)) {
      return this.withPercent(
        value
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map((item) => {
            const label = this.getFirstString(item, ['label', 'period', 'month', 'date', 'name']);
            const raw =
              item['value'] ??
              item['total'] ??
              item['amount'] ??
              item['count'] ??
              item['totalProjects'];

            return {
              label,
              value: this.displayValue(raw),
              raw,
            };
          }),
      );
    }

    return this.chartEntriesFromRecords([this.asRecord(value)]);
  }

  private withPercent(entries: Array<{ label: string; value: string; raw: unknown }>): ChartEntry[] {
    const max = Math.max(
      ...entries.map((entry) => {
        const parsed = Number(entry.raw);
        return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
      }),
      1,
    );

    return entries.map((entry) => {
      const parsed = Number(entry.raw);
      const percent = Number.isFinite(parsed)
        ? Math.max(8, Math.min(100, (Math.abs(parsed) / max) * 100))
        : 12;

      return { ...entry, percent };
    });
  }

  private asArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
