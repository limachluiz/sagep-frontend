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
    <section class="space-y-6">
      <app-page-header
        [title]="details()?.project?.title || 'Detalhe do projeto'"
        [eyebrow]="projectDisplayCode()"
        subtitle="Visão consolidada do projeto com workflow, documentos relacionados e timeline."
        badge="Fonte: GET /projects/:identifier/details"
        backLabel="Voltar para projetos"
        backLink="/projects"
      />

      @if (loading()) {
        <app-loading-state variant="detail" [count]="3" />
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
          <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-success-soft)] bg-[var(--sagep-success-soft)] p-5 text-sm font-semibold text-[var(--sagep-success)] shadow-[var(--sagep-shadow-soft)]">
            Nota de Empenho informada com sucesso. O detalhe do projeto foi atualizado.
          </div>
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

        @if (showCommitmentNotePrompt()) {
          <app-section-card
            title="Nota de Empenho pendente"
            subtitle="O DIEx já foi emitido. Informe a Nota de Empenho para liberar a próxima etapa do fluxo."
          >
            @if (!showCommitmentNotePanel()) {
              <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-warn-soft)] bg-[var(--sagep-warn-soft)] p-5 text-[var(--sagep-warn)]">
                <p class="text-sm leading-6">
                  A próxima ação indicada pelo backend é informar a Nota de Empenho. Depois disso,
                  o projeto poderá avançar para a etapa de Ordem de Serviço conforme as regras do backend.
                </p>
                <button
                  type="button"
                  (click)="toggleCommitmentNotePanel()"
                  class="mt-5 rounded-[14px] bg-[linear-gradient(135deg,var(--sagep-brand),var(--sagep-brand-dark))] px-5 py-3 text-sm font-bold text-white shadow-[var(--sagep-shadow-soft)] transition hover:-translate-y-0.5"
                >
                  Informar Nota de Empenho
                </button>
              </div>
            } @else {
              <form [formGroup]="commitmentNoteForm" class="grid gap-4 md:grid-cols-2">
                <label class="text-sm font-medium text-slate-700">
                  Número da Nota de Empenho
                  <input
                    type="text"
                    formControlName="commitmentNoteNumber"
                    class="mt-2 w-full rounded-[14px] border border-[var(--sagep-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--sagep-brand-mid)] focus:ring-4 focus:ring-[rgba(82,102,43,0.12)]"
                    placeholder="Ex.: NE-2026-001"
                  />
                </label>
                <label class="text-sm font-medium text-slate-700">
                  Data de recebimento
                  <input
                    type="date"
                    formControlName="commitmentNoteReceivedAt"
                    class="mt-2 w-full rounded-[14px] border border-[var(--sagep-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--sagep-brand-mid)] focus:ring-4 focus:ring-[rgba(82,102,43,0.12)]"
                  />
                </label>
              </form>
              <div class="mt-5 flex flex-col gap-3 border-t border-[var(--sagep-line)] pt-5 md:flex-row md:items-center md:justify-end">
                <button
                  type="button"
                  (click)="toggleCommitmentNotePanel()"
                  [disabled]="savingCommitmentNote()"
                  class="rounded-[14px] border border-[var(--sagep-line)] px-5 py-3 text-sm font-semibold text-[var(--sagep-brand-dark)] transition hover:border-[var(--sagep-brand-mid)] hover:bg-[var(--sagep-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  (click)="saveCommitmentNote()"
                  [disabled]="commitmentNoteForm.invalid || savingCommitmentNote()"
                  class="rounded-[14px] bg-[linear-gradient(135deg,var(--sagep-brand),var(--sagep-brand-dark))] px-5 py-3 text-sm font-bold text-white shadow-[var(--sagep-shadow-soft)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-300"
                >
                  {{ savingCommitmentNote() ? 'Salvando...' : 'Salvar Nota de Empenho' }}
                </button>
              </div>
            }
          </app-section-card>
        } @else if (hasCommitmentNote()) {
          <app-section-card title="Nota de Empenho informada">
            <app-metadata-grid [items]="commitmentNoteFacts()" gridClass="md:grid-cols-2" />
          </app-section-card>
        }

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          @for (item of highlightFacts(); track item.label) {
            <app-summary-card [title]="item.label" [value]="item.value" tone="soft" />
          }
        </div>

        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <app-section-card title="Dados gerais" subtitle="Resumo institucional do projeto, responsáveis e marcos básicos.">
            <app-status-badge
              section-card-actions
              [label]="formatLabel(details()?.workflow?.stage || '')"
              [status]="details()?.workflow?.stage"
            />
            <app-metadata-grid class="mt-5 block" [items]="generalFacts()" />
          </app-section-card>

          <app-section-card title="Próxima ação e workflow">
            <div class="mt-5 rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-brand-soft)] p-5">
              <p class="text-xs font-black uppercase tracking-[0.18em] text-[var(--sagep-brand)]">Próxima ação recomendada</p>
              <p class="mt-3 text-lg font-semibold text-[var(--sagep-brand-deep)]">
                {{ details()?.workflow?.nextAction?.label | emptyValue:'Sem próxima ação calculada' }}
              </p>
              <p class="mt-2 text-sm leading-6 text-[var(--sagep-brand-dark)]/80">
                {{ details()?.workflow?.nextAction?.description | emptyValue:'O backend não forneceu descrição adicional para esta recomendação.' }}
              </p>
            </div>
            <app-metadata-grid class="mt-5 block" [items]="workflowFacts()" gridClass="grid-cols-1" />
          </app-section-card>
        </div>

        <div class="grid gap-6 xl:grid-cols-2">
          <app-section-card
            title="Documentos relacionados"
            subtitle="Blocos retornados em documents no detalhe ampliado do projeto."
          >
            <div class="space-y-4">
              @for (group of documentGroups(); track group.label) {
                <div class="rounded-[var(--sagep-radius-sm)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-4">
                  <div class="flex items-center justify-between gap-3">
                    <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ group.label }}</p>
                    <span class="rounded-full bg-[var(--sagep-surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--sagep-muted)]">
                      {{ group.items.length }} item(ns)
                    </span>
                  </div>
                  @if (group.items.length) {
                    <div class="mt-4 space-y-3">
                      @for (item of group.items; track $index) {
                        <div class="rounded-[14px] bg-[var(--sagep-surface-subtle)] p-4">
                          <p class="text-sm font-medium text-[var(--sagep-brand-deep)]">{{ item.title }}</p>
                          <p class="mt-2 text-sm text-[var(--sagep-muted)]">{{ item.meta }}</p>
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="mt-3 text-sm text-[var(--sagep-muted)]">Nenhum registro retornado para este grupo.</p>
                  }
                </div>
              }
            </div>
          </app-section-card>

          <app-section-card
            title="Resumo financeiro e operacional"
            subtitle="Indicadores agregados retornados pela API para apoiar a leitura rápida do projeto."
          >
            <div class="space-y-3">
              @for (item of summaryGroups(); track item.label) {
                <div class="flex items-center justify-between rounded-[14px] bg-[var(--sagep-surface-subtle)] px-4 py-3">
                  <span class="text-sm text-[var(--sagep-ink)]">{{ item.label }}</span>
                  <span class="text-sm font-semibold text-[var(--sagep-brand-deep)]">{{ item.value }}</span>
                </div>
              }
            </div>
          </app-section-card>
        </div>

        <app-section-card
          title="Timeline"
          subtitle="Histórico consolidado de eventos e entidades relacionadas ao projeto."
        >
          <span section-card-actions class="text-sm text-[var(--sagep-muted)]">{{ (details()?.timeline ?? []).length }} evento(s)</span>
          <div class="space-y-4">
            @for (item of details()?.timeline ?? []; track item.id) {
              <article class="rounded-[var(--sagep-radius-sm)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-4 transition hover:border-[var(--sagep-line-strong)] hover:bg-[#fffaf0]">
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.label }}</p>
                    <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.summary | emptyValue:'Sem resumo informado' }}</p>
                  </div>
                  <div class="text-sm text-[var(--sagep-muted)]">
                    {{ formatDate(item.at) }}
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span class="rounded-full bg-[var(--sagep-surface-subtle)] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--sagep-muted)]">{{ item.entityType }}</span>
                  <span class="rounded-full bg-[var(--sagep-surface-subtle)] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--sagep-muted)]">{{ item.actorName | emptyValue:'Ator não informado' }}</span>
                  <span class="rounded-full bg-[var(--sagep-surface-subtle)] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--sagep-muted)]">{{ item.action }}</span>
                </div>
              </article>
            } @empty {
              <p class="text-sm text-[var(--sagep-muted)]">Sem eventos de timeline para este projeto.</p>
            }
          </div>
        </app-section-card>
      }
    </section>
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
      {
        label: 'Valor estimado',
        value: formatCurrency((details?.financialSummary ?? {})['estimatedTotalAmount']),
      },
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
