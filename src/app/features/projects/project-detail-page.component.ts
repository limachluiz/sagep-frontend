import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { ProjectDetails } from '../../core/models/project.model';
import { ProjectsService } from '../../core/services/projects.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyValuePipe } from '../../shared/pipes/empty-value.pipe';
import {
  buildProjectIdentifier,
  extractProjectCodeFromFriendlyIdentifier,
  formatCurrency,
  formatDate,
  formatLabel,
  getStatusBadgeClasses,
} from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';

@Component({
  selector: 'app-project-detail-page',
  imports: [CommonModule, RouterLink, EmptyValuePipe, AccessDeniedStateComponent],
  template: `
    <section class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <a routerLink="/projects" class="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
          ← Voltar para projetos
        </a>
        @if (details()) {
          <span class="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-600 shadow-sm">
            Fonte: GET /projects/:identifier/details
          </span>
        }
      </div>

      @if (loading()) {
        <div class="grid gap-4">
          @for (item of [1, 2, 3]; track item) {
            <div class="h-36 animate-pulse rounded-[2rem] border border-slate-200 bg-white/80 shadow-[var(--sagep-shadow)]"></div>
          }
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
        <div class="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700 shadow-[var(--sagep-shadow)]">
          <h2 class="text-lg font-semibold">Nao foi possivel carregar o detalhe do projeto</h2>
          <p class="mt-2 text-sm leading-6">{{ errorMessage() }}</p>
          <div class="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              (click)="reload()"
              class="rounded-full border border-red-300 px-5 py-2 text-sm font-medium text-red-700 transition hover:border-red-500"
            >
              Tentar novamente
            </button>
            <a
              routerLink="/projects"
              class="rounded-full border border-red-200 px-5 py-2 text-sm font-medium text-red-700 transition hover:border-red-400"
            >
              Voltar para listagem
            </a>
          </div>
        </div>
      } @else if (!details()) {
        <div class="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-[var(--sagep-shadow)]">
          <p class="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Sem dados</p>
          <h2 class="mt-3 text-2xl font-semibold text-slate-900">O backend não retornou conteúdo para este projeto</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            Verifique se o registro ainda existe ou retorne para a listagem para escolher outro projeto.
          </p>
          <a
            routerLink="/projects"
            class="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Voltar à listagem
          </a>
        </div>
      } @else {
        <section class="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[var(--sagep-shadow)]">
          <div class="bg-[linear-gradient(135deg,#0f172a_0%,#134e4a_100%)] px-6 py-8 text-white">
            <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">{{ projectDisplayCode() }}</p>
                <h1 class="mt-3 text-3xl font-semibold">{{ details()?.project?.title }}</h1>
                <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                  {{ details()?.project?.description || 'Sem descricao cadastrada para este projeto.' }}
                </p>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <span class="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium">
                  {{ formatLabel(details()?.workflow?.status || '') }}
                </span>
                <span class="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium">
                  {{ formatLabel(details()?.workflow?.stage || '') }}
                </span>
              </div>
            </div>
          </div>

          <div class="grid gap-4 border-t border-slate-200 bg-slate-50 p-5 md:grid-cols-2 xl:grid-cols-5">
            @for (item of highlightFacts(); track item.label) {
              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ item.label }}</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.value }}</p>
              </div>
            }
          </div>
        </section>

        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-xl font-semibold text-slate-950">Dados gerais</h2>
                <p class="mt-2 text-sm text-slate-600">Resumo institucional do projeto, responsáveis e marcos básicos.</p>
              </div>
              <span class="rounded-full border px-3 py-1 text-xs font-medium" [class]="badgeClass(details()?.workflow?.stage)">
                {{ formatLabel(details()?.workflow?.stage || '') }}
              </span>
            </div>
            <div class="mt-5 grid gap-4 md:grid-cols-2">
              @for (item of generalFacts(); track item.label) {
                <div class="rounded-2xl bg-slate-50 p-4">
                  <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ item.label }}</p>
                  <p class="mt-2 text-sm font-medium text-slate-900">{{ item.value }}</p>
                </div>
              }
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Próxima ação e workflow</h2>
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
          </section>
        </div>

        <div class="grid gap-6 xl:grid-cols-2">
          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Documentos relacionados</h2>
            <p class="mt-2 text-sm text-slate-600">Blocos retornados em <code>documents</code> no detalhe ampliado do projeto.</p>
            <div class="mt-5 space-y-4">
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
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Resumo financeiro e operacional</h2>
            <p class="mt-2 text-sm text-slate-600">Indicadores agregados retornados pela API para apoiar a leitura rápida do projeto.</p>
            <div class="mt-5 space-y-3">
              @for (item of summaryGroups(); track item.label) {
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span class="text-sm text-slate-700">{{ item.label }}</span>
                  <span class="text-sm font-semibold text-slate-950">{{ item.value }}</span>
                </div>
              }
            </div>
          </section>
        </div>

        <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 class="text-xl font-semibold text-slate-950">Timeline</h2>
              <p class="mt-2 text-sm text-slate-600">Histórico consolidado de eventos e entidades relacionadas ao projeto.</p>
            </div>
            <span class="text-sm text-slate-500">{{ (details()?.timeline ?? []).length }} evento(s)</span>
          </div>
          <div class="mt-6 space-y-4">
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
        </section>
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

  badgeClass(value: string | null | undefined): string {
    return getStatusBadgeClasses(value);
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
