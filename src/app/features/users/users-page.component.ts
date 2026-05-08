import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

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
import { formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { AppUser } from './user.model';
import { UsersFeatureService } from './users.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
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
  ],
  template: `
    <section class="workspace">
      <app-page-header
        title="Usuários"
        eyebrow="Governança"
        subtitle="Consulta administrativa de usuários, perfis e situação de acesso."
        badge="Acesso administrativo"
      />

      <section class="card">
        <form [formGroup]="filtersForm" class="filters projects-filters">
          <input type="search" formControlName="search" class="input" placeholder="Buscar por código, nome, email ou perfil" />
          <select formControlName="role" class="select">
            <option value="">Todos os perfis</option>
            <option value="ADMIN">ADMIN</option>
            <option value="GESTOR">GESTOR</option>
            <option value="PROJETISTA">PROJETISTA</option>
            <option value="CONSULTA">CONSULTA</option>
          </select>
          <select formControlName="status" class="select">
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <button type="button" (click)="clearFilters()" class="btn btn-ghost">
            Limpar filtros
          </button>
        </form>
      </section>

      @if (loading()) {
        <app-loading-state variant="list" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar usuários."
          description="A consulta administrativa foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/dashboard"
          secondaryLink="/projects"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar os usuários"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadUsers()"
        />
      } @else if (!filteredUsers().length) {
        <app-empty-state
          title="Nenhum usuário encontrado com os filtros atuais"
          description="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          actionLabel="Limpar filtros"
          [action]="clearFilters.bind(this)"
        />
      } @else {
        <section class="card">
          <div class="estimates-table-head">
            <div>
              <strong>{{ metaLabel() }}</strong>
              @if (activeFilterSummary()) {
                <span class="badge b-neutral">{{ activeFilterSummary() }}</span>
              }
            </div>
            <span>Dados atualizados</span>
          </div>

          <app-responsive-table
            [columns]="columns"
            [data]="pagedUsers()"
            [trackBy]="trackUser"
            emptyTitle="Nenhum usuário encontrado"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="code" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ userCode(item) }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="name" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.name || 'Nome não informado' }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.email || 'Email não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="role" let-item>
              {{ userRole(item) }}
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-item>
              <span class="badge" [class]="isActive(item) ? 'b-ok' : 'b-warn'">
                {{ isActive(item) ? 'Ativo' : 'Inativo' }}
              </span>
            </ng-template>
            <ng-template appResponsiveTableCell="lastLogin" let-item>
              {{ lastLoginLabel(item) }}
            </ng-template>
            <ng-template appResponsiveTableActions let-item>
              <a [routerLink]="['/users', userIdentifier(item)]" class="btn btn-sm btn-ghost">
                Ver detalhe
              </a>
            </ng-template>
          </app-responsive-table>

          <div class="estimates-pagination">
            <div class="pagination-size">
              <span>Itens por página</span>
              <select [value]="pageSize()" (change)="changePageSize($any($event.target).value)" class="select">
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
        </section>
      }
    </section>
  `,
})
export class UsersPageComponent implements OnInit {
  private readonly usersService = inject(UsersFeatureService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly users = signal<AppUser[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nome / Email' },
    { key: 'role', label: 'Perfil' },
    { key: 'status', label: 'Status' },
    { key: 'lastLogin', label: 'Último login' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    role: [''],
    status: [''],
  });

  readonly filteredUsers = computed(() => {
    const { search, role, status } = this.filtersForm.getRawValue();
    const term = search.trim().toLowerCase();
    const selectedRole = role.trim().toUpperCase();

    return this.users().filter((user) => {
      const matchesSearch = !term ||
        [this.userCode(user), user.name, user.email, this.userRole(user)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesRole = !selectedRole || this.userRole(user).toUpperCase() === selectedRole;
      const matchesStatus = !status || (status === 'active' ? this.isActive(user) : !this.isActive(user));

      return matchesSearch && matchesRole && matchesStatus;
    });
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize())));
  readonly canGoPrevious = computed(() => this.currentPage() > 1);
  readonly canGoNext = computed(() => this.currentPage() < this.totalPages());
  readonly pagedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });
  readonly metaLabel = computed(() =>
    `${this.filteredUsers().length} usuário(s) encontrado(s). Exibindo página ${this.currentPage()} de ${this.totalPages()}.`,
  );
  readonly activeFilterSummary = computed(() => {
    const { search, role, status } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      role ? `Perfil: ${role}` : '',
      status === 'active' ? 'Ativos' : status === 'inactive' ? 'Inativos' : '',
    ].filter(Boolean).join(' • ');
  });

  ngOnInit(): void {
    this.loadUsers();
    this.filtersForm.valueChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.currentPage.set(1);
    });
  }

  loadUsers(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    this.usersService.list().subscribe({
      next: (response) => {
        this.users.set(this.listItems(response));
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar os usuários.'));
        this.users.set([]);
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', role: '', status: '' }, { emitEvent: false });
    this.currentPage.set(1);
  }

  changePage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  userIdentifier(user: AppUser): string {
    return user.id;
  }

  userCode(user: AppUser): string {
    const code = user.userCode ?? user.code;
    return code ? `#${code}` : 'N/I';
  }

  userRole(user: AppUser): string {
    const role = user.access?.role ?? user.role ?? (typeof user.profile === 'string' ? user.profile : user.profile?.name);
    return role ? formatLabel(role) : 'Não informado';
  }

  lastLoginLabel(user: AppUser): string {
    return formatDate(user.lastLoginAt ?? user.lastLogin);
  }

  isActive(user: AppUser): boolean {
    return user.active !== false &&
      user.isActive !== false &&
      !['INATIVO', 'INACTIVE', 'INATIVA', 'DISABLED'].includes(String(user.status ?? '').toUpperCase());
  }

  trackUser = (item: AppUser) => item.id;

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }
}
