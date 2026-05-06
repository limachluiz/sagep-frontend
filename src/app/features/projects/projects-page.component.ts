import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Project, ProjectListResponse } from '../../core/models/project.model';
import { ProjectsService } from '../../core/services/projects.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import {
  ResponsiveTableActionsDirective,
  ResponsiveTableCellDirective,
  ResponsiveTableColumn,
  ResponsiveTableComponent,
} from '../../shared/components/responsive-table.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { buildProjectIdentifier, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';

@Component({
  selector: 'app-projects-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AccessDeniedStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    ResponsiveTableActionsDirective,
    ResponsiveTableCellDirective,
    ResponsiveTableComponent,
    StatusBadgeComponent,
  ],
  template: `
    <section class="space-y-6">
      <app-page-header
        title="Lista de projetos integrados ao backend"
        eyebrow="Projetos"
        subtitle="Consulta em /projects com acesso governado pelo backend e navegação para o detalhe ampliado."
      >
        <form page-header-actions [formGroup]="filtersForm" class="grid w-full gap-4 xl:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
          <input
            type="search"
            formControlName="search"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
            placeholder="Buscar por titulo ou campos relacionados"
          />
          <select
            formControlName="status"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
          >
            <option value="">Todos os status</option>
            @for (status of statusOptions; track status) {
              <option [value]="status">{{ formatLabel(status) }}</option>
            }
          </select>
          <select
            formControlName="stage"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
          >
            <option value="">Todas as fases</option>
            @for (stage of stageOptions; track stage) {
              <option [value]="stage">{{ formatLabel(stage) }}</option>
            }
          </select>
          <button
            type="button"
            (click)="clearFilters()"
            class="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Limpar filtros
          </button>
        </form>
      </app-page-header>

      @if (loading()) {
        <app-loading-state variant="list" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar a lista de projetos."
          description="A API retornou acesso negado para esta operação. Você pode continuar navegando pelo sistema sem sair da sessão."
          primaryLink="/dashboard"
          secondaryLink="/projects"
          secondaryLabel="Permanecer aqui"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível consultar os projetos"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadProjects()"
        />
      } @else if (!projects().length) {
        <app-empty-state
          title="Nenhum projeto encontrado com os filtros atuais"
          description="Tente remover parte da busca ou ajustar status e fase para ampliar o resultado."
          actionLabel="Limpar filtros"
          [action]="clearFilters.bind(this)"
        />
      } @else {
        <div class="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[var(--sagep-shadow)]">
          <div class="mb-5 flex flex-col gap-3 rounded-3xl bg-slate-50 px-5 py-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-medium text-slate-900">{{ metaLabel() }}</span>
              @if (activeFilterSummary()) {
                <span class="rounded-full border border-slate-300 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-600">
                  {{ activeFilterSummary() }}
                </span>
              }
            </div>
            <div class="text-xs uppercase tracking-[0.18em] text-slate-500">
              Fonte: GET /projects
            </div>
          </div>

          <app-responsive-table
            [columns]="columns"
            [data]="projects()"
            [trackBy]="trackProject"
            emptyTitle="Nenhum projeto encontrado"
            emptyDescription="Ajuste os filtros ou tente novamente."
          >
            <ng-template appResponsiveTableCell="project" let-project>
              <p class="font-semibold text-slate-900">#{{ project.projectCode }} - {{ project.title }}</p>
              <p class="mt-1 text-sm text-slate-500">{{ project.description || 'Sem descrição cadastrada.' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-project>
              <app-status-badge [label]="formatLabel(project.status)" [status]="project.status" />
            </ng-template>
            <ng-template appResponsiveTableCell="stage" let-project>
              <app-status-badge [label]="formatLabel(project.stage)" [status]="project.stage" />
            </ng-template>
            <ng-template appResponsiveTableCell="owner" let-project>
              {{ project.ownerName || project.owner?.name || 'Não informado' }}
            </ng-template>
            <ng-template appResponsiveTableCell="createdAt" let-project>
              {{ formatDate(project.createdAt) }}
            </ng-template>
            <ng-template appResponsiveTableActions let-project>
              <a
                [routerLink]="['/projects', projectIdentifier(project)]"
                class="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                Ver detalhe
              </a>
            </ng-template>
          </app-responsive-table>

          <div class="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex items-center gap-3 text-sm text-slate-600">
              <span>Itens por página</span>
              <select
                [value]="pageSize()"
                (change)="changePageSize($any($event.target).value)"
                class="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              >
                @for (option of pageSizeOptions; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                [disabled]="!canGoPrevious()"
                (click)="changePage(currentPage() - 1)"
                class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                Anterior
              </button>
              <span class="px-3 text-sm text-slate-600">Página {{ currentPage() }} de {{ totalPages() }}</span>
              <button
                type="button"
                [disabled]="!canGoNext()"
                (click)="changePage(currentPage() + 1)"
                class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class ProjectsPageComponent implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly response = signal<ProjectListResponse | null>(null);
  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
    stage: [''],
  });
  readonly pageSize = signal(10);

  readonly statusOptions = ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO'] as const;
  readonly stageOptions = [
    'ESTIMATIVA_PRECO',
    'AGUARDANDO_NOTA_CREDITO',
    'DIEX_REQUISITORIO',
    'AGUARDANDO_NOTA_EMPENHO',
    'OS_LIBERADA',
    'SERVICO_EM_EXECUCAO',
    'ANALISANDO_AS_BUILT',
    'ATESTAR_NF',
    'SERVICO_CONCLUIDO',
    'CANCELADO',
  ] as const;
  readonly pageSizeOptions = [10, 20, 50];
  readonly columns: ResponsiveTableColumn[] = [
    { key: 'project', label: 'Projeto' },
    { key: 'status', label: 'Status' },
    { key: 'stage', label: 'Fase' },
    { key: 'owner', label: 'Responsavel' },
    { key: 'createdAt', label: 'Criado em' },
  ];

  readonly projects = computed<Project[]>(() => this.response()?.items ?? []);
  readonly currentPage = computed(() => this.response()?.meta.page ?? 1);
  readonly totalPages = computed(() => this.response()?.meta.totalPages ?? 1);
  readonly canGoPrevious = computed(() => (this.response()?.meta.hasPreviousPage ?? false) && this.currentPage() > 1);
  readonly canGoNext = computed(() => (this.response()?.meta.hasNextPage ?? false) && this.currentPage() < this.totalPages());
  readonly metaLabel = computed(() => {
    const meta = this.response()?.meta;

    if (!meta) {
      return '';
    }

    return `${meta.totalItems} projeto(s) encontrados. Exibindo página ${meta.page} de ${meta.totalPages}.`;
  });
  readonly activeFilterSummary = computed(() => {
    const { search, status, stage } = this.filtersForm.getRawValue();
    const parts = [
      search ? `Busca: ${search}` : '',
      status ? `Status: ${formatLabel(status)}` : '',
      stage ? `Fase: ${formatLabel(stage)}` : '',
    ].filter(Boolean);

    return parts.join(' • ');
  });

  ngOnInit(): void {
    this.loadProjects();
    this.filtersForm.controls.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.loadProjects(1);
    });
    this.filtersForm.controls.status.valueChanges.subscribe(() => this.loadProjects(1));
    this.filtersForm.controls.stage.valueChanges.subscribe(() => this.loadProjects(1));
  }

  loadProjects(page = this.currentPage()): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const { search, status, stage } = this.filtersForm.getRawValue();

    this.projectsService.list({
      page,
      pageSize: this.pageSize(),
      search: search || undefined,
      status: status || undefined,
      stage: stage || undefined,
    }).subscribe({
      next: (response) => {
        this.response.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar os projetos.'));
        this.response.set(null);
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({
      search: '',
      status: '',
      stage: '',
    }, { emitEvent: false });
    this.loadProjects(1);
  }

  changePage(page: number): void {
    this.loadProjects(page);
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.loadProjects(1);
  }

  projectIdentifier(project: Project): string {
    return buildProjectIdentifier(project.projectCode, project.id, project.createdAt);
  }

  trackProject(project: Project): string {
    return project.id;
  }

  protected readonly formatDate = formatDate;
  protected readonly formatLabel = formatLabel;
}
