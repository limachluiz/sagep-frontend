import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MetadataGridComponent, MetadataItem } from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { EmptyValuePipe } from '../../shared/pipes/empty-value.pipe';
import { buildEstimateIdentifier, buildProjectIdentifier, formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { Diex, DiexItem } from './diex.model';
import { DiexService } from './diex.service';

@Component({
  selector: 'app-diex-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    EmptyValuePipe,
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
      [title]="diex()?.diexNumber || 'Detalhe do DIEx requisitório'"
      [eyebrow]="diexDisplayCode()"
      subtitle="Detalhe do DIEx com contexto do projeto, estimativa vinculada, dados documentais, itens e acesso ao documento."
      badge="Documento"
      backLabel="Voltar para DIEx"
      backLink="/diex"
    >
      <button page-header-actions type="button" (click)="openHtmlDocument()" class="btn btn-ghost">
        Visualizar documento
      </button>
      <button page-header-actions type="button" (click)="openPdfDocument()" class="btn btn-gold">
        Abrir PDF
      </button>
    </app-page-header>

    <div class="workspace">
      @if (documentError()) {
        <div class="form-alert">{{ documentError() }}</div>
      }

      @if (loading()) {
        <div class="card">
          <div class="card-body">
            <app-loading-state variant="detail" [count]="3" />
          </div>
        </div>
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite abrir este DIEx."
          description="O backend bloqueou a visualização detalhada deste documento. Você pode voltar para a listagem ou seguir para outro módulo disponível."
          primaryLink="/diex"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar o detalhe do DIEx"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="reload()"
        />
      } @else if (!diex()) {
        <app-empty-state
          eyebrow="Sem dados"
          title="O backend não retornou conteúdo para este DIEx"
          description="Verifique se o registro ainda existe ou retorne para a listagem."
        />
      } @else {
        <section class="card">
          <div class="card-body">
            <div class="detail-grid">
              @for (item of heroFacts(); track item.label) {
                <div class="detail-item">
                  <label>{{ item.label }}</label>
                  <b>{{ item.value }}</b>
                </div>
              }
            </div>
          </div>
        </section>

        <div class="grid grid-5">
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
          <app-section-card title="Projeto vinculado" subtitle="Contexto principal do projeto associado ao DIEx.">
            <div class="next-action-card">
              <span class="badge b-info">{{ projectDisplayCode() }}</span>
              <h3>{{ diex()?.project?.title | emptyValue:'Projeto não informado' }}</h3>
              <p>Fase: {{ formatLabel(diex()?.project?.stage || '') }} · Status: {{ formatLabel(diex()?.project?.status || '') }}</p>
            </div>
            <app-metadata-grid [items]="projectFacts()" />
            @if (diex()?.project?.id) {
              <a [routerLink]="['/projects', projectDisplayCode()]">Ver projeto</a>
            }
          </app-section-card>

          <app-section-card title="Estimativa vinculada" subtitle="Origem do DIEx e total associado à estimativa.">
            <div class="next-action-card">
              <span class="badge b-neutral">{{ estimateDisplayCode() }}</span>
              <h3>{{ diex()?.estimate?.ata?.number | emptyValue:'Estimativa vinculada' }}</h3>
              <p>{{ locationLabel() }} · {{ diex()?.estimate?.om?.sigla || diex()?.estimate?.omName || 'OM não informada' }}</p>
            </div>
            <app-metadata-grid [items]="estimateFacts()" />
            @if (diex()?.estimate?.id) {
              <a [routerLink]="['/estimates', estimateDisplayCode()]">Ver estimativa</a>
            }
          </app-section-card>
        </div>

        <div class="grid grid-2 project-main-grid">
          <app-section-card title="Dados do fornecedor" subtitle="Informações do fornecedor e origem da contratação.">
            <app-metadata-grid [items]="supplierFacts()" />
          </app-section-card>

          <app-section-card title="Dados do requisitante" subtitle="Responsável e dados institucionais informados na emissão.">
            <app-metadata-grid [items]="requesterFacts()" />
          </app-section-card>
        </div>

        <app-section-card title="Dados documentais" subtitle="Identificação do DIEx, datas e observações do documento.">
          <app-metadata-grid [items]="documentFacts()" />
          <div class="document-group">
            <div class="document-group-head">
              <b>Observações</b>
            </div>
            <p>{{ diex()?.notes | emptyValue:'Sem observações registradas neste DIEx.' }}</p>
          </div>
        </app-section-card>

        <app-section-card title="Itens do DIEx" subtitle="Itens reservados, quantidades e valores do documento.">
          <span section-card-actions class="badge b-neutral">{{ (diex()?.items ?? []).length }} item(ns)</span>
          @if ((diex()?.items ?? []).length) {
            <div class="table-wrap hidden lg:block">
              <table class="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qtd.</th>
                    <th>Unidade</th>
                    <th>Valor unit.</th>
                    <th>Total</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of diex()?.items ?? []; track item.id) {
                    <tr>
                      <td>
                        <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.itemCode || item.diexItemCode }} - {{ item.description }}</p>
                        <p class="mt-1 text-sm text-[var(--sagep-muted)]">Estimativa item: {{ item.estimateItem?.estimateItemCode || 'Não informado' }}</p>
                      </td>
                      <td>{{ item.quantityRequested || '0' }}</td>
                      <td>{{ item.supplyUnit | emptyValue:'N/I' }}</td>
                      <td>{{ formatCurrency(item.unitPrice) }}</td>
                      <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(item.totalPrice) }}</td>
                      <td>{{ item.notes | emptyValue:'Sem observações' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="grid gap-4 lg:hidden">
              @for (item of diex()?.items ?? []; track item.id) {
                <article class="card">
                  <div class="card-body">
                    <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.itemCode || item.diexItemCode }} - {{ item.description }}</p>
                    <app-metadata-grid [items]="itemFacts(item)" gridClass="sm:grid-cols-2" />
                    <p class="text-sm text-[var(--sagep-muted)]">{{ item.notes | emptyValue:'Sem observações para esta linha.' }}</p>
                  </div>
                </article>
              }
            </div>
          } @else {
            <div class="empty"><p>Nenhum item foi encontrado para este DIEx.</p></div>
          }
        </app-section-card>
      }
    </div>
  `,
})
export class DiexDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly diexService = inject(DiexService);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly documentError = signal('');
  readonly diex = signal<Diex | null>(null);
  private diexIdentifierRoute: string | null = null;

  readonly diexDisplayCode = computed(() => {
    const item = this.diex();
    if (!item) return 'DIEx';
    return this.buildDiexIdentifier(item);
  });

  readonly projectDisplayCode = computed(() => {
    const project = this.diex()?.project;
    if (!project?.id) return 'Projeto';
    return buildProjectIdentifier(project.projectCode ?? null, project.id, this.diex()?.createdAt);
  });

  readonly estimateDisplayCode = computed(() => {
    const estimate = this.diex()?.estimate;
    if (!estimate?.id) return 'Estimativa';
    return buildEstimateIdentifier(estimate.estimateCode ?? null, estimate.id, this.diex()?.createdAt);
  });

  readonly heroFacts = computed<MetadataItem[]>(() => [
    { label: 'Número do DIEx', value: this.diex()?.diexNumber || 'Não informado', highlight: true },
    { label: 'Emitido em', value: formatDate(this.diex()?.issuedAt) },
    { label: 'Projeto', value: this.projectDisplayCode() },
    { label: 'Estimativa', value: this.estimateDisplayCode() },
  ]);

  readonly summaryCards = computed(() => {
    const item = this.diex();
    return [
      {
        title: 'Valor total',
        value: formatCurrency(this.totalAmount()),
        description: 'Total do documento',
        icon: 'R$',
        tone: 'accent' as const,
      },
      {
        title: 'Itens',
        value: String((item?.items ?? []).length),
        description: 'Linhas do DIEx',
        icon: '#',
        tone: 'soft' as const,
      },
      {
        title: 'Projeto',
        value: item?.projectCode ? `PRJ-${item.projectCode}` : 'N/I',
        description: item?.project?.title || 'Projeto vinculado',
        icon: 'PRJ',
        tone: 'success' as const,
      },
      {
        title: 'Estimativa',
        value: item?.estimateCode ? `EST-${item.estimateCode}` : 'N/I',
        description: item?.estimate?.status ? formatLabel(item?.estimate?.status || '') : 'Estimativa vinculada',
        icon: 'EST',
        tone: 'warning' as const,
      },
      {
        title: 'Fornecedor',
        value: item?.estimate?.ata?.vendorName || item?.supplierCnpj || 'N/I',
        description: 'Origem contratual',
        icon: 'CNPJ',
        tone: 'default' as const,
      },
    ];
  });

  ngOnInit(): void {
    this.diexIdentifierRoute = this.route.snapshot.paramMap.get('id');

    if (!this.diexIdentifierRoute) {
      this.errorMessage.set('Identificador do DIEx não informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(): void {
    if (!this.diexIdentifierRoute) return;

    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const routeIdentifier = this.diexIdentifierRoute;
    const codeCandidate = this.extractDiexCode(routeIdentifier);
    const shouldTryCodeLookup = routeIdentifier !== codeCandidate || /^\d+$/.test(routeIdentifier.trim());

    const request$ = shouldTryCodeLookup
      ? this.diexService.getByCode(codeCandidate).pipe(
          catchError(() => this.diexService.getById(routeIdentifier)),
        )
      : this.diexService.getById(routeIdentifier).pipe(
          catchError((originalError) =>
            this.diexService.getByCode(codeCandidate).pipe(
              catchError(() => throwError(() => originalError)),
            ),
          ),
        );

    request$.subscribe({
      next: (response) => {
        this.diex.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'DIEx não encontrado ou sem permissão de acesso.'));
        this.diex.set(null);
        this.loading.set(false);
      },
    });
  }

  openHtmlDocument(): void {
    const id = this.diex()?.id;
    if (!id) return;

    this.documentError.set('');
    this.diexService.getDocumentHtml(id).subscribe({
      next: (html) => this.openBlobWindow(new Blob([html], { type: 'text/html' })),
      error: (error) => {
        this.documentError.set(getErrorMessage(error, 'Não foi possível abrir o HTML do DIEx.'));
      },
    });
  }

  openPdfDocument(): void {
    const id = this.diex()?.id;
    if (!id) return;

    this.documentError.set('');
    this.diexService.getDocumentPdf(id).subscribe({
      next: (blob) => this.openBlobWindow(new Blob([blob], { type: 'application/pdf' })),
      error: (error) => {
        this.documentError.set(getErrorMessage(error, 'Não foi possível abrir o PDF do DIEx.'));
      },
    });
  }

  projectFacts(): MetadataItem[] {
    const project = this.diex()?.project;
    return [
      { label: 'Código interno', value: project?.projectCode ? `#${project.projectCode}` : 'Não informado' },
      { label: 'Título', value: project?.title || 'Não informado' },
      { label: 'Fase', value: formatLabel(project?.stage || '') },
      { label: 'Status', value: formatLabel(project?.status || '') },
    ];
  }

  estimateFacts(): MetadataItem[] {
    const estimate = this.diex()?.estimate;
    return [
      { label: 'Código da estimativa', value: estimate?.estimateCode ? `#${estimate.estimateCode}` : 'Não informado' },
      { label: 'Status', value: estimate?.status ? formatLabel(estimate.status) : 'Não informado' },
      { label: 'OM', value: estimate?.om?.sigla || estimate?.omName || 'Não informado' },
      { label: 'Cidade / UF', value: this.locationLabel() },
      { label: 'ATA', value: estimate?.ata?.number || 'Não informado' },
      { label: 'Valor da estimativa', value: formatCurrency(estimate?.totalAmount) },
    ];
  }

  supplierFacts(): MetadataItem[] {
    const estimate = this.diex()?.estimate;
    return [
      { label: 'Fornecedor', value: estimate?.ata?.vendorName || 'Não informado' },
      { label: 'CNPJ', value: this.diex()?.supplierCnpj || 'Não informado' },
      { label: 'Pregão', value: this.diex()?.pregaoNumber || 'Não informado' },
      { label: 'UASG', value: this.diex()?.uasg || 'Não informado' },
      { label: 'Comando', value: this.diex()?.commandName || 'Não informado' },
      { label: 'Organização emissora', value: this.diex()?.issuingOrganization || 'Não informado' },
    ];
  }

  requesterFacts(): MetadataItem[] {
    return [
      { label: 'Nome', value: this.diex()?.requesterName || 'Não informado' },
      { label: 'Posto/graduação', value: this.diex()?.requesterRank || 'Não informado' },
      { label: 'CPF', value: this.diex()?.requesterCpf || 'Não informado' },
      { label: 'Função', value: this.diex()?.requesterRole || 'Não informado' },
    ];
  }

  documentFacts(): MetadataItem[] {
    return [
      { label: 'Código interno', value: this.diex()?.diexCode ? `#${this.diex()?.diexCode}` : 'Não informado' },
      { label: 'Número do DIEx', value: this.diex()?.diexNumber || 'Não informado' },
      { label: 'Emitido em', value: formatDate(this.diex()?.issuedAt) },
      { label: 'Criado em', value: formatDate(this.diex()?.createdAt) },
      { label: 'Atualizado em', value: formatDate(this.diex()?.updatedAt) },
      { label: 'Valor total', value: formatCurrency(this.totalAmount()) },
    ];
  }

  itemFacts(item: DiexItem): MetadataItem[] {
    return [
      { label: 'Quantidade', value: String(item.quantityRequested || '0') },
      { label: 'Unidade', value: item.supplyUnit || 'N/I' },
      { label: 'Valor unitário', value: formatCurrency(item.unitPrice) },
      { label: 'Valor total', value: formatCurrency(item.totalPrice) },
    ];
  }

  locationLabel(): string {
    const estimate = this.diex()?.estimate;
    const city = estimate?.om?.cityName || estimate?.destinationCityName;
    const state = estimate?.om?.stateUf || estimate?.destinationStateUf;
    return [city, state].filter(Boolean).join(' / ') || 'Não informado';
  }

  totalAmount(): unknown {
    const explicit = this.diex()?.totalAmount ?? this.diex()?.estimate?.totalAmount;
    if (explicit !== undefined && explicit !== null) return explicit;
    return (this.diex()?.items ?? []).reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  }

  readonly formatDate = formatDate;
  readonly formatCurrency = formatCurrency;
  readonly formatLabel = formatLabel;

  private buildDiexIdentifier(item: Diex): string {
    const year = this.yearFromDate(item.createdAt || item.issuedAt);
    if (year && Number.isFinite(Number(item.diexCode))) {
      return `DIEX-${year}-${String(item.diexCode).padStart(4, '0')}`;
    }
    return item.id;
  }

  private extractDiexCode(identifier: string): string {
    const trimmed = identifier.trim();
    const match = trimmed.match(/(\d+)$/);
    return match ? String(Number(match[1])) : trimmed;
  }

  private yearFromDate(value: unknown): number | null {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.getFullYear();
  }

  private openBlobWindow(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
