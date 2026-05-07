import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, switchMap, throwError } from 'rxjs';

import { ProjectDetails } from '../../core/models/project.model';
import { AuthService } from '../../core/services/auth.service';
import { ProjectsService } from '../../core/services/projects.service';
import { ServiceOrdersService } from '../../core/services/service-orders.service';
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
  buildProjectIdentifier,
  extractProjectCodeFromFriendlyIdentifier,
  formatCurrency,
  formatDate,
  formatLabel,
} from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';

@Component({
  selector: 'app-project-detail-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
    <app-page-header
      [title]="details()?.project?.title || 'Detalhe do projeto'"
      [eyebrow]="projectDisplayCode()"
      subtitle="Visão consolidada do projeto com workflow documental, dados gerais, documentos vinculados e timeline."
      badge="Fonte: GET /projects/:id/details"
      backLabel="Voltar para projetos"
      backLink="/projects"
    />

    <div class="workspace project-detail-workspace">
      @if (loading()) {
        <div class="card">
          <div class="card-body">
            <app-loading-state variant="detail" [count]="3" />
          </div>
        </div>
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite abrir este projeto."
          description="O backend bloqueou a visualização detalhada deste registro. Você pode voltar para a listagem ou seguir para outro módulo disponível."
          primaryLink="/projects"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar o detalhe do projeto"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="reload()"
        />
      } @else if (!details()) {
        <app-empty-state
          eyebrow="Sem dados"
          title="O backend não retornou conteúdo para este projeto"
          description="Verifique se o registro ainda existe ou retorne para a listagem para escolher outro projeto."
        />
      } @else {
        @if (commitmentNoteSuccess()) {
          <div class="form-alert success">Nota de Empenho informada com sucesso. O detalhe do projeto foi atualizado.</div>
        }

        @if (serviceOrderSuccess()) {
          <div class="form-alert success">Ordem de Serviço emitida com sucesso. O detalhe do projeto foi atualizado.</div>
        }

        @if (commitmentNoteForbidden()) {
          <app-access-denied-state
            title="Seu acesso atual não permite informar a Nota de Empenho."
            description="A API recusou a atualização do fluxo do projeto para o perfil ou permissões atuais."
            primaryLink="/projects"
            primaryLabel="Voltar à listagem"
            secondaryLink="/dashboard"
            secondaryLabel="Ir para o dashboard"
          />
        } @else if (commitmentNoteError()) {
          <app-error-state title="Não foi possível informar a Nota de Empenho" [message]="commitmentNoteError()" retryLabel="" />
        }

        @if (serviceOrderForbidden()) {
          <app-access-denied-state
            title="Seu acesso atual não permite emitir a Ordem de Serviço."
            description="A API recusou a emissão da OS para o perfil ou permissões atuais."
            primaryLink="/projects"
            primaryLabel="Voltar à listagem"
            secondaryLink="/dashboard"
            secondaryLabel="Ir para o dashboard"
          />
        } @else if (serviceOrderError()) {
          <app-error-state title="Não foi possível emitir a Ordem de Serviço" [message]="serviceOrderError()" retryLabel="" />
        }

        <section class="card command-card project-hero-card">
          <div class="card-body">
            <div>
              <span class="badge b-neutral">{{ projectDisplayCode() }}</span>
              <h2>{{ details()?.project?.title }}</h2>
              <p>{{ details()?.project?.description | emptyValue:'Sem descrição cadastrada para este projeto.' }}</p>
            </div>
            <div class="project-hero-meta">
              <app-status-badge [label]="formatLabel(details()?.workflow?.status || '')" [status]="details()?.workflow?.status" />
              <app-status-badge [label]="formatLabel(details()?.workflow?.stage || '')" [status]="details()?.workflow?.stage" />
            </div>
          </div>
        </section>

        <div class="grid grid-5">
          @for (item of highlightFacts(); track item.label) {
            <app-summary-card [title]="item.label" [value]="item.value" tone="soft" />
          }
        </div>

        <app-section-card title="Workflow documental" subtitle="Etapas principais do fluxo do projeto conforme dados retornados pelo backend.">
          <div class="workflow project-workflow">
            @for (step of workflowSteps(); track step.key) {
              <div class="wf-step" [class.done]="step.done" [class.active]="step.active" [class.cancel]="step.cancel">
                {{ step.label }}
              </div>
            }
          </div>
        </app-section-card>

        <div class="grid grid-2 project-main-grid">
          <app-section-card title="Dados gerais" subtitle="Resumo institucional do projeto, responsáveis e marcos básicos.">
            <app-metadata-grid [items]="generalFacts()" />
          </app-section-card>

          <app-section-card title="Próxima ação" subtitle="Recomendação calculada por GET /projects/:id/next-action.">
            <div class="next-action-card">
              <span class="badge b-info">{{ details()?.workflow?.nextAction?.code || 'Não informado' }}</span>
              <h3>{{ details()?.workflow?.nextAction?.label | emptyValue:'Sem próxima ação calculada' }}</h3>
              <p>{{ details()?.workflow?.nextAction?.description | emptyValue:'O backend não forneceu descrição adicional para esta recomendação.' }}</p>
            </div>
            <app-metadata-grid class="metadata-stack" [items]="workflowFacts()" gridClass="grid-cols-1" />
          </app-section-card>
        </div>

        <div class="grid grid-2 project-main-grid">
          <app-section-card title="Documentos vinculados" subtitle="Documentos retornados no detalhe ampliado do projeto.">
            <div class="document-groups">
              @for (group of documentGroups(); track group.label) {
                <div class="document-group">
                  <div class="document-group-head">
                    <b>{{ group.label }}</b>
                    <span class="badge b-neutral">{{ group.items.length }} item(ns)</span>
                  </div>
                  @if (group.items.length) {
                    <div class="document-list">
                      @for (item of group.items; track $index) {
                        <div class="document-item">
                          <b>{{ item.title }}</b>
                          <span>{{ item.meta }}</span>
                        </div>
                      }
                    </div>
                  } @else {
                    <p>Nenhum registro retornado para este grupo.</p>
                  }
                </div>
              }
            </div>
          </app-section-card>

          <app-section-card title="Ações do fluxo" subtitle="Ações disponíveis para a etapa atual sem criar novos módulos.">
            @if (showCommitmentNotePrompt()) {
              @if (!showCommitmentNotePanel()) {
                <div class="flow-action-panel">
                  <span class="badge b-warn">Nota de Empenho pendente</span>
                  <p>A próxima ação indicada pelo backend é informar a Nota de Empenho para liberar a etapa seguinte.</p>
                  <button type="button" (click)="toggleCommitmentNotePanel()" class="btn btn-primary">Informar Nota de Empenho</button>
                </div>
              } @else {
                <form [formGroup]="commitmentNoteForm" class="flow-form">
                  <div class="field">
                    <label for="commitmentNoteNumber">Número da Nota de Empenho</label>
                    <input id="commitmentNoteNumber" type="text" formControlName="commitmentNoteNumber" placeholder="Ex.: NE-2026-001" />
                  </div>
                  <div class="field">
                    <label for="commitmentNoteReceivedAt">Data de recebimento</label>
                    <input id="commitmentNoteReceivedAt" type="date" formControlName="commitmentNoteReceivedAt" />
                  </div>
                  <div class="flow-form-actions">
                    <button type="button" (click)="toggleCommitmentNotePanel()" [disabled]="savingCommitmentNote()" class="btn btn-ghost">Cancelar</button>
                    <button
                      type="button"
                      (click)="saveCommitmentNote()"
                      [disabled]="commitmentNoteForm.invalid || savingCommitmentNote()"
                      class="btn btn-primary"
                    >
                      {{ savingCommitmentNote() ? 'Salvando...' : 'Salvar Nota de Empenho' }}
                    </button>
                  </div>
                </form>
              }
            } @else if (showServiceOrderPrompt()) {
              @if (!showServiceOrderPanel()) {
                <div class="flow-action-panel">
                  <span class="badge b-info">Ordem de Serviço liberada</span>
                  <p>A etapa atual do projeto permite emitir a Ordem de Serviço usando o contrato real do backend.</p>
                  <button type="button" (click)="toggleServiceOrderPanel()" class="btn btn-primary">Emitir Ordem de Serviço</button>
                </div>
              } @else {
                <form [formGroup]="serviceOrderForm" class="flow-form service-order-form">
                  <div class="field">
                    <label for="serviceOrderIssuedAt">Data de emissão</label>
                    <input id="serviceOrderIssuedAt" type="date" formControlName="issuedAt" />
                  </div>
                  <div class="field">
                    <label for="serviceOrderContractorCnpj">CNPJ da contratada</label>
                    <input id="serviceOrderContractorCnpj" type="text" formControlName="contractorCnpj" placeholder="Somente números" />
                  </div>
                  <div class="field">
                    <label for="serviceOrderRequesterName">Requisitante</label>
                    <input id="serviceOrderRequesterName" type="text" formControlName="requesterName" placeholder="Opcional" />
                  </div>
                  <div class="field">
                    <label for="serviceOrderRequesterRank">Posto/graduação</label>
                    <input id="serviceOrderRequesterRank" type="text" formControlName="requesterRank" placeholder="Opcional" />
                  </div>
                  <div class="field">
                    <label for="serviceOrderRequesterCpf">CPF do requisitante</label>
                    <input id="serviceOrderRequesterCpf" type="text" formControlName="requesterCpf" placeholder="Opcional" />
                  </div>
                  <div class="field">
                    <label for="serviceOrderRequesterRole">Função do requisitante</label>
                    <input id="serviceOrderRequesterRole" type="text" formControlName="requesterRole" placeholder="Opcional" />
                  </div>
                  <div class="field">
                    <label for="serviceOrderIssuingOrganization">Organização emissora</label>
                    <input id="serviceOrderIssuingOrganization" type="text" formControlName="issuingOrganization" placeholder="Opcional" />
                  </div>
                  <div class="field">
                    <label for="serviceOrderPlannedStartDate">Início planejado</label>
                    <input id="serviceOrderPlannedStartDate" type="date" formControlName="plannedStartDate" />
                  </div>
                  <div class="field">
                    <label for="serviceOrderPlannedEndDate">Fim planejado</label>
                    <input id="serviceOrderPlannedEndDate" type="date" formControlName="plannedEndDate" />
                  </div>
                  <label class="field field-checkbox">
                    <span>Atendimento emergencial</span>
                    <input type="checkbox" formControlName="isEmergency" />
                  </label>
                  <div class="field service-order-form__full">
                    <label for="serviceOrderNotes">Observações</label>
                    <textarea id="serviceOrderNotes" formControlName="notes" rows="3" placeholder="Opcional"></textarea>
                  </div>
                  <div class="flow-form-actions service-order-form__full">
                    <button type="button" (click)="toggleServiceOrderPanel()" [disabled]="creatingServiceOrder()" class="btn btn-ghost">Cancelar</button>
                    <button
                      type="button"
                      (click)="emitServiceOrder()"
                      [disabled]="serviceOrderForm.invalid || creatingServiceOrder()"
                      class="btn btn-primary"
                    >
                      {{ creatingServiceOrder() ? 'Emitindo...' : 'Confirmar emissão' }}
                    </button>
                  </div>
                </form>
              }
            } @else if (hasServiceOrder()) {
              <div class="flow-action-panel success-panel">
                <span class="badge b-ok">Ordem de Serviço emitida</span>
                <p>O projeto já possui OS registrada no backend, então uma nova emissão permanece bloqueada.</p>
                <app-metadata-grid [items]="serviceOrderFacts()" gridClass="grid-cols-1" />
              </div>
            } @else if (hasCommitmentNote()) {
              <app-metadata-grid [items]="commitmentNoteFacts()" gridClass="grid-cols-1" />
            } @else {
              <div class="empty"><p>Nenhuma ação manual disponível para a etapa atual.</p></div>
            }
          </app-section-card>
        </div>

        <app-section-card title="Resumo financeiro e operacional" subtitle="Indicadores agregados retornados pela API.">
          <div class="detail-grid">
            @for (item of summaryGroups(); track item.label) {
              <div class="detail-item">
                <label>{{ item.label }}</label>
                <b>{{ item.value }}</b>
              </div>
            }
          </div>
        </app-section-card>

        <app-section-card title="Timeline" subtitle="Histórico consolidado de eventos e entidades relacionadas ao projeto.">
          <span section-card-actions class="badge b-neutral">{{ (details()?.timeline ?? []).length }} evento(s)</span>
          <div class="timeline">
            @for (item of details()?.timeline ?? []; track item.id) {
              <article class="tl" [class]="timelineTone(item.action)">
                <div class="tl-dot">•</div>
                <div>
                  <h4>{{ item.label }}</h4>
                  <p>{{ item.summary | emptyValue:'Sem resumo informado' }}</p>
                  <div class="timeline-tags">
                    <span>{{ item.entityType }}</span>
                    <span>{{ item.actorName | emptyValue:'Ator não informado' }}</span>
                    <span>{{ item.action }}</span>
                  </div>
                </div>
                <div class="tl-time">{{ formatDate(item.at) }}</div>
              </article>
            } @empty {
              <div class="empty"><p>Sem eventos de timeline para este projeto.</p></div>
            }
          </div>
        </app-section-card>
      }
    </div>
  `,
})
export class ProjectDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly projectsService = inject(ProjectsService);
  private readonly serviceOrdersService = inject(ServiceOrdersService);

  readonly commitmentNoteForm = this.fb.nonNullable.group({
    commitmentNoteNumber: ['', Validators.required],
    commitmentNoteReceivedAt: [''],
  });
  readonly serviceOrderForm = this.fb.nonNullable.group({
    issuedAt: ['', Validators.required],
    contractorCnpj: ['', [Validators.required, Validators.minLength(14)]],
    requesterName: [''],
    requesterRank: [''],
    requesterCpf: [''],
    requesterRole: [''],
    issuingOrganization: [''],
    plannedStartDate: [''],
    plannedEndDate: [''],
    notes: [''],
    isEmergency: [false],
  });
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly showCommitmentNotePanel = signal(false);
  readonly savingCommitmentNote = signal(false);
  readonly commitmentNoteError = signal('');
  readonly commitmentNoteForbidden = signal(false);
  readonly commitmentNoteSuccess = signal(false);
  readonly showServiceOrderPanel = signal(false);
  readonly creatingServiceOrder = signal(false);
  readonly serviceOrderError = signal('');
  readonly serviceOrderForbidden = signal(false);
  readonly serviceOrderSuccess = signal(false);
  readonly details = signal<ProjectDetails | null>(null);
  private projectIdentifier: string | null = null;

  readonly projectDisplayCode = computed(() => {
    const project = this.details()?.project;
    return project ? buildProjectIdentifier(project.projectCode, project.id, project.createdAt) : 'Projeto';
  });
  readonly milestones = computed(() => this.details()?.workflow?.milestones ?? {});
  readonly nextActionText = computed(() => {
    const nextAction = this.details()?.workflow?.nextAction;
    return [nextAction?.code, nextAction?.label, nextAction?.description].filter(Boolean).join(' ').toUpperCase();
  });
  readonly hasDiexIssued = computed(() => Boolean(this.pickValueOrEmpty(this.milestones(), ['diexNumber', 'diexIssuedAt'])));
  readonly hasCommitmentNote = computed(() => Boolean(this.pickValueOrEmpty(this.milestones(), ['commitmentNoteNumber', 'commitmentNoteReceivedAt'])));
  readonly serviceOrderRecord = computed(() => {
    const serviceOrders = this.asRecordArray(this.details()?.documents?.serviceOrders);
    return serviceOrders[0] ?? null;
  });
  readonly hasServiceOrder = computed(() =>
    Boolean(
      this.pickValueOrEmpty(this.milestones(), ['serviceOrderNumber', 'serviceOrderIssuedAt']) ||
      this.serviceOrderRecord()?.['serviceOrderNumber'] ||
      this.serviceOrderRecord()?.['issuedAt'] ||
      this.serviceOrderRecord()?.['id'],
    ),
  );
  readonly canInformCommitmentNote = computed(() => {
    const role = this.authService.getUserRole();
    return this.authService.hasAnyPermission(['projects.edit_own', 'projects.edit_all']) ||
      role === 'ADMIN' ||
      role === 'GESTOR' ||
      role === 'PROJETISTA';
  });
  readonly canIssueServiceOrder = computed(() => {
    const role = this.authService.getUserRole();
    return this.authService.hasAnyPermission(['service_orders.issue']) ||
      role === 'ADMIN' ||
      role === 'GESTOR' ||
      role === 'PROJETISTA';
  });
  readonly shouldInformCommitmentNote = computed(() => {
    const nextAction = this.nextActionText();
    return nextAction.includes('EMPENHO') || nextAction.includes('COMMITMENT');
  });
  readonly showCommitmentNotePrompt = computed(() =>
    this.hasDiexIssued() &&
    !this.hasCommitmentNote() &&
    this.shouldInformCommitmentNote() &&
    this.canInformCommitmentNote(),
  );
  readonly showServiceOrderPrompt = computed(() =>
    this.details()?.workflow?.stage === 'OS_LIBERADA' &&
    this.hasCommitmentNote() &&
    !this.hasServiceOrder() &&
    this.canIssueServiceOrder(),
  );
  readonly commitmentNoteFacts = computed<MetadataItem[]>(() => [
    { label: 'Número da Nota de Empenho', value: this.pickValue(this.milestones(), ['commitmentNoteNumber']), highlight: true },
    { label: 'Recebida em', value: this.pickValue(this.milestones(), ['commitmentNoteReceivedAt']) },
  ]);
  readonly serviceOrderFacts = computed<MetadataItem[]>(() => {
    const serviceOrder = this.serviceOrderRecord();
    return [
      {
        label: 'Número da Ordem de Serviço',
        value: this.pickValue(serviceOrder ?? this.milestones(), ['serviceOrderNumber']),
        highlight: true,
      },
      {
        label: 'Emitida em',
        value: this.pickValue(serviceOrder ?? this.milestones(), ['issuedAt', 'serviceOrderIssuedAt']),
      },
      {
        label: 'CNPJ da contratada',
        value: this.pickValue(serviceOrder, ['contractorCnpj']),
      },
      {
        label: 'Código interno',
        value: this.pickValue(serviceOrder, ['serviceOrderCode']),
      },
    ];
  });

  readonly highlightFacts = computed(() => {
    const details = this.details();
    const project = details?.project;
    const estimates = (details?.documents?.estimates as Array<Record<string, unknown>> | undefined) ?? [];
    const firstEstimate = estimates[0] ?? {};

    return [
      { label: 'OM', value: this.pickValue(project as unknown as Record<string, unknown>, ['omName', 'militaryOrganizationName']) },
      { label: 'Cidade / UF', value: this.buildLocation(firstEstimate) },
      { label: 'Status', value: formatLabel(details?.workflow?.status ?? '') },
      { label: 'Fase atual', value: formatLabel(details?.workflow?.stage ?? '') },
      { label: 'Valor estimado', value: formatCurrency((details?.financialSummary ?? {})['estimatedTotalAmount']) },
    ];
  });

  readonly workflowSteps = computed(() => {
    const currentStage = this.details()?.workflow?.stage;
    const stages = [
      ['ESTIMATIVA_PRECO', 'Estimativa'],
      ['AGUARDANDO_NOTA_CREDITO', 'Nota de Crédito'],
      ['DIEX_REQUISITORIO', 'DIEx'],
      ['AGUARDANDO_NOTA_EMPENHO', 'Empenho'],
      ['OS_LIBERADA', 'OS Liberada'],
      ['SERVICO_EM_EXECUCAO', 'Execução'],
      ['ANALISANDO_AS_BUILT', 'As-Built'],
      ['ATESTAR_NF', 'Atesto'],
      ['SERVICO_CONCLUIDO', 'Concluído'],
    ] as const;
    const currentIndex = stages.findIndex(([key]) => key === currentStage);

    return stages.map(([key, label], index) => ({
      key,
      label,
      done: currentIndex > index,
      active: currentIndex === index,
      cancel: currentStage === 'CANCELADO' && index === 0,
    }));
  });

  readonly generalFacts = computed<MetadataItem[]>(() => {
    const details = this.details();
    const project = details?.project;
    const estimates = (details?.documents?.estimates as Array<Record<string, unknown>> | undefined) ?? [];
    const firstEstimate = estimates[0] ?? {};

    return [
      { label: 'Responsável', value: project?.owner?.name ?? project?.ownerName ?? 'Não informado' },
      { label: 'Código interno', value: project?.projectCode ? `#${project.projectCode}` : 'Não informado' },
      { label: 'OM', value: this.pickValue(project as unknown as Record<string, unknown>, ['omName', 'militaryOrganizationName']) },
      { label: 'Cidade / UF', value: this.buildLocation(firstEstimate) },
      { label: 'Início', value: formatDate(project?.startDate) },
      { label: 'Fim', value: formatDate(project?.endDate) },
      { label: 'Criado em', value: formatDate(project?.createdAt) },
      { label: 'Valor estimado', value: formatCurrency((details?.financialSummary ?? {})['estimatedTotalAmount']) },
    ];
  });

  readonly workflowFacts = computed<MetadataItem[]>(() => {
    const workflow = this.details()?.workflow;
    const milestones = workflow?.milestones ?? {};

    return [
      { label: 'Próxima ação', value: this.pickValue(workflow?.nextAction, ['label', 'description', 'code']) },
      { label: 'Nota de Crédito', value: this.pickValue(milestones, ['creditNoteNumber', 'creditNoteReceivedAt']) },
      { label: 'DIEx', value: this.pickValue(milestones, ['diexNumber', 'diexIssuedAt']) },
      { label: 'Nota de Empenho', value: this.pickValue(milestones, ['commitmentNoteNumber', 'commitmentNoteReceivedAt']) },
      { label: 'Ordem de Serviço', value: this.pickValue(milestones, ['serviceOrderNumber', 'serviceOrderIssuedAt']) },
    ];
  });

  readonly documentGroups = computed(() => {
    const documents = this.details()?.documents ?? {};

    return [
      { label: 'Estimativas', items: this.mapDocumentItems(documents['estimates'], 'estimateCode') },
      { label: 'DIEx', items: this.mapDocumentItems(documents['diexRequests'], 'diexCode') },
      { label: 'Ordens de Serviço', items: this.mapDocumentItems(documents['serviceOrders'], 'serviceOrderCode') },
    ];
  });

  readonly summaryGroups = computed(() => {
    const financialSummary = this.details()?.financialSummary ?? {};
    const operationalSummary = this.details()?.operationalSummary ?? {};

    return [
      { label: 'Estimativas cadastradas', value: this.pickValue(financialSummary, ['estimatesCount']) },
      { label: 'Estimativas finalizadas', value: this.pickValue(financialSummary, ['finalizedEstimatesCount']) },
      { label: 'Total estimado', value: formatCurrency(financialSummary['estimatedTotalAmount']) },
      { label: 'Total DIEx', value: formatCurrency(financialSummary['diexTotalAmount']) },
      { label: 'Total OS', value: formatCurrency(financialSummary['serviceOrderTotalAmount']) },
      { label: 'Membros', value: this.pickValue(operationalSummary, ['membersCount']) },
      { label: 'Tarefas abertas', value: this.pickValue(operationalSummary, ['openTasksCount']) },
      { label: 'Ordens de Serviço', value: this.pickValue(operationalSummary, ['serviceOrdersCount']) },
    ];
  });

  ngOnInit(): void {
    this.projectIdentifier = this.route.snapshot.paramMap.get('id');

    if (!this.projectIdentifier) {
      this.errorMessage.set('Identificador do projeto não informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(): void {
    if (!this.projectIdentifier) {
      return;
    }

    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const routeIdentifier = this.projectIdentifier;
    const codeCandidate = extractProjectCodeFromFriendlyIdentifier(routeIdentifier);
    const shouldTryCodeLookup =
      routeIdentifier !== codeCandidate || /^\d+$/.test(routeIdentifier.trim());

    const detailsRequest$ = shouldTryCodeLookup
      ? this.projectsService.getByCode(codeCandidate).pipe(
          switchMap((project) => this.projectsService.getDetails(project.id)),
          catchError(() => this.projectsService.getDetails(routeIdentifier)),
        )
      : this.projectsService.getDetails(routeIdentifier).pipe(
          catchError((originalError) =>
            this.projectsService.getByCode(codeCandidate).pipe(
              switchMap((project) => this.projectsService.getDetails(project.id)),
              catchError(() => throwError(() => originalError)),
            ),
          ),
        );

    detailsRequest$.subscribe({
      next: (response) => {
        this.details.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(
          getErrorMessage(error, 'Projeto não encontrado ou sem permissão de acesso.'),
        );
        this.details.set(null);
        this.loading.set(false);
      },
    });
  }

  toggleCommitmentNotePanel(): void {
    this.showCommitmentNotePanel.update((visible) => !visible);
    this.clearCommitmentNoteFeedback();
  }

  toggleServiceOrderPanel(): void {
    this.showServiceOrderPanel.update((visible) => !visible);
    this.clearServiceOrderFeedback();
  }

  saveCommitmentNote(): void {
    const projectId = this.details()?.project?.id;

    if (!projectId) {
      this.commitmentNoteError.set('Projeto não informado para atualização da Nota de Empenho.');
      return;
    }

    if (this.commitmentNoteForm.invalid) {
      this.commitmentNoteForm.markAllAsTouched();
      return;
    }

    const formValue = this.commitmentNoteForm.getRawValue();
    const commitmentNoteNumber = formValue.commitmentNoteNumber.trim();

    if (!commitmentNoteNumber) {
      this.commitmentNoteForm.controls.commitmentNoteNumber.setErrors({ required: true });
      return;
    }

    this.savingCommitmentNote.set(true);
    this.clearCommitmentNoteFeedback();

    this.projectsService
      .informCommitmentNote(projectId, {
        commitmentNoteNumber,
        commitmentNoteReceivedAt: formValue.commitmentNoteReceivedAt
          ? new Date(`${formValue.commitmentNoteReceivedAt}T00:00:00`).toISOString()
          : new Date().toISOString(),
      })
      .pipe(finalize(() => this.savingCommitmentNote.set(false)))
      .subscribe({
        next: () => {
          this.commitmentNoteSuccess.set(true);
          this.showCommitmentNotePanel.set(false);
          this.reload();
        },
        error: (error) => {
          this.commitmentNoteForbidden.set(isForbiddenError(error));
          this.commitmentNoteError.set(getErrorMessage(error, 'Falha ao informar a Nota de Empenho.'));
        },
      });
  }

  emitServiceOrder(): void {
    const project = this.details()?.project;

    if (!project || !this.showServiceOrderPrompt()) {
      return;
    }

    if (this.serviceOrderForm.invalid) {
      this.serviceOrderForm.markAllAsTouched();
      return;
    }

    const formValue = this.serviceOrderForm.getRawValue();
    const contractorCnpj = this.onlyDigits(formValue.contractorCnpj);
    const requesterCpf = this.onlyDigits(formValue.requesterCpf);

    if (contractorCnpj.length < 14) {
      this.serviceOrderError.set('Informe o CNPJ da contratada com ao menos 14 dígitos.');
      return;
    }

    if (requesterCpf && requesterCpf.length < 11) {
      this.serviceOrderError.set('Se informado, o CPF do requisitante deve possuir 11 dígitos.');
      return;
    }

    this.creatingServiceOrder.set(true);
    this.clearServiceOrderFeedback();

    const relatedEstimate = this.relatedEstimate();
    const relatedDiex = this.relatedDiex();
    const payload = {
      issuedAt: new Date(`${formValue.issuedAt}T00:00:00`).toISOString(),
      contractorCnpj,
      requesterName: formValue.requesterName.trim() || undefined,
      requesterRank: formValue.requesterRank.trim() || undefined,
      requesterCpf: requesterCpf || undefined,
      requesterRole: formValue.requesterRole.trim() || undefined,
      issuingOrganization: formValue.issuingOrganization.trim() || undefined,
      isEmergency: formValue.isEmergency || undefined,
      plannedStartDate: formValue.plannedStartDate ? new Date(`${formValue.plannedStartDate}T00:00:00`).toISOString() : undefined,
      plannedEndDate: formValue.plannedEndDate ? new Date(`${formValue.plannedEndDate}T00:00:00`).toISOString() : undefined,
      notes: formValue.notes.trim() || undefined,
      ...(project.id ? { projectId: project.id } : project.projectCode ? { projectCode: project.projectCode } : {}),
      ...(relatedEstimate?.['id']
        ? { estimateId: String(relatedEstimate['id']) }
        : this.asNumber(relatedEstimate?.['estimateCode'])
          ? { estimateCode: this.asNumber(relatedEstimate?.['estimateCode']) }
          : {}),
      ...(relatedDiex?.['id']
        ? { diexId: String(relatedDiex['id']) }
        : this.asNumber(relatedDiex?.['diexCode'] ?? relatedDiex?.['code'])
          ? { diexCode: this.asNumber(relatedDiex?.['diexCode'] ?? relatedDiex?.['code']) }
          : {}),
    };

    this.serviceOrdersService
      .createServiceOrder(payload)
      .pipe(finalize(() => this.creatingServiceOrder.set(false)))
      .subscribe({
        next: () => {
          this.serviceOrderSuccess.set(true);
          this.showServiceOrderPanel.set(false);
          this.reload();
        },
        error: (error) => {
          this.serviceOrderForbidden.set(isForbiddenError(error));
          this.serviceOrderError.set(getErrorMessage(error, 'Falha ao emitir a Ordem de Serviço.'));
        },
      });
  }

  timelineTone(action: string): string {
    const normalized = action.toUpperCase();

    if (normalized.includes('CANCEL') || normalized.includes('DELETE')) {
      return 'red';
    }

    if (normalized.includes('CREATE') || normalized.includes('CONCL')) {
      return 'green';
    }

    if (normalized.includes('UPDATE') || normalized.includes('FLOW')) {
      return 'gold';
    }

    return 'blue';
  }

  private pickValue(source: Record<string, unknown> | null | undefined, keys: string[]): string {
    if (!source) {
      return 'Não informado';
    }

    for (const key of keys) {
      const value = source[key];
      if (value !== null && value !== undefined && value !== '') {
        return typeof value === 'string' && value.includes('T') ? formatDate(value) : String(value);
      }
    }

    return 'Não informado';
  }

  private pickValueOrEmpty(source: Record<string, unknown> | null | undefined, keys: string[]): string {
    const value = this.pickValue(source, keys);
    return value === 'Não informado' ? '' : value;
  }

  private clearCommitmentNoteFeedback(): void {
    this.commitmentNoteError.set('');
    this.commitmentNoteForbidden.set(false);
    this.commitmentNoteSuccess.set(false);
  }

  private clearServiceOrderFeedback(): void {
    this.serviceOrderError.set('');
    this.serviceOrderForbidden.set(false);
    this.serviceOrderSuccess.set(false);
  }

  private buildLocation(source: Record<string, unknown>): string {
    const city = source['destinationCityName'];
    const state = source['destinationStateUf'];

    if (!city && !state) {
      return 'Não informado';
    }

    return [city, state].filter(Boolean).join(' / ');
  }

  private mapDocumentItems(value: unknown, codeKey: string): Array<{ title: string; meta: string }> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.slice(0, 5).map((item) => {
      const source = item as Record<string, unknown>;
      const code = source[codeKey];
      const number = source['diexNumber'] ?? source['serviceOrderNumber'] ?? source['estimateCode'];
      const amount = source['totalAmount'] ? formatCurrency(source['totalAmount']) : 'Valor não informado';
      const status = source['status'] ?? source['documentStatus'];
      const issuedAt = source['issuedAt'] ?? source['createdAt'];

      return {
        title: [code ? `#${code}` : null, number ? String(number) : null].filter(Boolean).join(' • ') || 'Documento relacionado',
        meta: [status ? formatLabel(String(status)) : null, amount, issuedAt ? formatDate(String(issuedAt)) : null]
          .filter(Boolean)
          .join(' • '),
      };
    });
  }

  private asRecordArray(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  }

  private relatedEstimate(): Record<string, unknown> | null {
    return this.asRecordArray(this.details()?.documents?.estimates)[0] ?? null;
  }

  private relatedDiex(): Record<string, unknown> | null {
    return this.asRecordArray(this.details()?.documents?.diexRequests)[0] ?? null;
  }

  private asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
  }

  protected readonly formatDate = formatDate;
  protected readonly formatLabel = formatLabel;
}
