import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, switchMap, throwError } from 'rxjs';

import { ProjectDetails } from '../../core/models/project.model';
import { AuthService } from '../../core/services/auth.service';
import { ProjectsService } from '../../core/services/projects.service';
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

  readonly commitmentNoteForm = this.fb.nonNullable.group({
    commitmentNoteNumber: ['', Validators.required],
    commitmentNoteReceivedAt: [''],
  });
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly showCommitmentNotePanel = signal(false);
  readonly savingCommitmentNote = signal(false);
  readonly commitmentNoteError = signal('');
  readonly commitmentNoteForbidden = signal(false);
  readonly commitmentNoteSuccess = signal(false);
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
  readonly canInformCommitmentNote = computed(() => {
    const role = this.authService.getUserRole();
    return this.authService.hasAnyPermission(['projects.edit_own', 'projects.edit_all']) ||
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
  readonly commitmentNoteFacts = computed<MetadataItem[]>(() => [
    { label: 'Número da Nota de Empenho', value: this.pickValue(this.milestones(), ['commitmentNoteNumber']), highlight: true },
    { label: 'Recebida em', value: this.pickValue(this.milestones(), ['commitmentNoteReceivedAt']) },
  ]);

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

  protected readonly formatDate = formatDate;
  protected readonly formatLabel = formatLabel;
}
