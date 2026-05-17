import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { MilitaryOrganization } from '../../core/models/military-organization.model';
import { ProjectCreatePayload, ProjectLookupResponse } from '../../core/models/project.model';
import { AuthService } from '../../core/services/auth.service';
import { MilitaryOrganizationsService } from '../../core/services/military-organizations.service';
import { ProjectsService } from '../../core/services/projects.service';
import { AppUser } from '../users/user.model';
import { UsersFeatureService } from '../users/users.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import {
  MetadataGridComponent,
  MetadataItem,
} from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { buildProjectIdentifier } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';

@Component({
  selector: 'app-project-create-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AccessDeniedStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    MetadataGridComponent,
    PageHeaderComponent,
    SectionCardComponent,
  ],
  template: `
    <section class="workspace">
      <app-page-header
        title="Novo projeto"
        eyebrow="Projetos"
        subtitle="Cadastre os dados mínimos do projeto conforme o contrato da API."
        badge="Criação"
        backLabel="Voltar para projetos"
        backLink="/projects"
      />

      @if (loading()) {
        <app-loading-state variant="detail" [count]="2" />
      } @else if (!canCreateProject()) {
        <app-access-denied-state
          title="Seu acesso atual não permite criar projetos."
          description="O perfil CONSULTA pode acompanhar projetos, mas não pode iniciar novos cadastros."
          primaryLink="/projects"
          primaryLabel="Voltar para projetos"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite criar projetos."
          description="A API retornou acesso negado para esta operação."
          primaryLink="/projects"
          primaryLabel="Voltar para projetos"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else {
        @if (loadError()) {
          <app-error-state
            title="Não foi possível preparar o cadastro"
            [message]="loadError()"
            retryLabel="Tentar novamente"
            (retry)="loadInitialData()"
          />
        }

        @if (successMessage()) {
          <div class="form-alert success">{{ successMessage() }}</div>
        }

        @if (saveError()) {
          <app-error-state
            title="Não foi possível criar o projeto"
            [message]="saveError()"
            retryLabel=""
          />
        }

        <form [formGroup]="form" (ngSubmit)="saveProject()" class="grid gap-5">
          <app-section-card
            title="Dados do projeto"
            subtitle="Informe somente os campos aceitos pelo contrato de criação."
          >
            <div class="grid gap-4 md:grid-cols-2">
              <label class="field md:col-span-2" for="title">
                <span>Título</span>
                <input
                  id="title"
                  formControlName="title"
                  class="input"
                  maxlength="160"
                  autocomplete="off"
                  placeholder="Título do projeto"
                />
                @if (showRequiredError('title')) {
                  <small class="field-error">Título é obrigatório.</small>
                }
              </label>

              <label class="field md:col-span-2" for="description">
                <span>Descrição</span>
                <textarea
                  id="description"
                  formControlName="description"
                  class="input"
                  rows="4"
                  maxlength="1200"
                  placeholder="Descrição opcional do projeto"
                ></textarea>
              </label>

              <label class="field" for="omId">
                <span>OM</span>
                <select id="omId" formControlName="omId" class="select">
                  <option value="">Selecione</option>
                  @for (om of oms(); track om.id) {
                    <option [value]="om.id">{{ omLabel(om) }}</option>
                  }
                </select>
                @if (showRequiredError('omId')) {
                  <small class="field-error">OM é obrigatória.</small>
                }
              </label>

              <label class="field" for="ownerId">
                <span>Responsável</span>
                <select id="ownerId" formControlName="ownerId" class="select">
                  <option value="">Selecione</option>
                  @for (user of projetistas(); track user.id) {
                    <option [value]="user.id">{{ userLabel(user) }}</option>
                  }
                </select>
                @if (showRequiredError('ownerId')) {
                  <small class="field-error">Responsável é obrigatório.</small>
                }
              </label>

              <label class="field" for="startDate">
                <span>Início</span>
                <input id="startDate" type="date" formControlName="startDate" class="input" />
              </label>

              <label class="field" for="endDate">
                <span>Fim</span>
                <input id="endDate" type="date" formControlName="endDate" class="input" />
              </label>
            </div>
          </app-section-card>

          <app-section-card
            title="Resumo"
            subtitle="Revise os dados que serão enviados."
          >
            <app-metadata-grid [items]="reviewItems()" gridClass="md:grid-cols-2" />
          </app-section-card>

          <div class="form-actions">
            <a routerLink="/projects" class="btn btn-ghost">Cancelar</a>
            <button type="submit" class="btn btn-gold" [disabled]="saving()">
              {{ saving() ? 'Criando...' : 'Criar projeto' }}
            </button>
          </div>
        </form>
      }
    </section>
  `,
})
export class ProjectCreatePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly projectsService = inject(ProjectsService);
  private readonly militaryOrganizationsService = inject(MilitaryOrganizationsService);
  private readonly usersService = inject(UsersFeatureService);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    omId: ['', Validators.required],
    ownerId: ['', Validators.required],
    startDate: [''],
    endDate: [''],
  });

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly successMessage = signal('');
  readonly saving = signal(false);
  readonly oms = signal<MilitaryOrganization[]>([]);
  readonly projetistas = signal<AppUser[]>([]);
  readonly canCreateProject = computed(() => this.authService.canPerformMutation(['projects.create']));

  ngOnInit(): void {
    if (!this.canCreateProject()) {
      this.loading.set(false);
      return;
    }

    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.loadError.set('');

    forkJoin({
      oms: this.militaryOrganizationsService.list(),
      users: this.usersService.list(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ oms, users }) => {
          this.oms.set(this.listItems(oms).filter((om) => om.isActive !== false));
          this.projetistas.set(this.listItems(users).filter((user) => this.isActiveProjetista(user)));
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.loadError.set(getErrorMessage(error, 'Falha ao carregar OMs e responsáveis.'));
        },
      });
  }

  saveProject(): void {
    this.saveError.set('');
    this.successMessage.set('');

    if (!this.canCreateProject()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError.set('Revise os campos obrigatórios antes de salvar.');
      return;
    }

    this.saving.set(true);
    this.projectsService
      .create(this.payload())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (project) => {
          this.successMessage.set('Projeto criado com sucesso. Abrindo detalhe...');
          void this.router.navigate(['/projects', this.projectIdentifier(project)]);
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.saveError.set(getErrorMessage(error, 'Falha ao criar o projeto.'));
        },
      });
  }

  showRequiredError(controlName: 'title' | 'omId' | 'ownerId'): boolean {
    const control = this.form.controls[controlName];
    return control.hasError('required') && (control.touched || control.dirty);
  }

  reviewItems(): MetadataItem[] {
    const value = this.form.getRawValue();

    return [
      { label: 'Título', value: value.title || null },
      { label: 'OM', value: this.omLabelById(value.omId) },
      { label: 'Responsável', value: this.userLabelById(value.ownerId) },
      { label: 'Início', value: value.startDate || null },
      { label: 'Fim', value: value.endDate || null },
      { label: 'Descrição', value: value.description || null },
    ];
  }

  omLabel(om: MilitaryOrganization): string {
    const name = [om.sigla, om.name].filter(Boolean).join(' - ') || om.id;
    const location = [om.cityName, om.stateUf].filter(Boolean).join(' / ');
    return location ? `${name} (${location})` : name;
  }

  userLabel(user: AppUser): string {
    return [user.name, user.email].filter(Boolean).join(' - ') || user.id;
  }

  private omLabelById(id: string): string {
    const om = this.oms().find((candidate) => candidate.id === id);
    return om ? this.omLabel(om) : 'Não informado';
  }

  private userLabelById(id: string): string {
    const user = this.projetistas().find((candidate) => candidate.id === id);
    return user ? this.userLabel(user) : 'Não informado';
  }

  private isActiveProjetista(user: AppUser): boolean {
    const role = String(user.access?.role ?? user.role ?? (typeof user.profile === 'string' ? user.profile : user.profile?.name) ?? '').toUpperCase();
    const inactiveStatus = ['INATIVO', 'INACTIVE', 'INATIVA', 'DISABLED'].includes(String(user.status ?? '').toUpperCase());

    return role === 'PROJETISTA' && user.active !== false && user.isActive !== false && !inactiveStatus;
  }

  private payload(): ProjectCreatePayload {
    const value = this.form.getRawValue();

    return {
      title: value.title.trim(),
      omId: value.omId,
      ownerId: value.ownerId,
      ...(value.description.trim() ? { description: value.description.trim() } : {}),
      ...(value.startDate ? { startDate: value.startDate } : {}),
      ...(value.endDate ? { endDate: value.endDate } : {}),
    };
  }

  private projectIdentifier(project: ProjectLookupResponse): string {
    return project.projectCode
      ? buildProjectIdentifier(project.projectCode, project.id, project.createdAt)
      : project.id;
  }

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }
}
