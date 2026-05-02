import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { ProjectDetails } from '../../core/models/project.model';
import { ProjectsService } from '../../core/services/projects.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
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
    EmptyValuePipe,
    AccessDeniedStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
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
        backLabel="← Voltar para projetos"
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
          title="Nao foi possivel carregar o detalhe do projeto"
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
            <div class="mt-5 grid gap-4 md:grid-cols-2">
              @for (item of generalFacts(); track item.label) {
                <div class="rounded-2xl bg-slate-50 p-4">
                  <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ item.label }}</p>
                  <p class="mt-2 text-sm font-medium text-slate-900">{{ item.value }}</p>
                </div>
              }
            </div>
          </app-section-card>

          <app-section-card title="Próxima ação e workflow">
            <div class="mt-5 rounded-[1.75rem] border border-teal-200 bg-teal-50 p-5">
              <p class="text-xs uppercase tracking-[0.18em] text-teal-700">Próxima ação recomendada</p>
              <p class="mt-3 text-lg font-semibold text-teal-950">
                {{ details()?.workflow?.nextAction?.label | emptyValue:'Sem proxima acao calculada' }}
              </p>
              <p class="mt-2 text-sm leading-6 text-teal-900/80">
                {{ details()?.workflow?.nextAction?.description | emptyValue:'O backend nao forneceu descricao adicional para esta recomendacao.' }}
              </p>
            </div>
            <div class="mt-5 space-y-3">
              @for (item of workflowFacts(); track item.label) {
                <div class="rounded-2xl border border-slate-200 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ item.label }}</p>
                  <p class="mt-2 text-sm text-slate-900">{{ item.value }}</p>
                </div>
              }
            </div>
          </app-section-card>
        </div>

        <div class="grid gap-6 xl:grid-cols-2">
          <app-section-card
            title="Documentos relacionados"
            subtitle="Blocos retornados em documents no detalhe ampliado do projeto."
          >
            <div class="space-y-4">
              @for (group of documentGroups(); track group.label) {
                <div class="rounded-[1.5rem] border border-slate-200 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <p class="font-semibold text-slate-900">{{ group.label }}</p>
                    <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {{ group.items.length }} item(ns)
                    </span>
                  </div>
                  @if (group.items.length) {
                    <div class="mt-4 space-y-3">
                      @for (item of group.items; track $index) {
                        <div class="rounded-2xl bg-slate-50 p-4">
                          <p class="text-sm font-medium text-slate-900">{{ item.title }}</p>
                          <p class="mt-2 text-sm text-slate-600">{{ item.meta }}</p>
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="mt-3 text-sm text-slate-500">Nenhum registro retornado para este grupo.</p>
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
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span class="text-sm text-slate-700">{{ item.label }}</span>
                  <span class="text-sm font-semibold text-slate-950">{{ item.value }}</span>
                </div>
              }
            </div>
          </app-section-card>
        </div>

        <app-section-card
          title="Timeline"
          subtitle="Histórico consolidado de eventos e entidades relacionadas ao projeto."
        >
          <span section-card-actions class="text-sm text-slate-500">{{ (details()?.timeline ?? []).length }} evento(s)</span>
          <div class="space-y-4">
            @for (item of details()?.timeline ?? []; track item.id) {
              <article class="rounded-[1.5rem] border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p class="font-semibold text-slate-900">{{ item.label }}</p>
                    <p class="mt-1 text-sm text-slate-600">{{ item.summary | emptyValue:'Sem resumo informado' }}</p>
                  </div>
                  <div class="text-sm text-slate-500">
                    {{ formatDate(item.at) }}
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-600">{{ item.entityType }}</span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-600">{{ item.actorName | emptyValue:'Ator nao informado' }}</span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-600">{{ item.action }}</span>
                </div>
              </article>
            } @empty {
              <p class="text-sm text-slate-500">Sem eventos de timeline para este projeto.</p>
            }
          </div>
        </app-section-card>
      }
    </section>
  `,
})
export class ProjectDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly details = signal<ProjectDetails | null>(null);
  private projectIdentifier: string | null = null;
  readonly projectDisplayCode = computed(() => {
    const project = this.details()?.project;
    return project ? buildProjectIdentifier(project.projectCode, project.id, project.createdAt) : 'Projeto';
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

  readonly generalFacts = computed(() => {
    const details = this.details();
    const project = details?.project;
    const estimates = (details?.documents?.estimates as Array<Record<string, unknown>> | undefined) ?? [];
    const firstEstimate = estimates[0] ?? {};

    return [
      { label: 'Responsavel', value: project?.owner?.name ?? project?.ownerName ?? 'Nao informado' },
      { label: 'Codigo interno', value: project?.projectCode ? `#${project.projectCode}` : 'Nao informado' },
      { label: 'OM', value: this.pickValue(project as unknown as Record<string, unknown>, ['omName', 'militaryOrganizationName']) },
      { label: 'Cidade / UF', value: this.buildLocation(firstEstimate) },
      { label: 'Inicio', value: formatDate(project?.startDate) },
      { label: 'Fim', value: formatDate(project?.endDate) },
      { label: 'Criado em', value: formatDate(project?.createdAt) },
      {
        label: 'Valor estimado',
        value: formatCurrency((details?.financialSummary ?? {})['estimatedTotalAmount']),
      },
    ];
  });

  readonly workflowFacts = computed(() => {
    const workflow = this.details()?.workflow;
    const milestones = workflow?.milestones ?? {};

    return [
      { label: 'Proxima acao', value: this.pickValue(workflow?.nextAction, ['label', 'description', 'code']) },
      { label: 'Nota de credito', value: this.pickValue(milestones, ['creditNoteNumber', 'creditNoteReceivedAt']) },
      { label: 'DIEx', value: this.pickValue(milestones, ['diexNumber', 'diexIssuedAt']) },
      { label: 'Nota de empenho', value: this.pickValue(milestones, ['commitmentNoteNumber', 'commitmentNoteReceivedAt']) },
      { label: 'Ordem de servico', value: this.pickValue(milestones, ['serviceOrderNumber', 'serviceOrderIssuedAt']) },
    ];
  });

  readonly documentGroups = computed(() => {
    const documents = this.details()?.documents ?? {};

    return [
      { label: 'Estimativas', items: this.mapDocumentItems(documents['estimates'], 'estimateCode') },
      { label: 'DIEx', items: this.mapDocumentItems(documents['diexRequests'], 'diexCode') },
      { label: 'Ordens de Servico', items: this.mapDocumentItems(documents['serviceOrders'], 'serviceOrderCode') },
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
      { label: 'Ordens de servico', value: this.pickValue(operationalSummary, ['serviceOrdersCount']) },
    ];
  });

  ngOnInit(): void {
    this.projectIdentifier = this.route.snapshot.paramMap.get('id');

    if (!this.projectIdentifier) {
      this.errorMessage.set('Identificador do projeto nao informado na rota.');
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

  private pickValue(source: Record<string, unknown> | null | undefined, keys: string[]): string {
    if (!source) {
      return 'Nao informado';
    }

    for (const key of keys) {
      const value = source[key];
      if (value !== null && value !== undefined && value !== '') {
        return typeof value === 'string' && value.includes('T') ? formatDate(value) : String(value);
      }
    }

    return 'Nao informado';
  }

  private buildLocation(source: Record<string, unknown>): string {
    const city = source['destinationCityName'];
    const state = source['destinationStateUf'];

    if (!city && !state) {
      return 'Nao informado';
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
      const amount = source['totalAmount'] ? formatCurrency(source['totalAmount']) : 'Valor nao informado';
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

  protected readonly formatLabel = formatLabel;
  protected readonly formatDate = formatDate;
}
