import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ProjectDetails } from '../../core/models/project.model';
import { ProjectsService } from '../../core/services/projects.service';
import { EmptyValuePipe } from '../../shared/pipes/empty-value.pipe';
import { formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage } from '../../shared/utils/http-error.util';

@Component({
  selector: 'app-project-detail-page',
  imports: [CommonModule, RouterLink, EmptyValuePipe],
  template: `
    <section class="space-y-6">
      <a routerLink="/projects" class="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
        ← Voltar para projetos
      </a>

      @if (loading()) {
        <div class="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-[var(--sagep-shadow)]">
          Carregando detalhe do projeto...
        </div>
      } @else if (errorMessage()) {
        <div class="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 class="text-lg font-semibold">Nao foi possivel carregar o detalhe do projeto</h2>
          <p class="mt-2 text-sm">{{ errorMessage() }}</p>
        </div>
      } @else if (!details()) {
        <div class="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-[var(--sagep-shadow)]">
          O backend nao retornou dados para este projeto.
        </div>
      } @else {
        <section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Projeto #{{ details()?.project?.projectCode }}</p>
              <h1 class="mt-3 text-3xl font-semibold text-slate-950">{{ details()?.project?.title }}</h1>
              <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                {{ details()?.project?.description || 'Sem descricao cadastrada para este projeto.' }}
              </p>
            </div>
            <div class="rounded-3xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-900">
              <p class="font-semibold">{{ formatLabel(details()?.workflow?.stage || '') }}</p>
              <p class="mt-1">{{ details()?.workflow?.nextAction?.label | emptyValue:'Sem proxima acao calculada' }}</p>
            </div>
          </div>
        </section>

        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Dados gerais</h2>
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
            <h2 class="text-xl font-semibold text-slate-950">Workflow e proxima acao</h2>
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
            <div class="mt-5 space-y-3">
              @for (item of documentGroups(); track item.label) {
                <div class="rounded-2xl border border-slate-200 p-4">
                  <p class="font-semibold text-slate-900">{{ item.label }}</p>
                  <p class="mt-2 text-sm text-slate-600">{{ item.value }}</p>
                </div>
              } @empty {
                <p class="text-sm text-slate-500">Sem documentos relacionados retornados.</p>
              }
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
            <h2 class="text-xl font-semibold text-slate-950">Resumo financeiro e operacional</h2>
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
          <h2 class="text-xl font-semibold text-slate-950">Timeline</h2>
          <div class="mt-6 space-y-4">
            @for (item of details()?.timeline ?? []; track item.id) {
              <article class="rounded-2xl border border-slate-200 p-4">
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p class="font-semibold text-slate-900">{{ item.label }}</p>
                    <p class="mt-1 text-sm text-slate-600">{{ item.summary | emptyValue:'Sem resumo informado' }}</p>
                  </div>
                  <div class="text-sm text-slate-500">
                    {{ formatDate(item.at) }}
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{{ item.entityType }}</span>
                  <span>{{ item.actorName | emptyValue:'Ator nao informado' }}</span>
                  <span>{{ item.action }}</span>
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
  readonly errorMessage = signal('');
  readonly details = signal<ProjectDetails | null>(null);

  readonly generalFacts = computed(() => {
    const details = this.details();
    const project = details?.project;
    const estimates = (details?.documents?.estimates as Array<Record<string, unknown>> | undefined) ?? [];
    const firstEstimate = estimates[0] ?? {};

    return [
      { label: 'Responsavel', value: project?.owner?.name ?? project?.ownerName ?? 'Nao informado' },
      { label: 'Status', value: formatLabel(details?.workflow?.status ?? '') },
      { label: 'Fase atual', value: formatLabel(details?.workflow?.stage ?? '') },
      { label: 'OM', value: this.pickValue(project as unknown as Record<string, unknown>, ['omName', 'militaryOrganizationName']) },
      { label: 'Cidade / UF', value: this.buildLocation(firstEstimate) },
      { label: 'Inicio', value: formatDate(project?.startDate) },
      { label: 'Fim', value: formatDate(project?.endDate) },
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
      { label: 'Estimativas', value: this.describeCollection(documents['estimates']) },
      { label: 'DIEx', value: this.describeCollection(documents['diexRequests']) },
      { label: 'Ordens de Servico', value: this.describeCollection(documents['serviceOrders']) },
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
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.errorMessage.set('Identificador do projeto nao informado na rota.');
      this.loading.set(false);
      return;
    }

    this.projectsService.getDetails(id).subscribe({
      next: (response) => {
        this.details.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'Falha ao carregar o detalhe do projeto.'));
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

  private describeCollection(value: unknown): string {
    if (!Array.isArray(value) || !value.length) {
      return 'Nenhum registro retornado';
    }

    return `${value.length} registro(s) no payload atual`;
  }

  protected readonly formatLabel = formatLabel;
  protected readonly formatDate = formatDate;
}
