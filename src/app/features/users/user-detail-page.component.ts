import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { UserRole } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MetadataGridComponent, MetadataItem } from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { AppUser, UserRoleUpdatePayload, UserUpdatePayload } from './user.model';
import { UsersFeatureService } from './users.service';

@Component({
  selector: 'app-user-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccessDeniedStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    MetadataGridComponent,
    PageHeaderComponent,
    SectionCardComponent,
    SummaryCardComponent,
  ],
  template: `
    <app-page-header
      [title]="userTitle()"
      eyebrow="Usuário"
      subtitle="Detalhe administrativo com dados gerais, perfil, permissões retornadas e status."
      badge="Acesso administrativo"
      backLabel="Voltar para Usuários"
      backLink="/users"
    >
      @if (canManageUsers() && user()) {
        <button page-header-actions type="button" class="btn btn-gold" (click)="toggleEditForm()">
          {{ editingUser() ? 'Fechar' : 'Editar' }}
        </button>
      }
      @if (canManageUsers() && user()) {
        <button
          page-header-actions
          type="button"
          class="btn btn-ghost"
          [disabled]="updatingStatus()"
          (click)="toggleUserStatus()"
        >
          {{ updatingStatus() ? 'Atualizando...' : isActive(user()) ? 'Inativar' : 'Ativar' }}
        </button>
      }
    </app-page-header>

    <div class="workspace">
      @if (successMessage()) {
        <div class="form-alert success">{{ successMessage() }}</div>
      }

      @if (editError()) {
        <div class="form-alert">{{ editError() }}</div>
      }

      @if (loading()) {
        <div class="card">
          <div class="card-body">
            <app-loading-state variant="detail" [count]="3" />
          </div>
        </div>
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite abrir este usuário."
          description="A consulta administrativa foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/users"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar o detalhe do usuário"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="reload()"
        />
      } @else if (!user()) {
        <app-empty-state
          eyebrow="Sem dados"
          title="Nenhum usuário foi encontrado"
          description="Retorne para a listagem e selecione outro registro."
        />
      } @else {
        @if (editingUser()) {
          <section class="card">
            <div class="card-body">
              <form [formGroup]="userForm" class="ata-form" (ngSubmit)="updateUser()">
                <div class="grid grid-2">
                  <label class="field">
                    <span>Nome</span>
                    <input formControlName="name" />
                  </label>
                  <label class="field">
                    <span>Email</span>
                    <input type="email" formControlName="email" />
                  </label>
                  <label class="field">
                    <span>Perfil</span>
                    <select formControlName="role">
                      @for (role of roleOptions; track role) {
                        <option [value]="role">{{ role }}</option>
                      }
                    </select>
                  </label>
                  <label class="field">
                    <span>Posto/Graduação</span>
                    <input formControlName="rank" />
                  </label>
                  <label class="field">
                    <span>CPF</span>
                    <input formControlName="cpf" />
                  </label>
                </div>
                <div class="form-actions">
                  <button type="button" class="btn btn-ghost" (click)="toggleEditForm()">Cancelar</button>
                  <button type="submit" class="btn btn-primary" [disabled]="savingUser() || userForm.invalid">
                    {{ savingUser() ? 'Salvando...' : 'Salvar alterações' }}
                  </button>
                </div>
              </form>
            </div>
          </section>
        }

        <section class="card">
          <div class="card-body">
            <div class="detail-grid">
              @for (item of heroFacts(); track item.label) {
                <div class="detail-item" [class.highlight]="item.highlight">
                  <label>{{ item.label }}</label>
                  <b>{{ item.value }}</b>
                </div>
              }
            </div>
          </div>
        </section>

        <div class="grid grid-3">
          @for (item of summaryCards(); track item.title) {
            <app-summary-card
              [title]="item.title"
              [value]="item.value"
              [description]="item.description"
              [icon]="item.icon"
              [tone]="item.tone"
            />
          }
        </div>

        <div class="grid grid-2 project-main-grid">
          <app-section-card title="Dados gerais" subtitle="Identificação e dados básicos do usuário.">
            <app-metadata-grid [items]="generalFacts()" />
          </app-section-card>

          <app-section-card title="Perfil e status" subtitle="Perfil de acesso, situação e datas de atividade.">
            <div class="next-action-card">
              <span class="badge" [class]="isActive(user()) ? 'b-ok' : 'b-warn'">{{ isActive(user()) ? 'Ativo' : 'Inativo' }}</span>
              <h3>{{ userRole(user()) }}</h3>
              <p>{{ user()?.email || 'Email não informado' }}</p>
            </div>
            <app-metadata-grid [items]="statusFacts()" />
          </app-section-card>
        </div>

        <app-section-card title="Permissões" subtitle="Permissões retornadas junto ao usuário.">
          <span section-card-actions class="badge b-neutral">{{ permissions().length }} permissão(ões)</span>
          @if (permissions().length) {
            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              @for (permission of permissions(); track permission) {
                <div class="detail-item">
                  <label>Permissão</label>
                  <b>{{ permission }}</b>
                </div>
              }
            </div>
          } @else {
            <div class="empty"><p>Nenhuma permissão detalhada veio no cadastro deste usuário.</p></div>
          }
        </app-section-card>
      }
    </div>
  `,
})
export class UserDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly usersService = inject(UsersFeatureService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly editError = signal('');
  readonly successMessage = signal('');
  readonly editingUser = signal(false);
  readonly savingUser = signal(false);
  readonly updatingStatus = signal(false);
  readonly user = signal<AppUser | null>(null);
  readonly roleOptions: UserRole[] = ['ADMIN', 'GESTOR', 'PROJETISTA', 'CONSULTA'];
  private userIdentifier: string | null = null;

  readonly userForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['CONSULTA' as UserRole, Validators.required],
    rank: [''],
    cpf: [''],
  });

  readonly permissions = computed(() => this.user()?.access?.permissions ?? this.user()?.permissions ?? this.profilePermissions());
  readonly heroFacts = computed<MetadataItem[]>(() => [
    { label: 'Código', value: this.userCode(this.user()), highlight: true },
    { label: 'Nome', value: this.user()?.name || 'Não informado' },
    { label: 'Email', value: this.user()?.email || 'Não informado' },
    { label: 'Perfil', value: this.userRole(this.user()) },
  ]);
  readonly summaryCards = computed(() => [
    {
      title: 'Status',
      value: this.isActive(this.user()) ? 'Ativo' : 'Inativo',
      description: 'Situação de acesso',
      icon: 'ST',
      tone: this.isActive(this.user()) ? ('success' as const) : ('warning' as const),
    },
    {
      title: 'Perfil',
      value: this.userRole(this.user()),
      description: 'Vínculo retornado',
      icon: 'PF',
      tone: 'soft' as const,
    },
    {
      title: 'Permissões',
      value: String(this.permissions().length),
      description: 'Permissões detalhadas',
      icon: 'PM',
      tone: 'accent' as const,
    },
  ]);

  ngOnInit(): void {
    this.userIdentifier = this.route.snapshot.paramMap.get('id');

    if (!this.userIdentifier) {
      this.errorMessage.set('Identificador do usuário não informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(): void {
    if (!this.userIdentifier) return;

    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');
    this.editError.set('');

    this.usersService.getById(this.userIdentifier).subscribe({
      next: (user) => {
        this.user.set(user);
        this.errorMessage.set(user ? '' : 'Usuário não encontrado.');
        if (user) {
          this.patchUserForm(user);
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Usuário não encontrado ou sem permissão de acesso.'));
        this.user.set(null);
        this.loading.set(false);
      },
    });
  }

  toggleEditForm(): void {
    this.editingUser.update((visible) => !visible);
    this.editError.set('');
    this.successMessage.set('');

    if (this.editingUser() && this.user()) {
      this.patchUserForm(this.user() as AppUser);
    }
  }

  updateUser(): void {
    const user = this.user();

    if (!user || !this.canManageUsers() || this.userForm.invalid || this.savingUser()) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.savingUser.set(true);
    this.editError.set('');
    this.successMessage.set('');

    const roleChanged = this.userForm.controls.role.value !== this.userRoleValue(user);
    const requests = [
      this.usersService.update(user.id, this.userPayload()),
      ...(roleChanged ? [this.usersService.updateRole(user.id, this.userRolePayload())] : []),
    ];

    forkJoin(requests).subscribe({
      next: () => {
        this.successMessage.set('Usuário atualizado com sucesso.');
        this.savingUser.set(false);
        this.editingUser.set(false);
        this.reload();
      },
      error: (error) => {
        this.editError.set(getErrorMessage(error, 'Não foi possível atualizar o usuário.'));
        this.savingUser.set(false);
      },
    });
  }

  toggleUserStatus(): void {
    const user = this.user();

    if (!user || !this.canManageUsers() || this.updatingStatus()) return;

    const nextActive = !this.isActive(user);
    this.updatingStatus.set(true);
    this.editError.set('');
    this.successMessage.set('');

    this.usersService.updateStatus(user.id, { active: nextActive }).subscribe({
      next: () => {
        this.successMessage.set(nextActive ? 'Usuário ativado com sucesso.' : 'Usuário inativado com sucesso.');
        this.updatingStatus.set(false);
        this.reload();
      },
      error: (error) => {
        this.editError.set(getErrorMessage(error, 'Não foi possível atualizar o status do usuário.'));
        this.updatingStatus.set(false);
      },
    });
  }

  userTitle(): string {
    return this.user()?.name || 'Detalhe do usuário';
  }

  generalFacts(): MetadataItem[] {
    const item = this.user();
    return [
      { label: 'Código', value: this.userCode(item) },
      { label: 'Nome', value: item?.name || 'Não informado' },
      { label: 'Email', value: item?.email || 'Não informado' },
      { label: 'Posto/Graduação', value: item?.rank || 'Não informado' },
      { label: 'CPF', value: item?.cpf || 'Não informado' },
      { label: 'Criado em', value: formatDate(item?.createdAt) },
      { label: 'Atualizado em', value: formatDate(item?.updatedAt) },
    ];
  }

  statusFacts(): MetadataItem[] {
    const item = this.user();
    return [
      { label: 'Perfil', value: this.userRole(item), highlight: true },
      { label: 'Status', value: this.isActive(item) ? 'Ativo' : 'Inativo' },
      { label: 'Último login', value: formatDate(item?.lastLoginAt ?? item?.lastLogin) },
      { label: 'Administrador', value: item?.access?.isAdmin ? 'Sim' : 'Não' },
    ];
  }

  userCode(user: AppUser | null): string {
    const code = user?.userCode ?? user?.code;
    return code ? `#${code}` : 'N/I';
  }

  userRole(user: AppUser | null): string {
    const role = user?.access?.role ?? user?.role ?? (typeof user?.profile === 'string' ? user.profile : user?.profile?.name);
    return role ? formatLabel(role) : 'Não informado';
  }

  isActive(user: AppUser | null): boolean {
    if (!user) return false;
    return user.active !== false &&
      user.isActive !== false &&
      !['INATIVO', 'INACTIVE', 'INATIVA', 'DISABLED'].includes(String(user.status ?? '').toUpperCase());
  }

  canManageUsers(): boolean {
    return this.authService.getUserRole() === 'ADMIN';
  }

  private profilePermissions(): string[] {
    const profile = this.user()?.profile;
    return typeof profile === 'object' && profile?.permissions ? profile.permissions : [];
  }

  private patchUserForm(user: AppUser): void {
    this.userForm.reset({
      name: user.name ?? '',
      email: user.email ?? '',
      role: this.userRoleValue(user),
      rank: user.rank ?? '',
      cpf: user.cpf ?? '',
    });
  }

  private userPayload(): UserUpdatePayload {
    const value = this.userForm.getRawValue();
    return {
      name: value.name.trim(),
      email: value.email.trim(),
      rank: value.rank.trim() || undefined,
      cpf: value.cpf.trim() || undefined,
    };
  }

  private userRolePayload(): UserRoleUpdatePayload {
    const value = this.userForm.getRawValue();
    return {
      role: value.role,
      rank: value.rank.trim() || undefined,
      cpf: value.cpf.trim() || undefined,
    };
  }

  private userRoleValue(user: AppUser): UserRole {
    const role = user.access?.role ?? user.role;
    return this.roleOptions.includes(role as UserRole) ? (role as UserRole) : 'CONSULTA';
  }

  private findUser(items: AppUser[], identifier: string): AppUser | null {
    const normalized = identifier.trim().toLowerCase();
    return items.find((item) =>
      [item.id, item.userCode ? String(item.userCode) : '', item.code ? String(item.code) : '', item.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === normalized),
    ) ?? null;
  }

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }
}
