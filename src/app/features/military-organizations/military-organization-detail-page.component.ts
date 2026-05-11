import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MetadataGridComponent, MetadataItem } from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import {
  MilitaryOrganization,
  MilitaryOrganizationEstimateSummary,
  MilitaryOrganizationStateUf,
  MilitaryOrganizationUpdatePayload,
} from './military-organization.model';
import { MilitaryOrganizationsFeatureService } from './military-organizations.service';

@Component({
  selector: 'app-military-organization-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
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
      [title]="organizationTitle()"
      eyebrow="OM"
      subtitle="Detalhe institucional com dados gerais, localização e estimativas vinculadas quando disponíveis."
      badge="Catálogo institucional"
      backLabel="Voltar para OMs"
      backLink="/oms"
    >
      @if (canManageOrganizations() && organization()) {
        <button page-header-actions type="button" class="btn btn-gold" (click)="toggleEditForm()">
          {{ editingOrganization() ? 'Fechar' : 'Editar' }}
        </button>
      }
      @if (canManageOrganizations() && organization()) {
        <button
          page-header-actions
          type="button"
          class="btn btn-ghost danger-action"
          [disabled]="deletingOrganization()"
          (click)="deleteOrganization()"
        >
          {{ deletingOrganization() ? 'Excluindo...' : 'Excluir' }}
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
          title="Seu acesso atual não permite abrir esta OM."
          description="A consulta institucional foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/oms"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar o detalhe da OM"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="reload()"
        />
      } @else if (!organization()) {
        <app-empty-state
          eyebrow="Sem dados"
          title="Nenhuma OM foi encontrada"
          description="Retorne para a listagem e selecione outro registro."
        />
      } @else {
        @if (editingOrganization()) {
          <section class="card">
            <div class="card-body">
              <form [formGroup]="organizationForm" class="ata-form" (ngSubmit)="updateOrganization()">
                <div class="grid grid-2">
                  <label class="field">
                    <span>Sigla</span>
                    <input formControlName="sigla" />
                  </label>
                  <label class="field">
                    <span>Nome</span>
                    <input formControlName="name" />
                  </label>
                  <label class="field">
                    <span>Cidade</span>
                    <input formControlName="cityName" />
                  </label>
                  <label class="field">
                    <span>UF</span>
                    <select formControlName="stateUf">
                      @for (uf of stateOptions; track uf) {
                        <option [value]="uf">{{ uf }}</option>
                      }
                    </select>
                  </label>
                </div>
                <label class="field-checkbox">
                  <input type="checkbox" formControlName="isActive" />
                  <span>OM ativa</span>
                </label>
                <div class="form-actions">
                  <button type="button" class="btn btn-ghost" (click)="toggleEditForm()">Cancelar</button>
                  <button type="submit" class="btn btn-primary" [disabled]="savingOrganization() || organizationForm.invalid">
                    {{ savingOrganization() ? 'Salvando...' : 'Salvar alterações' }}
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
          <app-section-card title="Dados gerais" subtitle="Identificação institucional e situação cadastral.">
            <app-metadata-grid [items]="generalFacts()" />
          </app-section-card>

          <app-section-card title="Localização" subtitle="Cidade e unidade federativa vinculadas à OM.">
            <div class="next-action-card">
              <span class="badge" [class]="isActive(organization()) ? 'b-ok' : 'b-warn'">{{ isActive(organization()) ? 'Ativa' : 'Inativa' }}</span>
              <h3>{{ locationLabel() }}</h3>
              <p>{{ organization()?.name || 'Nome não informado' }}</p>
            </div>
            <app-metadata-grid [items]="locationFacts()" />
          </app-section-card>
        </div>

        <app-section-card title="Estimativas vinculadas" subtitle="Estimativas associadas retornadas junto ao cadastro da OM.">
          <span section-card-actions class="badge b-neutral">{{ estimates().length }} estimativa(s)</span>
          @if (estimates().length) {
            <div class="table-wrap hidden lg:block">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estimativa</th>
                    <th>Projeto</th>
                    <th>Status</th>
                    <th>Valor</th>
                    <th>Criada em</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (estimate of estimates(); track estimate.id) {
                    <tr>
                      <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ estimateLabel(estimate) }}</td>
                      <td>{{ estimate.project?.title || projectLabel(estimate) }}</td>
                      <td>{{ estimate.status ? formatLabel(estimate.status) : 'Não informado' }}</td>
                      <td>{{ formatCurrency(estimate.totalAmount) }}</td>
                      <td>{{ formatDate(estimate.createdAt) }}</td>
                      <td class="text-right">
                        <a [routerLink]="['/estimates', estimate.id]" class="btn btn-sm btn-ghost">Ver estimativa</a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="grid gap-4 lg:hidden">
              @for (estimate of estimates(); track estimate.id) {
                <article class="estimate-item-card">
                  <div>
                    <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ estimateLabel(estimate) }}</p>
                    <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ estimate.project?.title || projectLabel(estimate) }}</p>
                  </div>
                  <app-metadata-grid [items]="estimateFacts(estimate)" gridClass="sm:grid-cols-2" />
                  <a [routerLink]="['/estimates', estimate.id]" class="btn btn-sm btn-ghost">Ver estimativa</a>
                </article>
              }
            </div>
          } @else {
            <div class="empty"><p>Nenhuma estimativa vinculada foi encontrada para esta OM.</p></div>
          }
        </app-section-card>
      }
    </div>
  `,
})
export class MilitaryOrganizationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly organizationsService = inject(MilitaryOrganizationsFeatureService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly editError = signal('');
  readonly successMessage = signal('');
  readonly editingOrganization = signal(false);
  readonly savingOrganization = signal(false);
  readonly deletingOrganization = signal(false);
  readonly organization = signal<MilitaryOrganization | null>(null);
  readonly stateOptions: MilitaryOrganizationStateUf[] = ['AM', 'RO', 'RR', 'AC'];
  private organizationIdentifier: string | null = null;

  readonly organizationForm = this.fb.nonNullable.group({
    sigla: ['', [Validators.required, Validators.minLength(2)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    cityName: ['', [Validators.required, Validators.minLength(2)]],
    stateUf: ['AM' as MilitaryOrganizationStateUf, Validators.required],
    isActive: [true],
  });

  readonly estimates = computed(() => this.organization()?.estimates ?? []);
  readonly heroFacts = computed<MetadataItem[]>(() => [
    { label: 'Código', value: this.organization()?.omCode ? `#${this.organization()?.omCode}` : 'Não informado', highlight: true },
    { label: 'Sigla', value: this.organization()?.sigla || 'Não informado' },
    { label: 'Nome', value: this.organization()?.name || 'Não informado' },
    { label: 'Cidade / UF', value: this.locationLabel() },
  ]);
  readonly summaryCards = computed(() => [
    {
      title: 'Status',
      value: this.isActive(this.organization()) ? 'Ativa' : 'Inativa',
      description: 'Situação cadastral',
      icon: 'ST',
      tone: this.isActive(this.organization()) ? ('success' as const) : ('warning' as const),
    },
    {
      title: 'Estimativas',
      value: String(this.estimates().length),
      description: 'Vínculos retornados',
      icon: 'ES',
      tone: 'soft' as const,
    },
    {
      title: 'UF',
      value: this.organization()?.stateUf || 'N/I',
      description: this.organization()?.cityName || 'Cidade não informada',
      icon: 'UF',
      tone: 'accent' as const,
    },
  ]);

  ngOnInit(): void {
    this.organizationIdentifier = this.route.snapshot.paramMap.get('id');

    if (!this.organizationIdentifier) {
      this.errorMessage.set('Identificador da OM não informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(): void {
    if (!this.organizationIdentifier) return;

    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');
    this.editError.set('');

    this.resolveOrganization(this.organizationIdentifier).subscribe({
      next: (organization) => {
        this.organization.set(organization);
        this.errorMessage.set(organization ? '' : 'OM não encontrada.');
        if (organization) {
          this.patchOrganizationForm(organization);
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'OM não encontrada ou sem permissão de acesso.'));
        this.organization.set(null);
        this.loading.set(false);
      },
    });
  }

  toggleEditForm(): void {
    this.editingOrganization.update((visible) => !visible);
    this.editError.set('');
    this.successMessage.set('');

    if (this.editingOrganization() && this.organization()) {
      this.patchOrganizationForm(this.organization() as MilitaryOrganization);
    }
  }

  updateOrganization(): void {
    const organization = this.organization();

    if (!organization || !this.canManageOrganizations() || this.organizationForm.invalid || this.savingOrganization()) {
      this.organizationForm.markAllAsTouched();
      return;
    }

    this.savingOrganization.set(true);
    this.editError.set('');
    this.successMessage.set('');

    this.organizationsService.update(organization.id, this.organizationPayload()).subscribe({
      next: () => {
        this.successMessage.set('OM atualizada com sucesso.');
        this.savingOrganization.set(false);
        this.editingOrganization.set(false);
        this.reload();
      },
      error: (error) => {
        this.editError.set(getErrorMessage(error, 'Não foi possível atualizar a OM.'));
        this.savingOrganization.set(false);
      },
    });
  }

  deleteOrganization(): void {
    const organization = this.organization();

    if (!organization || !this.canManageOrganizations() || this.deletingOrganization()) return;

    this.deletingOrganization.set(true);
    this.editError.set('');
    this.successMessage.set('');

    this.organizationsService.delete(organization.id).subscribe({
      next: () => {
        this.successMessage.set('OM excluída com sucesso.');
        this.deletingOrganization.set(false);
        this.router.navigate(['/oms']);
      },
      error: (error) => {
        this.editError.set(getErrorMessage(error, 'Não foi possível excluir a OM. Verifique se há vínculos ativos.'));
        this.deletingOrganization.set(false);
      },
    });
  }

  organizationTitle(): string {
    const item = this.organization();
    if (!item) return 'Detalhe da OM';
    return [item.sigla, item.name].filter(Boolean).join(' - ') || 'Detalhe da OM';
  }

  generalFacts(): MetadataItem[] {
    const item = this.organization();
    return [
      { label: 'Código', value: item?.omCode ? `#${item.omCode}` : 'Não informado' },
      { label: 'Sigla', value: item?.sigla || 'Não informado' },
      { label: 'Nome', value: item?.name || 'Não informado' },
      { label: 'Status', value: this.isActive(item) ? 'Ativa' : 'Inativa' },
      { label: 'Criada em', value: formatDate(item?.createdAt) },
      { label: 'Atualizada em', value: formatDate(item?.updatedAt) },
    ];
  }

  locationFacts(): MetadataItem[] {
    const item = this.organization();
    return [
      { label: 'Cidade', value: item?.cityName || 'Não informado', highlight: true },
      { label: 'UF', value: item?.stateUf || 'Não informado' },
      { label: 'Localização', value: this.locationLabel() },
    ];
  }

  estimateFacts(estimate: MilitaryOrganizationEstimateSummary): MetadataItem[] {
    return [
      { label: 'Status', value: estimate.status ? formatLabel(estimate.status) : 'Não informado' },
      { label: 'Projeto', value: estimate.project?.title || this.projectLabel(estimate) },
      { label: 'Valor', value: formatCurrency(estimate.totalAmount), highlight: true },
      { label: 'Criada em', value: formatDate(estimate.createdAt) },
    ];
  }

  locationLabel(): string {
    const item = this.organization();
    return [item?.cityName, item?.stateUf].filter(Boolean).join(' / ') || 'Não informado';
  }

  estimateLabel(estimate: MilitaryOrganizationEstimateSummary): string {
    return estimate.estimateCode ? `EST-${estimate.estimateCode}` : estimate.id;
  }

  projectLabel(estimate: MilitaryOrganizationEstimateSummary): string {
    return estimate.project?.projectCode ? `PRJ-${estimate.project.projectCode}` : 'Projeto não informado';
  }

  isActive(organization: MilitaryOrganization | null): boolean {
    if (!organization) return false;
    return organization.isActive !== false && !['INATIVA', 'INACTIVE'].includes(String(organization.status ?? '').toUpperCase());
  }

  canManageOrganizations(): boolean {
    return this.authService.getUserRole() === 'ADMIN';
  }

  readonly formatDate = formatDate;
  readonly formatCurrency = formatCurrency;
  readonly formatLabel = formatLabel;

  private resolveOrganization(identifier: string) {
    return this.organizationsService.getById(identifier).pipe(
      catchError(() =>
        this.organizationsService.list().pipe(
          catchError(() => of([] as MilitaryOrganization[])),
          map((items) => this.findOrganization(this.listItems(items), identifier)),
        ),
      ),
    );
  }

  private patchOrganizationForm(organization: MilitaryOrganization): void {
    this.organizationForm.reset({
      sigla: organization.sigla ?? '',
      name: organization.name ?? '',
      cityName: organization.cityName ?? '',
      stateUf: this.isStateUf(organization.stateUf) ? organization.stateUf : 'AM',
      isActive: this.isActive(organization),
    });
  }

  private organizationPayload(): MilitaryOrganizationUpdatePayload {
    const value = this.organizationForm.getRawValue();
    return {
      sigla: value.sigla.trim(),
      name: value.name.trim(),
      cityName: value.cityName.trim(),
      stateUf: value.stateUf,
      isActive: value.isActive,
    };
  }

  private isStateUf(value: unknown): value is MilitaryOrganizationStateUf {
    return ['AM', 'RO', 'RR', 'AC'].includes(value as MilitaryOrganizationStateUf);
  }

  private findOrganization(items: MilitaryOrganization[], identifier: string): MilitaryOrganization | null {
    const normalized = identifier.trim().toLowerCase();
    return items.find((item) =>
      [item.id, item.sigla, item.omCode ? String(item.omCode) : '']
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === normalized),
    ) ?? null;
  }

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }
}
