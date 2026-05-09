import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
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
import { Ata, AtaListResponse, AtaPayload } from './ata.model';
import { AtasService } from './atas.service';

@Component({
  selector: 'app-atas-page',
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
        title="ATAs"
        eyebrow="Catálogo"
        subtitle="Consulta de atas, fornecedores, vigência, cobertura e disponibilidade para estimativas."
        badge="Catálogo operacional"
      >
        @if (canManageAtas()) {
          <button page-header-actions type="button" class="btn btn-gold" (click)="toggleCreateForm()">
            {{ creatingAta() ? 'Fechar' : 'Nova ATA' }}
          </button>
        }
      </app-page-header>

      @if (successMessage()) {
        <div class="form-alert success">{{ successMessage() }}</div>
      }

      @if (createError()) {
        <div class="form-alert">{{ createError() }}</div>
      }

      @if (creatingAta()) {
        <section class="card">
          <div class="card-body">
            <form [formGroup]="ataForm" class="ata-form" (ngSubmit)="createAta()">
              <div class="grid grid-2">
                <label class="field">
                  <span>NÃºmero da ATA</span>
                  <input formControlName="number" placeholder="Ex.: 001/2026" />
                </label>
                <label class="field">
                  <span>Tipo</span>
                  <select formControlName="type">
                    <option value="CFTV">CFTV</option>
                    <option value="FIBRA_OPTICA">Fibra Ã³ptica</option>
                  </select>
                </label>
                <label class="field">
                  <span>Fornecedor</span>
                  <input formControlName="vendorName" placeholder="Nome do fornecedor" />
                </label>
                <label class="field">
                  <span>Ã“rgÃ£o gerenciador</span>
                  <input formControlName="managingAgency" placeholder="Ã“rgÃ£o gerenciador" />
                </label>
                <label class="field">
                  <span>VigÃªncia inÃ­cio</span>
                  <input type="date" formControlName="startDate" />
                </label>
                <label class="field">
                  <span>VigÃªncia fim</span>
                  <input type="date" formControlName="endDate" />
                </label>
              </div>
              <label class="field">
                <span>ObservaÃ§Ãµes</span>
                <textarea formControlName="observations" rows="3" placeholder="ObservaÃ§Ãµes da ATA"></textarea>
              </label>
              <label class="field-checkbox">
                <input type="checkbox" formControlName="isActive" />
                <span>ATA ativa</span>
              </label>
              <div class="form-actions">
                <button type="button" class="btn btn-ghost" (click)="toggleCreateForm()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="savingAta() || ataForm.invalid">
                  {{ savingAta() ? 'Salvando...' : 'Salvar ATA' }}
                </button>
              </div>
            </form>
          </div>
        </section>
      }

      <section class="card">
        <form [formGroup]="filtersForm" class="filters atas-filters">
          <input type="search" formControlName="search" class="input" placeholder="Buscar por número, tipo ou fornecedor" />
          <select formControlName="status" class="select">
            <option value="">Todos os status</option>
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
          </select>
          <input type="search" formControlName="type" class="input" placeholder="Tipo da ATA" />
          <button type="button" (click)="clearFilters()" class="btn btn-ghost">
            Limpar filtros
          </button>
        </form>
      </section>

      @if (loading()) {
        <app-loading-state variant="list" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar ATAs."
          description="A consulta ao catálogo foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/dashboard"
          secondaryLink="/projects"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar as ATAs"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadAtas()"
        />
      } @else if (!filteredAtas().length) {
        <app-empty-state
          title="Nenhuma ATA encontrada com os filtros atuais"
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
            [data]="pagedAtas()"
            [trackBy]="trackAta"
            emptyTitle="Nenhuma ATA encontrada"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="ata" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ ataLabel(item) }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.number || 'Número não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="vendor" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">{{ item.vendorName || 'Fornecedor não informado' }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.type ? formatLabel(item.type) : 'Tipo não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="coverage" let-item>
              <span class="badge b-info">{{ (item.coverageGroups ?? []).length }} grupo(s)</span>
            </ng-template>
            <ng-template appResponsiveTableCell="validity" let-item>
              {{ dateRange(item.validFrom || item.startDate, item.validUntil || item.endDate) }}
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-item>
              <span class="badge" [class]="isActive(item) ? 'b-ok' : 'b-warn'">
                {{ isActive(item) ? 'Ativa' : 'Inativa' }}
              </span>
            </ng-template>
            <ng-template appResponsiveTableActions let-item>
              <a [routerLink]="['/atas', ataIdentifier(item)]" class="btn btn-sm btn-ghost">
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
export class AtasPageComponent implements OnInit {
  private readonly atasService = inject(AtasService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly createError = signal('');
  readonly successMessage = signal('');
  readonly creatingAta = signal(false);
  readonly savingAta = signal(false);
  readonly atas = signal<Ata[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'ata', label: 'ATA' },
    { key: 'vendor', label: 'Fornecedor' },
    { key: 'coverage', label: 'Cobertura' },
    { key: 'validity', label: 'Vigência' },
    { key: 'status', label: 'Status' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
    type: [''],
  });

  readonly ataForm = this.fb.nonNullable.group({
    number: ['', Validators.required],
    type: ['CFTV' as 'CFTV' | 'FIBRA_OPTICA', Validators.required],
    vendorName: ['', Validators.required],
    managingAgency: [''],
    startDate: [''],
    endDate: [''],
    observations: [''],
    isActive: [true],
  });

  readonly filteredAtas = computed(() => {
    const { search, status, type } = this.filtersForm.getRawValue();
    const term = search.trim().toLowerCase();
    const typeTerm = type.trim().toLowerCase();

    return this.atas().filter((ata) => {
      const matchesSearch = !term ||
        [ata.number, ata.type, ata.vendorName, ata.ataCode ? String(ata.ataCode) : '']
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = !status || (status === 'active' ? this.isActive(ata) : !this.isActive(ata));
      const matchesType = !typeTerm || String(ata.type ?? '').toLowerCase().includes(typeTerm);

      return matchesSearch && matchesStatus && matchesType;
    });
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredAtas().length / this.pageSize())));
  readonly canGoPrevious = computed(() => this.currentPage() > 1);
  readonly canGoNext = computed(() => this.currentPage() < this.totalPages());
  readonly pagedAtas = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredAtas().slice(start, start + this.pageSize());
  });
  readonly metaLabel = computed(() =>
    `${this.filteredAtas().length} ATA(s) encontrada(s). Exibindo página ${this.currentPage()} de ${this.totalPages()}.`,
  );
  readonly activeFilterSummary = computed(() => {
    const { search, status, type } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      status === 'active' ? 'Ativas' : status === 'inactive' ? 'Inativas' : '',
      type ? `Tipo: ${type}` : '',
    ].filter(Boolean).join(' • ');
  });

  ngOnInit(): void {
    this.loadAtas();
    this.filtersForm.valueChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.currentPage.set(1);
    });
  }

  loadAtas(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    this.atasService.list().subscribe({
      next: (response) => {
        this.atas.set(this.listItems(response));
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar as ATAs.'));
        this.atas.set([]);
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '', type: '' }, { emitEvent: false });
    this.currentPage.set(1);
  }

  toggleCreateForm(): void {
    this.creatingAta.update((visible) => !visible);
    this.createError.set('');
    this.successMessage.set('');

    if (!this.creatingAta()) {
      this.resetAtaForm();
    }
  }

  createAta(): void {
    if (!this.canManageAtas() || this.ataForm.invalid || this.savingAta()) {
      this.ataForm.markAllAsTouched();
      return;
    }

    this.savingAta.set(true);
    this.createError.set('');
    this.successMessage.set('');

    this.atasService.create(this.ataPayload()).subscribe({
      next: (ata) => {
        this.successMessage.set('ATA criada com sucesso.');
        this.savingAta.set(false);
        this.creatingAta.set(false);
        this.resetAtaForm();
        void this.router.navigate(['/atas', ata.id]);
      },
      error: (error) => {
        this.createError.set(getErrorMessage(error, 'NÃ£o foi possÃ­vel criar a ATA.'));
        this.savingAta.set(false);
      },
    });
  }

  changePage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  ataIdentifier(ata: Ata): string {
    return ata.id;
  }

  ataLabel(ata: Ata): string {
    return [ata.type ? formatLabel(ata.type) : 'ATA', ata.number || (ata.ataCode ? `#${ata.ataCode}` : '')]
      .filter(Boolean)
      .join(' ');
  }

  isActive(ata: Ata): boolean {
    return ata.isActive !== false && !['INATIVA', 'INACTIVE', 'CANCELADA', 'CANCELADO'].includes(String(ata.status ?? '').toUpperCase());
  }

  canManageAtas(): boolean {
    return this.authService.getUserRole() === 'ADMIN';
  }

  dateRange(start: string | null | undefined, end: string | null | undefined): string {
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);

    if (formattedStart === 'Não informado' && formattedEnd === 'Não informado') return 'Não informado';
    return `${formattedStart} até ${formattedEnd}`;
  }

  trackAta = (item: Ata) => item.id;
  readonly formatLabel = formatLabel;

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }

  private ataPayload(): AtaPayload {
    const value = this.ataForm.getRawValue();
    return {
      number: value.number.trim(),
      type: value.type,
      vendorName: value.vendorName.trim(),
      managingAgency: value.managingAgency.trim() || undefined,
      startDate: value.startDate || undefined,
      endDate: value.endDate || undefined,
      observations: value.observations.trim() || undefined,
      isActive: value.isActive,
    };
  }

  private resetAtaForm(): void {
    this.ataForm.reset({
      number: '',
      type: 'CFTV',
      vendorName: '',
      managingAgency: '',
      startDate: '',
      endDate: '',
      observations: '',
      isActive: true,
    });
  }
}
