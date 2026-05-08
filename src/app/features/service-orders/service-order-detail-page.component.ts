import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError } from 'rxjs';

import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MetadataGridComponent, MetadataItem } from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { EmptyValuePipe } from '../../shared/pipes/empty-value.pipe';
import { buildEstimateIdentifier, buildProjectIdentifier, formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import {
  ServiceOrder,
  ServiceOrderDeliveredDocument,
  ServiceOrderItem,
  ServiceOrderScheduleItem,
} from './service-order.model';
import { ServiceOrdersService } from './service-orders.service';

@Component({
  selector: 'app-service-order-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    EmptyValuePipe,
    AccessDeniedStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    MetadataGridComponent,
    PageHeaderComponent,
    SectionCardComponent,
    SummaryCardComponent,
  ],
  template: `
    <app-page-header
      [title]="serviceOrder()?.serviceOrderNumber || 'Detalhe da ordem de serviço'"
      [eyebrow]="serviceOrderDisplayCode()"
      subtitle="Detalhe da OS com contexto do projeto, estimativa, DIEx, dados documentais, itens, cronograma e documentos entregues."
      [badge]="sourceBadge()"
      backLabel="Voltar para Ordens de Serviço"
      backLink="/service-orders"
    >
      <button page-header-actions type="button" (click)="openHtmlDocument()" class="btn btn-ghost">
        Ver HTML
      </button>
      <button page-header-actions type="button" (click)="openPdfDocument()" class="btn btn-gold">
        Abrir PDF
      </button>
    </app-page-header>

    <div class="workspace">
      @if (documentError()) {
        <div class="form-alert">{{ documentError() }}</div>
      }

      @if (loading()) {
        <div class="card">
          <div class="card-body">
            <app-loading-state variant="detail" [count]="3" />
          </div>
        </div>
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite abrir esta ordem de serviço."
          description="O backend bloqueou a visualização detalhada deste documento. Você pode voltar para a listagem ou seguir para outro módulo disponível."
          primaryLink="/service-orders"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar o detalhe da ordem de serviço"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="reload()"
        />
      } @else if (!serviceOrder()) {
        <app-empty-state
          eyebrow="Sem dados"
          title="O backend não retornou conteúdo para esta ordem de serviço"
          description="Verifique se o registro ainda existe ou retorne para a listagem."
        />
      } @else {
        <section class="card">
          <div class="card-body">
            <div class="detail-grid">
              @for (item of heroFacts(); track item.label) {
                <div class="detail-item">
                  <label>{{ item.label }}</label>
                  <b>{{ item.value }}</b>
                </div>
              }
            </div>
          </div>
        </section>

        <div class="grid grid-5">
          @for (item of summaryCards(); track item.title) {
            <app-summary-card
              [title]="item.title"
              [value]="item.value"
              [description]="item.description"
              [icon]="item.icon"
              [tone]="item.tone"
            />
          }
        </div>

        <div class="grid grid-2 project-main-grid">
          <app-section-card title="Projeto vinculado" subtitle="Contexto principal do projeto associado à ordem de serviço.">
            <div class="next-action-card">
              <span class="badge b-info">{{ projectDisplayCode() }}</span>
              <h3>{{ serviceOrder()?.project?.title | emptyValue:'Projeto não informado' }}</h3>
              <p>Fase: {{ formatLabel(serviceOrder()?.project?.stage || '') }} · Status: {{ formatLabel(serviceOrder()?.project?.status || '') }}</p>
            </div>
            <app-metadata-grid [items]="projectFacts()" />
            @if (serviceOrder()?.project?.id) {
              <a [routerLink]="['/projects', projectDisplayCode()]">Ver projeto</a>
            }
          </app-section-card>

          <app-section-card title="Estimativa vinculada" subtitle="Origem da OS e total associado à estimativa.">
            <div class="next-action-card">
              <span class="badge b-neutral">{{ estimateDisplayCode() }}</span>
              <h3>{{ serviceOrder()?.estimate?.ata?.number | emptyValue:'Estimativa vinculada' }}</h3>
              <p>{{ locationLabel() }} · {{ serviceOrder()?.estimate?.om?.sigla || serviceOrder()?.estimate?.omName || 'OM não informada' }}</p>
            </div>
            <app-metadata-grid [items]="estimateFacts()" />
            @if (serviceOrder()?.estimate?.id) {
              <a [routerLink]="['/estimates', estimateDisplayCode()]">Ver estimativa</a>
            }
          </app-section-card>
        </div>

        <div class="grid grid-2 project-main-grid">
          <app-section-card title="DIEx vinculado" subtitle="Documento de origem associado à ordem de serviço.">
            <div class="next-action-card">
              <span class="badge b-info">{{ diexDisplayCode() }}</span>
              <h3>{{ serviceOrder()?.diexRequest?.diexNumber | emptyValue:'DIEx não informado' }}</h3>
              <p>Emitido em {{ formatDate(serviceOrder()?.diexRequest?.issuedAt) }}</p>
            </div>
            <app-metadata-grid [items]="diexFacts()" />
            @if (serviceOrder()?.diexRequest?.id) {
              <a [routerLink]="['/diex', diexDisplayCode()]">Ver DIEx</a>
            }
          </app-section-card>

          <app-section-card title="Dados da contratada" subtitle="Contratada, contato e parâmetros operacionais da execução.">
            <app-metadata-grid [items]="contractorFacts()" />
          </app-section-card>
        </div>

        <div class="grid grid-2 project-main-grid">
          <app-section-card title="Dados do requisitante" subtitle="Responsável institucional informado na emissão da OS.">
            <app-metadata-grid [items]="requesterFacts()" />
          </app-section-card>

          <app-section-card title="Dados documentais" subtitle="Identificação da OS, datas, origem do processo e observações.">
            <app-metadata-grid [items]="documentFacts()" />
            <div class="document-group">
              <div class="document-group-head">
                <b>Observações</b>
              </div>
              <p>{{ serviceOrder()?.notes | emptyValue:'Sem observações registradas nesta ordem de serviço.' }}</p>
            </div>
          </app-section-card>
        </div>

        <app-section-card title="Itens da ordem de serviço" subtitle="Itens ordenados e valores retornados pela API.">
          <span section-card-actions class="badge b-neutral">{{ (serviceOrder()?.items ?? []).length }} item(ns)</span>
          @if ((serviceOrder()?.items ?? []).length) {
            <div class="table-wrap hidden lg:block">
              <table class="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qtd.</th>
                    <th>Unidade</th>
                    <th>Valor unit.</th>
                    <th>Total</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of serviceOrder()?.items ?? []; track item.id) {
                    <tr>
                      <td>
                        <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.itemCode || item.serviceOrderItemCode }} - {{ item.description }}</p>
                        <p class="mt-1 text-sm text-[var(--sagep-muted)]">Estimativa item: {{ item.estimateItem?.estimateItemCode || 'Não informado' }}</p>
                      </td>
                      <td>{{ item.quantityOrdered || '0' }}</td>
                      <td>{{ item.supplyUnit | emptyValue:'N/I' }}</td>
                      <td>{{ formatCurrency(item.unitPrice) }}</td>
                      <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(item.totalPrice) }}</td>
                      <td>{{ item.notes | emptyValue:'Sem observações' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="grid gap-4 lg:hidden">
              @for (item of serviceOrder()?.items ?? []; track item.id) {
                <article class="card">
                  <div class="card-body">
                    <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.itemCode || item.serviceOrderItemCode }} - {{ item.description }}</p>
                    <app-metadata-grid [items]="itemFacts(item)" gridClass="sm:grid-cols-2" />
                    <p class="text-sm text-[var(--sagep-muted)]">{{ item.notes | emptyValue:'Sem observações para esta linha.' }}</p>
                  </div>
                </article>
              }
            </div>
          } @else {
            <div class="empty"><p>A API não retornou itens para esta ordem de serviço.</p></div>
          }
        </app-section-card>

        <div class="grid grid-2 project-main-grid">
          <app-section-card title="Cronograma" subtitle="Cronograma operacional retornado no payload da OS, quando disponível.">
            @if ((serviceOrder()?.scheduleItems ?? []).length) {
              <div class="document-list">
                @for (item of serviceOrder()?.scheduleItems ?? []; track item.id) {
                  <div class="document-item">
                    <b>{{ item.orderIndex }}. {{ item.taskStep }}</b>
                    <span>{{ item.scheduleText }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty"><p>A API não retornou cronograma para esta ordem de serviço.</p></div>
            }
          </app-section-card>

          <app-section-card title="Documentos entregues" subtitle="Checklist documental retornado no payload da OS, quando disponível.">
            @if ((serviceOrder()?.deliveredDocuments ?? []).length) {
              <div class="document-list">
                @for (item of serviceOrder()?.deliveredDocuments ?? []; track item.id) {
                  <div class="document-item">
                    <b>{{ item.description }}</b>
                    <span>{{ item.isChecked ? 'Marcado como entregue' : 'Pendente / não marcado' }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty"><p>A API não retornou documentos entregues para esta ordem de serviço.</p></div>
            }
          </app-section-card>
        </div>
      }
    </div>
  `,
})
export class ServiceOrderDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly serviceOrdersService = inject(ServiceOrdersService);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly documentError = signal('');
  readonly serviceOrder = signal<ServiceOrder | null>(null);
  readonly sourceBadge = signal('Fonte: GET /service-orders/:identifier');
  private serviceOrderIdentifierRoute: string | null = null;

  readonly serviceOrderDisplayCode = computed(() => this.serviceOrder()?.serviceOrderNumber || 'Ordem de Serviço');
  readonly projectDisplayCode = computed(() => {
    const project = this.serviceOrder()?.project;
    if (!project?.id) return 'Projeto';
    return buildProjectIdentifier(project.projectCode ?? null, project.id, this.serviceOrder()?.createdAt);
  });
  readonly estimateDisplayCode = computed(() => {
    const estimate = this.serviceOrder()?.estimate;
    if (!estimate?.id) return 'Estimativa';
    return buildEstimateIdentifier(estimate.estimateCode ?? null, estimate.id, this.serviceOrder()?.createdAt);
  });
  readonly diexDisplayCode = computed(() => {
    const diex = this.serviceOrder()?.diexRequest;
    if (!diex?.id) return 'DIEx';
    const year = this.yearFromDate(diex.issuedAt || this.serviceOrder()?.createdAt);
    return year && Number.isFinite(Number(diex.diexCode))
      ? `DIEX-${year}-${String(diex.diexCode).padStart(4, '0')}`
      : diex.id;
  });

  readonly heroFacts = computed<MetadataItem[]>(() => [
    { label: 'Número da OS', value: this.serviceOrder()?.serviceOrderNumber || 'Não informado', highlight: true },
    { label: 'Emitida em', value: formatDate(this.serviceOrder()?.issuedAt) },
    { label: 'Projeto', value: this.projectDisplayCode() },
    { label: 'Estimativa', value: this.estimateDisplayCode() },
  ]);

  readonly summaryCards = computed(() => {
    const item = this.serviceOrder();
    return [
      {
        title: 'Valor total',
        value: formatCurrency(this.totalAmount()),
        description: 'Total do documento',
        icon: 'R$',
        tone: 'accent' as const,
      },
      {
        title: 'Itens',
        value: String((item?.items ?? []).length),
        description: 'Linhas da OS',
        icon: '#',
        tone: 'soft' as const,
      },
      {
        title: 'Cronograma',
        value: String((item?.scheduleItems ?? []).length),
        description: 'Etapas planejadas',
        icon: '↺',
        tone: 'warning' as const,
      },
      {
        title: 'Documentos',
        value: String((item?.deliveredDocuments ?? []).length),
        description: 'Documentos entregues',
        icon: 'DOC',
        tone: 'success' as const,
      },
      {
        title: 'DIEx',
        value: item?.diexRequest?.diexNumber || (item?.diexCode ? `DIEX-${item.diexCode}` : 'N/I'),
        description: 'Origem documental',
        icon: 'DIEX',
        tone: 'default' as const,
      },
    ];
  });

  ngOnInit(): void {
    this.serviceOrderIdentifierRoute = this.route.snapshot.paramMap.get('id');

    if (!this.serviceOrderIdentifierRoute) {
      this.errorMessage.set('Identificador da ordem de serviço não informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(): void {
    if (!this.serviceOrderIdentifierRoute) return;

    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const routeIdentifier = this.serviceOrderIdentifierRoute;
    const request$ = this.resolveServiceOrder(routeIdentifier);

    request$.subscribe({
      next: (response) => {
        this.serviceOrder.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Ordem de serviço não encontrada ou sem permissão de acesso.'));
        this.serviceOrder.set(null);
        this.loading.set(false);
      },
    });
  }

  openHtmlDocument(): void {
    const id = this.serviceOrder()?.id;
    if (!id) return;

    this.documentError.set('');
    this.serviceOrdersService.getDocumentHtml(id).subscribe({
      next: (html) => this.openBlobWindow(new Blob([html], { type: 'text/html' })),
      error: (error) => {
        this.documentError.set(getErrorMessage(error, 'Não foi possível abrir o HTML da ordem de serviço.'));
      },
    });
  }

  openPdfDocument(): void {
    const id = this.serviceOrder()?.id;
    if (!id) return;

    this.documentError.set('');
    this.serviceOrdersService.getDocumentPdf(id).subscribe({
      next: (blob) => this.openBlobWindow(new Blob([blob], { type: 'application/pdf' })),
      error: (error) => {
        this.documentError.set(getErrorMessage(error, 'Não foi possível abrir o PDF da ordem de serviço.'));
      },
    });
  }

  projectFacts(): MetadataItem[] {
    const project = this.serviceOrder()?.project;
    return [
      { label: 'Código interno', value: project?.projectCode ? `#${project.projectCode}` : 'Não informado' },
      { label: 'Título', value: project?.title || 'Não informado' },
      { label: 'Fase', value: formatLabel(project?.stage || '') },
      { label: 'Status', value: formatLabel(project?.status || '') },
    ];
  }

  estimateFacts(): MetadataItem[] {
    const estimate = this.serviceOrder()?.estimate;
    return [
      { label: 'Código da estimativa', value: estimate?.estimateCode ? `#${estimate.estimateCode}` : 'Não informado' },
      { label: 'Status', value: estimate?.status ? formatLabel(estimate.status) : 'Não informado' },
      { label: 'OM', value: estimate?.om?.sigla || estimate?.omName || 'Não informado' },
      { label: 'Cidade / UF', value: this.locationLabel() },
      { label: 'ATA', value: estimate?.ata?.number || 'Não informado' },
      { label: 'Valor da estimativa', value: formatCurrency(estimate?.totalAmount) },
    ];
  }

  diexFacts(): MetadataItem[] {
    const diex = this.serviceOrder()?.diexRequest;
    return [
      { label: 'Código do DIEx', value: diex?.diexCode ? `#${diex.diexCode}` : 'Não informado' },
      { label: 'Número do DIEx', value: diex?.diexNumber || 'Não informado' },
      { label: 'Emitido em', value: formatDate(diex?.issuedAt) },
    ];
  }

  contractorFacts(): MetadataItem[] {
    const item = this.serviceOrder();
    return [
      { label: 'Contratada', value: item?.contractorName || item?.estimate?.ata?.vendorName || 'Não informado' },
      { label: 'CNPJ', value: item?.contractorCnpj || 'Não informado' },
      { label: 'Representante', value: item?.contractorRepresentativeName || 'Não informado' },
      { label: 'Função do representante', value: item?.contractorRepresentativeRole || 'Não informado' },
      { label: 'Número do contrato', value: item?.contractNumber || 'Não informado' },
      { label: 'Local de execução', value: item?.executionLocation || 'Não informado' },
      { label: 'Horário de execução', value: item?.executionHours || 'Não informado' },
      { label: 'Contato', value: item?.contactName || 'Não informado' },
      { label: 'Telefone', value: item?.contactPhone || 'Não informado' },
      { label: 'Ramal', value: item?.contactExtension || 'Não informado' },
      { label: 'Vigência total', value: item?.contractTotalTerm || 'Não informado' },
    ];
  }

  requesterFacts(): MetadataItem[] {
    const item = this.serviceOrder();
    return [
      { label: 'Nome', value: item?.requesterName || 'Não informado' },
      { label: 'Posto/graduação', value: item?.requesterRank || 'Não informado' },
      { label: 'CPF', value: item?.requesterCpf || 'Não informado' },
      { label: 'Função', value: item?.requesterRole || 'Não informado' },
      { label: 'Organização emissora', value: item?.issuingOrganization || 'Não informado' },
      { label: 'Área requisitante', value: item?.requestingArea || 'Não informado' },
    ];
  }

  documentFacts(): MetadataItem[] {
    const item = this.serviceOrder();
    return [
      { label: 'Código interno', value: item?.serviceOrderCode ? `#${item.serviceOrderCode}` : 'Não informado' },
      { label: 'Número da OS', value: item?.serviceOrderNumber || 'Não informado' },
      { label: 'Emitida em', value: formatDate(item?.issuedAt) },
      { label: 'Nota de Empenho', value: item?.commitmentNoteNumber || 'Não informado' },
      { label: 'OS emergencial', value: item?.isEmergency ? 'Sim' : 'Não' },
      { label: 'Início planejado', value: formatDate(item?.plannedStartDate) },
      { label: 'Fim planejado', value: formatDate(item?.plannedEndDate) },
      { label: 'Origem do processo', value: item?.originProcess || 'Não informado' },
      { label: 'Projeto exibido', value: item?.projectDisplayName || 'Não informado' },
      { label: 'Sigla do projeto', value: item?.projectAcronym || 'Não informado' },
      { label: 'Criado em', value: formatDate(item?.createdAt) },
      { label: 'Atualizado em', value: formatDate(item?.updatedAt) },
      { label: 'Valor total', value: formatCurrency(this.totalAmount()) },
    ];
  }

  itemFacts(item: ServiceOrderItem): MetadataItem[] {
    return [
      { label: 'Quantidade', value: String(item.quantityOrdered || '0') },
      { label: 'Unidade', value: item.supplyUnit || 'N/I' },
      { label: 'Valor unitário', value: formatCurrency(item.unitPrice) },
      { label: 'Valor total', value: formatCurrency(item.totalPrice) },
    ];
  }

  totalAmount(): unknown {
    const explicit = this.serviceOrder()?.totalAmount ?? this.serviceOrder()?.estimate?.totalAmount;
    if (explicit !== undefined && explicit !== null) return explicit;
    return (this.serviceOrder()?.items ?? []).reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  }

  locationLabel(): string {
    const estimate = this.serviceOrder()?.estimate;
    const city = estimate?.om?.cityName || estimate?.destinationCityName;
    const state = estimate?.om?.stateUf || estimate?.destinationStateUf;
    return [city, state].filter(Boolean).join(' / ') || 'Não informado';
  }

  readonly formatDate = formatDate;
  readonly formatCurrency = formatCurrency;
  readonly formatLabel = formatLabel;

  private resolveServiceOrder(identifier: string) {
    const trimmed = identifier.trim();

    if (this.isServiceOrderNumber(trimmed)) {
      this.sourceBadge.set('Fonte: GET /service-orders/number/:serviceOrderNumber');
      return this.serviceOrdersService.getByNumber(trimmed).pipe(
        catchError(() => {
          this.sourceBadge.set('Fonte: GET /service-orders/:id');
          return this.serviceOrdersService.getById(identifier);
        }),
      );
    }

    if (/^\d+$/.test(trimmed)) {
      this.sourceBadge.set('Fonte: GET /service-orders/code/:code');
      return this.serviceOrdersService.getByCode(Number(trimmed));
    }

    this.sourceBadge.set('Fonte: GET /service-orders/:id');
    return this.serviceOrdersService.getById(identifier);
  }

  private isServiceOrderNumber(identifier: string): boolean {
    return /^OS-\d{4}-[A-Za-z0-9-]+$/i.test(identifier);
  }

  private yearFromDate(value: unknown): number | null {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.getFullYear();
  }

  private openBlobWindow(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

