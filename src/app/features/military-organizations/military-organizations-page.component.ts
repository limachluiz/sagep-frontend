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
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { MilitaryOrganization } from './military-organization.model';
import { MilitaryOrganizationsFeatureService } from './military-organizations.service';

@Component({
  selector: 'app-military-organizations-page',
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
        title="OMs"
        eyebrow="Governança"
        subtitle="Consulta de organizações militares apoiadas, localização e situação cadastral."
        badge="Catálogo institucional"
      />

      <section class="card">
        <form [formGroup]="filtersForm" class="filters projects-filters">
          <input type="search" formControlName="search" class="input" placeholder="Buscar por código, sigla, nome ou cidade" />
          <select formControlName="status" class="select">
            <option value="">Todos os status</option>
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
          </select>
          <input type="search" formControlName="stateUf" class="input" placeholder="UF" />
          <button type="button" (click)="clearFilters()" class="btn btn-ghost">
            Limpar filtros
          </button>
        </form>
      </section>

      @if (loading()) {
        <app-loading-state variant="list" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar OMs."
          description="A consulta institucional foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/dashboard"
          secondaryLink="/projects"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar as OMs"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadOrganizations()"
        />
      } @else if (!filteredOrganizations().length) {
        <app-empty-state
          title="Nenhuma OM encontrada com os filtros atuais"
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
            [data]="pagedOrganizations()"
            [trackBy]="trackOrganization"
            emptyTitle="Nenhuma OM encontrada"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="code" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.omCode ? '#' + item.omCode : 'N/I' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="sigla" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.sigla || 'Sigla não informada' }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.name || 'Nome não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="cityName" let-item>
              {{ item.cityName || 'Cidade não informada' }}
            </ng-template>
            <ng-template appResponsiveTableCell="stateUf" let-item>
              {{ item.stateUf || 'UF não informada' }}
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-item>
              <span class="badge" [class]="isActive(item) ? 'b-ok' : 'b-warn'">
                {{ isActive(item) ? 'Ativa' : 'Inativa' }}
              </span>
            </ng-template>
            <ng-template appResponsiveTableActions let-item>
              <a [routerLink]="['/oms', organizationIdentifier(item)]" class="btn btn-sm btn-ghost">
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
export class MilitaryOrganizationsPageComponent implements OnInit {
  private readonly organizationsService = inject(MilitaryOrganizationsFeatureService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly organizations = signal<MilitaryOrganization[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'code', label: 'Código' },
    { key: 'sigla', label: 'Sigla / Nome' },
    { key: 'cityName', label: 'Cidade' },
    { key: 'stateUf', label: 'UF' },
    { key: 'status', label: 'Status' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
    stateUf: [''],
  });

  readonly filteredOrganizations = computed(() => {
    const { search, status, stateUf } = this.filtersForm.getRawValue();
    const term = search.trim().toLowerCase();
    const uf = stateUf.trim().toLowerCase();

    return this.organizations().filter((om) => {
      const matchesSearch = !term ||
        [om.omCode ? String(om.omCode) : '', om.sigla, om.name, om.cityName, om.stateUf]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = !status || (status === 'active' ? this.isActive(om) : !this.isActive(om));
      const matchesUf = !uf || String(om.stateUf ?? '').toLowerCase().includes(uf);

      return matchesSearch && matchesStatus && matchesUf;
    });
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredOrganizations().length / this.pageSize())));
  readonly canGoPrevious = computed(() => this.currentPage() > 1);
  readonly canGoNext = computed(() => this.currentPage() < this.totalPages());
  readonly pagedOrganizations = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredOrganizations().slice(start, start + this.pageSize());
  });
  readonly metaLabel = computed(() =>
    `${this.filteredOrganizations().length} OM(s) encontrada(s). Exibindo página ${this.currentPage()} de ${this.totalPages()}.`,
  );
  readonly activeFilterSummary = computed(() => {
    const { search, status, stateUf } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      status === 'active' ? 'Ativas' : status === 'inactive' ? 'Inativas' : '',
      stateUf ? `UF: ${stateUf}` : '',
    ].filter(Boolean).join(' • ');
  });

  ngOnInit(): void {
    this.loadOrganizations();
    this.filtersForm.valueChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.currentPage.set(1);
    });
  }

  loadOrganizations(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    this.organizationsService.list().subscribe({
      next: (response) => {
        this.organizations.set(this.listItems(response));
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar as OMs.'));
        this.organizations.set([]);
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '', stateUf: '' }, { emitEvent: false });
    this.currentPage.set(1);
  }

  changePage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  organizationIdentifier(organization: MilitaryOrganization): string {
    return organization.id;
  }

  isActive(organization: MilitaryOrganization): boolean {
    return organization.isActive !== false && !['INATIVA', 'INACTIVE'].includes(String(organization.status ?? '').toUpperCase());
  }

  trackOrganization = (item: MilitaryOrganization) => item.id;

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }
}
