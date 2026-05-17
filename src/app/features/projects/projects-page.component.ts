import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Project, ProjectListResponse } from '../../core/models/project.model';
import { AuthService } from '../../core/services/auth.service';
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
    <app-page-header
      title="Projetos"
      eyebrow="Operação"
      subtitle="Consulta integrada ao backend com busca, filtros, paginação e acesso ao detalhe do projeto."
      badge="Painel operacional"
    >
      @if (canCreateProject()) {
        <a page-header-actions routerLink="/projects/new" class="btn btn-gold">
          Novo projeto
        </a>
      }
    </app-page-header>

    <div class="workspace projects-workspace">
      <section class="card">
        <form [formGroup]="filtersForm" class="filters projects-filters">
          <input
            type="search"
            formControlName="search"
            class="input"
            placeholder="Buscar por título ou campos relacionados"
            aria-label="Buscar projetos"
          />
          <select formControlName="status" class="select" aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            @for (status of statusOptions; track status) {
              <option [value]="status">{{ formatLabel(status) }}</option>
            }
          </select>
          <select formControlName="stage" class="select" aria-label="Filtrar por fase">
            <option value="">Todas as fases</option>
            @for (stage of stageOptions; track stage) {
              <option [value]="stage">{{ formatLabel(stage) }}</option>
            }
          </select>
          <button type="button" (click)="clearFilters()" class="btn btn-ghost">
            Limpar filtros
          </button>
        </form>

        @if (loading()) {
          <div class="card-body">
            <app-loading-state variant="list" [count]="3" />
          </div>
        } @else if (forbidden()) {
          <div class="card-body">
            <app-access-denied-state
              title="Seu acesso atual não permite consultar a lista de projetos."
              description="A API retornou acesso negado para esta operação. Você pode continuar navegando pelo sistema sem sair da sessão."
              primaryLink="/dashboard"
              secondaryLink="/projects"
              secondaryLabel="Permanecer aqui"
            />
          </div>
        } @else if (errorMessage()) {
          <div class="card-body">
            <app-error-state
              title="Não foi possível consultar os projetos"
              [message]="errorMessage()"
              retryLabel="Tentar novamente"
              (retry)="loadProjects()"
            />
          </div>
        } @else if (!projects().length) {
          <div class="card-body">
            <app-empty-state
              title="Nenhum projeto encontrado com os filtros atuais"
              description="Tente remover parte da busca ou ajustar status e fase para ampliar o resultado."
              actionLabel="Limpar filtros"
              [action]="clearFilters.bind(this)"
            />
          </div>
        } @else {
          <div class="projects-table-head">
            <div>
              <strong>{{ metaLabel() }}</strong>
              @if (activeFilterSummary()) {
                <span class="badge b-neutral">{{ activeFilterSummary() }}</span>
              }
            </div>
            <span>Listagem operacional</span>
          </div>

          <app-responsive-table
            [columns]="columns"
            [data]="projects()"
            [trackBy]="trackProject"
            emptyTitle="Nenhum projeto encontrado"
            emptyDescription="Ajuste os filtros ou tente novamente."
          >
            <ng-template appResponsiveTableCell="project" let-project>
              <div class="project-title-cell">
                <b>#{{ project.projectCode }} - {{ project.title }}</b>
                <span>{{ project.description || 'Sem descrição cadastrada.' }}</span>
              </div>
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
              <a [routerLink]="['/projects', projectIdentifier(project)]" class="btn btn-sm btn-ghost">
                Ver detalhe
              </a>
            </ng-template>
          </app-responsive-table>

          <div class="projects-pagination">
            <div class="pagination-size">
              <span>Itens por página</span>
              <select
                [value]="pageSize()"
                (change)="changePageSize($any($event.target).value)"
                class="select"
                aria-label="Itens por página"
              >
                @for (option of pageSizeOptions; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>

            <div class="pagination-actions">
              <button type="button" [disabled]="!canGoPrevious()" (click)="changePage(currentPage() - 1)" class="btn btn-ghost">
                Anterior
              </button>
              <span>Página {{ currentPage() }} de {{ totalPages() }}</span>
              <button type="button" [disabled]="!canGoNext()" (click)="changePage(currentPage() + 1)" class="btn btn-ghost">
                Próxima
              </button>
            </div>
          </div>
        }
      </section>
    </div>
  `,
})
export class ProjectsPageComponent implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly authService = inject(AuthService);
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
  readonly canCreateProject = computed(() => this.authService.canPerformMutation(['projects.create']));

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
    { key: 'owner', label: 'Responsável' },
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
