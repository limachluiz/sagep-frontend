import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MetadataGridComponent, MetadataItem } from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage } from '../../shared/utils/http-error.util';
import {
  ComprasGovAtaImportPayload,
  ComprasGovAtaPreview,
  ComprasGovAtaPreviewItem,
  ComprasGovAtaPreviewParams,
  ComprasGovAtaType,
} from './compras-gov.model';
import { ComprasGovService } from './compras-gov.service';

@Component({
  selector: 'app-compras-gov-import-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EmptyStateComponent,
    LoadingStateComponent,
    MetadataGridComponent,
    PageHeaderComponent,
    SectionCardComponent,
  ],
  template: `
    <section class="workspace">
      <app-page-header
        title="Importar ATA Compras.gov.br"
        eyebrow="Integrações"
        subtitle="Consulta a prévia no backend e importa a ATA e seus itens para o catálogo local."
        badge="ADMIN"
        backLabel="Voltar para ATAs"
        backLink="/atas"
      />

      @if (successMessage()) {
        <div class="form-alert success">{{ successMessage() }}</div>
      }

      @if (errorMessage()) {
        <div class="form-alert">{{ errorMessage() }}</div>
      }

      <section class="card">
        <div class="card-body">
          <form [formGroup]="form" class="ata-form" (ngSubmit)="loadPreview()">
            <div class="grid grid-2">
              <label class="field">
                <span>UASG</span>
                <input formControlName="uasg" placeholder="Ex.: 120624" />
              </label>
              <label class="field">
                <span>Número do pregão</span>
                <input formControlName="numeroPregao" placeholder="Ex.: 90001" />
              </label>
              <label class="field">
                <span>Ano do pregão</span>
                <input formControlName="anoPregao" placeholder="Ex.: 2026" maxlength="4" />
              </label>
              <label class="field">
                <span>Número da ATA</span>
                <input formControlName="numeroAta" placeholder="Opcional" />
              </label>
              <label class="field">
                <span>Tipo da ATA</span>
                <select formControlName="ataType">
                  <option value="CFTV">CFTV</option>
                  <option value="FIBRA_OPTICA">Fibra óptica</option>
                </select>
              </label>
              <label class="field">
                <span>Código do grupo padrão</span>
                <input formControlName="coverageGroupCode" placeholder="Ex.: CGOV" />
              </label>
            </div>
            <label class="field">
              <span>Nome do grupo padrão</span>
              <input formControlName="coverageGroupName" placeholder="Ex.: Compras.gov.br" />
            </label>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" (click)="clearPreview()" [disabled]="loadingPreview() || importing()">
                Limpar
              </button>
              <button type="submit" class="btn btn-primary" [disabled]="loadingPreview() || form.invalid">
                {{ loadingPreview() ? 'Consultando...' : 'Consultar' }}
              </button>
              <button type="button" class="btn btn-gold" (click)="importAta()" [disabled]="!preview() || importing()">
                {{ importing() ? 'Importando...' : 'Importar' }}
              </button>
            </div>
          </form>
        </div>
      </section>

      @if (loadingPreview()) {
        <app-loading-state variant="detail" [count]="3" />
      } @else if (preview()) {
        <app-section-card title="Prévia da ATA" subtitle="Dados normalizados retornados pelo backend antes da importação.">
          <app-metadata-grid [items]="ataFacts()" />
        </app-section-card>

        @if (warnings().length) {
          <app-section-card title="Avisos" subtitle="Pontos de atenção retornados na consulta.">
            <div class="document-list">
              @for (warning of warnings(); track warning) {
                <div class="document-item">
                  <b>Aviso</b>
                  <span>{{ warning }}</span>
                </div>
              }
            </div>
          </app-section-card>
        }

        <app-section-card title="Itens encontrados" subtitle="Itens que serão importados ou atualizados no catálogo.">
          <span section-card-actions class="badge b-neutral">{{ previewItems().length }} item(ns)</span>
          @if (previewItems().length) {
            <div class="table-wrap hidden lg:block">
              <table class="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Descrição</th>
                    <th>Unidade</th>
                    <th>Quantidade</th>
                    <th>Valor unit.</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of previewItems(); track item.referenceCode || item.externalItemId || item.externalItemNumber) {
                    <tr>
                      <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.referenceCode || item.externalItemNumber || 'Item' }}</td>
                      <td>{{ item.description || 'Descrição não informada' }}</td>
                      <td>{{ item.unit || 'N/I' }}</td>
                      <td>{{ item.initialQuantity ?? 'Não informado' }}</td>
                      <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(item.unitPrice) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="grid gap-4 lg:hidden">
              @for (item of previewItems(); track item.referenceCode || item.externalItemId || item.externalItemNumber) {
                <article class="estimate-item-card">
                  <div>
                    <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.referenceCode || item.externalItemNumber || 'Item' }}</p>
                    <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.description || 'Descrição não informada' }}</p>
                  </div>
                  <app-metadata-grid [items]="itemFacts(item)" gridClass="sm:grid-cols-2" />
                </article>
              }
            </div>
          } @else {
            <div class="empty"><p>Nenhum item foi retornado na prévia.</p></div>
          }
        </app-section-card>
      } @else {
        <app-empty-state
          title="Informe os dados da compra para consultar a prévia"
          description="A consulta ao Compras.gov.br será feita pelo backend do SAGEP."
        />
      }
    </section>
  `,
})
export class ComprasGovImportPageComponent {
  private readonly service = inject(ComprasGovService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly loadingPreview = signal(false);
  readonly importing = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly preview = signal<ComprasGovAtaPreview | null>(null);

  readonly form = this.fb.nonNullable.group({
    uasg: ['', Validators.required],
    numeroPregao: ['', Validators.required],
    anoPregao: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    numeroAta: [''],
    ataType: ['CFTV' as ComprasGovAtaType, Validators.required],
    coverageGroupCode: ['CGOV'],
    coverageGroupName: ['Compras.gov.br'],
  });

  readonly previewItems = computed(() => this.preview()?.items ?? []);
  readonly warnings = computed(() => this.preview()?.warnings ?? []);
  readonly ataFacts = computed<MetadataItem[]>(() => {
    const preview = this.preview();
    const ata = preview?.ata;

    return [
      { label: 'Fonte', value: preview?.source || 'COMPRAS_GOV' },
      { label: 'UASG', value: preview?.uasg || this.form.controls.uasg.value || 'Não informado' },
      { label: 'Pregão', value: this.biddingLabel(preview) },
      { label: 'ATA', value: ata?.number || this.form.controls.numeroAta.value || 'Não informado', highlight: true },
      { label: 'Tipo', value: ata?.type ? formatLabel(ata.type) : formatLabel(this.form.controls.ataType.value) },
      { label: 'Fornecedor', value: ata?.vendorName || 'Fornecedor não informado' },
      { label: 'Órgão gerenciador', value: ata?.managingAgency || 'Não informado' },
      { label: 'Vigência', value: this.dateRange(ata?.validFrom, ata?.validUntil) },
      { label: 'Itens', value: String(this.previewItems().length) },
    ];
  });

  loadPreview(): void {
    if (this.form.invalid || this.loadingPreview()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loadingPreview.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.preview.set(null);

    this.service.previewAta(this.previewParams()).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.successMessage.set('Prévia carregada com sucesso.');
        this.loadingPreview.set(false);
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'Não foi possível consultar a prévia no backend.'));
        this.loadingPreview.set(false);
      },
    });
  }

  importAta(): void {
    if (!this.preview() || this.form.invalid || this.importing()) {
      this.form.markAllAsTouched();
      return;
    }

    this.importing.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.service.importAta(this.importPayload()).subscribe({
      next: (response) => {
        const ataId = response.imported?.ataId;
        this.successMessage.set('ATA importada com sucesso.');
        this.importing.set(false);

        if (ataId) {
          this.router.navigate(['/atas', ataId]);
        }
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'Não foi possível importar a ATA.'));
        this.importing.set(false);
      },
    });
  }

  clearPreview(): void {
    this.preview.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.form.reset({
      uasg: '',
      numeroPregao: '',
      anoPregao: '',
      numeroAta: '',
      ataType: 'CFTV',
      coverageGroupCode: 'CGOV',
      coverageGroupName: 'Compras.gov.br',
    });
  }

  itemFacts(item: ComprasGovAtaPreviewItem): MetadataItem[] {
    return [
      { label: 'Unidade', value: item.unit || 'N/I' },
      { label: 'Quantidade', value: item.initialQuantity ?? 'Não informado' },
      { label: 'Valor unitário', value: formatCurrency(item.unitPrice), highlight: true },
      { label: 'Código externo', value: item.externalItemId || item.externalItemNumber || 'Não informado' },
    ];
  }

  readonly formatCurrency = formatCurrency;

  private previewParams(): ComprasGovAtaPreviewParams {
    const value = this.form.getRawValue();
    return {
      uasg: value.uasg.trim(),
      numeroPregao: value.numeroPregao.trim(),
      anoPregao: value.anoPregao.trim(),
      numeroAta: value.numeroAta.trim() || undefined,
    };
  }

  private importPayload(): ComprasGovAtaImportPayload {
    const value = this.form.getRawValue();
    return {
      ...this.previewParams(),
      ataType: value.ataType,
      coverageGroupCode: value.coverageGroupCode.trim() || undefined,
      coverageGroupName: value.coverageGroupName.trim() || undefined,
    };
  }

  private biddingLabel(preview: ComprasGovAtaPreview | null): string {
    const numeroPregao = preview?.numeroPregao || this.form.controls.numeroPregao.value;
    const anoPregao = preview?.anoPregao || this.form.controls.anoPregao.value;
    return [numeroPregao, anoPregao].filter(Boolean).join('/') || 'Não informado';
  }

  private dateRange(start: string | null | undefined, end: string | null | undefined): string {
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);

    if (formattedStart === 'Não informado' && formattedEnd === 'Não informado') {
      return 'Não informado';
    }

    return `${formattedStart} até ${formattedEnd}`;
  }
}
