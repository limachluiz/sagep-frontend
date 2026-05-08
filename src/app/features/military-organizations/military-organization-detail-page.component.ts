import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

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
import { MilitaryOrganization, MilitaryOrganizationEstimateSummary } from './military-organization.model';
import { MilitaryOrganizationsFeatureService } from './military-organizations.service';

@Component({
  selector: 'app-military-organization-detail-page',
  standalone: true,
  imports: [
    CommonModule,
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
    />

    <div class="workspace">
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
  private readonly organizationsService = inject(MilitaryOrganizationsFeatureService);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly organization = signal<MilitaryOrganization | null>(null);
  private organizationIdentifier: string | null = null;

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

    this.organizationsService.list().subscribe({
      next: (response) => {
        const organization = this.findOrganization(this.listItems(response), this.organizationIdentifier as string);
        this.organization.set(organization);
        this.errorMessage.set(organization ? '' : 'OM não encontrada.');
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

  readonly formatDate = formatDate;
  readonly formatCurrency = formatCurrency;
  readonly formatLabel = formatLabel;

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
