import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Project, ProjectListResponse } from '../../core/models/project.model';
import { ProjectsService } from '../../core/services/projects.service';
import { formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage } from '../../shared/utils/http-error.util';

@Component({
  selector: 'app-projects-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="space-y-6">
      <div class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Projetos</p>
            <h1 class="mt-3 text-3xl font-semibold text-slate-950">Lista de projetos integrados ao backend</h1>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Consulta em <code>/projects</code> com acesso governado pelo backend e navegação para o detalhe ampliado.
            </p>
          </div>
          <form [formGroup]="filtersForm" class="w-full max-w-md">
            <input
              type="search"
              formControlName="search"
              class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
              placeholder="Buscar por titulo ou campos relacionados"
            />
          </form>
        </div>
      </div>

      @if (loading()) {
        <div class="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-[var(--sagep-shadow)]">
          Carregando projetos...
        </div>
      } @else if (errorMessage()) {
        <div class="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 class="text-lg font-semibold">Nao foi possivel consultar os projetos</h2>
          <p class="mt-2 text-sm">{{ errorMessage() }}</p>
        </div>
      } @else if (!projects().length) {
        <div class="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-[var(--sagep-shadow)]">
          Nenhum projeto foi retornado pela API.
        </div>
      } @else {
        <div class="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[var(--sagep-shadow)]">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr class="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                  <th class="px-5 py-4">Projeto</th>
                  <th class="px-5 py-4">Status</th>
                  <th class="px-5 py-4">Fase</th>
                  <th class="px-5 py-4">Responsavel</th>
                  <th class="px-5 py-4">Criado em</th>
                  <th class="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (project of projects(); track project.id) {
                  <tr class="align-top">
                    <td class="px-5 py-4">
                      <p class="font-semibold text-slate-900">#{{ project.projectCode }} - {{ project.title }}</p>
                      <p class="mt-1 text-sm text-slate-500">{{ project.description || 'Sem descricao cadastrada.' }}</p>
                    </td>
                    <td class="px-5 py-4 text-sm text-slate-700">{{ formatLabel(project.status) }}</td>
                    <td class="px-5 py-4 text-sm text-slate-700">{{ formatLabel(project.stage) }}</td>
                    <td class="px-5 py-4 text-sm text-slate-700">{{ project.ownerName || project.owner?.name || 'Nao informado' }}</td>
                    <td class="px-5 py-4 text-sm text-slate-700">{{ formatDate(project.createdAt) }}</td>
                    <td class="px-5 py-4 text-right">
                      <a
                        [routerLink]="['/projects', project.id]"
                        class="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                      >
                        Ver detalhe
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            {{ metaLabel() }}
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
  readonly errorMessage = signal('');
  readonly response = signal<ProjectListResponse | null>(null);
  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly projects = computed<Project[]>(() => this.response()?.items ?? []);
  readonly metaLabel = computed(() => {
    const meta = this.response()?.meta;

    if (!meta) {
      return '';
    }

    return `${meta.totalItems} projeto(s) encontrados. Pagina ${meta.page} de ${meta.totalPages}.`;
  });

  ngOnInit(): void {
    this.loadProjects();
    this.filtersForm.controls.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.loadProjects();
    });
  }

  loadProjects(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.projectsService.list({ search: this.filtersForm.controls.search.value || undefined }).subscribe({
      next: (response) => {
        this.response.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar os projetos.'));
        this.loading.set(false);
      },
    });
  }

  protected readonly formatDate = formatDate;
  protected readonly formatLabel = formatLabel;
}
