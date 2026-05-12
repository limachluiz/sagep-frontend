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
  ComprasGovAtaFound,
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
        eyebrow="Integracoes"
        subtitle="Consulta a previa no backend e importa a ATA e seus itens para o catalogo local."
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
                <span>Numero do pregao</span>
                <input formControlName="numeroPregao" placeholder="Ex.: 90001" />
              </label>
              <label class="field">
                <span>Ano do pregao</span>
                <input formControlName="anoPregao" placeholder="Ex.: 2026" maxlength="4" />
              </label>
              <label class="field">
                <span>Numero da ATA</span>
                <input formControlName="numeroAta" placeholder="Opcional" />
              </label>
              <label class="field">
                <span>Tipo da ATA</span>
                <select formControlName="ataType">
                  <option value="CFTV">CFTV</option>
                  <option value="FIBRA_OPTICA">Fibra optica</option>
                </select>
              </label>
              <label class="field">
                <span>Codigo do grupo padrao</span>
                <input formControlName="coverageGroupCode" placeholder="Ex.: CGOV" />
              </label>
            </div>
            <label class="field">
              <span>Nome do grupo padrao</span>
              <input formControlName="coverageGroupName" placeholder="Ex.: Compras.gov.br" />
            </label>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" (click)="clearPreview()" [disabled]="loadingPreview() || importing()">
                Limpar
              </button>
              <button type="submit" class="btn btn-primary" [disabled]="loadingPreview() || form.invalid">
                {{ loadingPreview() ? 'Consultando...' : 'Consultar' }}
              </button>
              <button type="button" class="btn btn-gold" (click)="importAta()" [disabled]="!canImport() || importing()">
                {{ importing() ? 'Importando...' : 'Importar' }}
              </button>
            </div>
          </form>
        </div>
      </section>

      @if (loadingPreview()) {
        <app-loading-state variant="detail" [count]="3" />
      } @else if (preview()) {
        <app-section-card title="Previa da ATA" subtitle="Dados normalizados retornados pelo backend antes da importacao.">
          <app-metadata-grid [items]="ataFacts()" />
        </app-section-card>

        @if (warnings().length) {
          <app-section-card title="Avisos" subtitle="Pontos de atencao retornados na consulta.">
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

        @if (hasMultipleAtasFound()) {
          <app-section-card title="ATAs encontradas" subtitle="Selecione a ATA correta para carregar a previa dos itens.">
            <span section-card-actions class="badge b-neutral">{{ atasFound().length }} ATA(s)</span>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>ATA</th>
                    <th>Fornecedor</th>
                    <th>Itens</th>
                    <th>Valor</th>
                    <th>Acao</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ata of atasFound(); track ata.ataNumber || $index) {
                    <tr>
                      <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ ata.ataNumber || 'Nao informado' }}</td>
                      <td>{{ ataFornecedor(ata) }}</td>
                      <td>{{ ataItens(ata) }}</td>
                      <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(ataValor(ata)) }}</td>
                      <td>
                        <button
                          type="button"
                          class="btn btn-sm btn-gold"
                          (click)="selectAta(ata)"
                          [disabled]="loadingPreview() || importing() || !ata.ataNumber"
                        >
                          Selecionar
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </app-section-card>
        }

        @if (canShowItems()) {
          <app-section-card title="Itens encontrados" subtitle="Itens que serao importados ou atualizados no catalogo.">
            <span section-card-actions class="badge b-neutral">{{ previewItems().length }} item(ns)</span>
            @if (previewItems().length) {
              <div class="table-wrap hidden lg:block">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Descricao</th>
                      <th>Unidade</th>
                      <th>Quantidade</th>
                      <th>Valor unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of previewItems(); track item.referenceCode || item.externalItemId || item.externalItemNumber) {
                      <tr>
                        <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.referenceCode || item.externalItemNumber || 'Item' }}</td>
                        <td>{{ item.description || 'Descricao nao informada' }}</td>
                        <td>{{ item.unit || 'N/I' }}</td>
                        <td>{{ item.initialQuantity ?? 'Nao informado' }}</td>
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
                      <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.description || 'Descricao nao informada' }}</p>
                    </div>
                    <app-metadata-grid [items]="itemFacts(item)" gridClass="sm:grid-cols-2" />
                  </article>
                }
              </div>
            } @else {
              <div class="empty"><p>Nenhum item foi retornado na previa.</p></div>
            }
          </app-section-card>
        }
      } @else {
        <app-empty-state
          title="Informe os dados da compra para consultar a previa"
          description="A consulta ao Compras.gov.br sera feita pelo backend do SAGEP."
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
  readonly selectedAtaNumber = signal('');

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
  readonly atasFound = computed(() => this.preview()?.atasFound ?? []);
  readonly hasMultipleAtasFound = computed(() => this.atasFound().length > 1);
  readonly canShowItems = computed(() => !this.hasMultipleAtasFound() || !!this.selectedAtaNumber());
  readonly canImport = computed(() => !!this.preview() && this.canShowItems());
  readonly warnings = computed(() => this.preview()?.warnings ?? []);
  readonly ataFacts = computed<MetadataItem[]>(() => {
    const preview = this.preview();
    const ata = preview?.ata;

    return [
      { label: 'Fonte', value: preview?.source || 'COMPRAS_GOV' },
      { label: 'UASG', value: preview?.uasg || this.form.controls.uasg.value || 'Nao informado' },
      { label: 'Pregao', value: this.biddingLabel(preview) },
      { label: 'ATA', value: ata?.number || this.form.controls.numeroAta.value || 'Nao informado', highlight: true },
      { label: 'Tipo', value: ata?.type ? formatLabel(ata.type) : formatLabel(this.form.controls.ataType.value) },
      { label: 'Fornecedor', value: ata?.vendorName || 'Fornecedor nao informado' },
      { label: 'Orgao gerenciador', value: ata?.managingAgency || 'Nao informado' },
      { label: 'Vigencia', value: this.dateRange(ata?.validFrom, ata?.validUntil) },
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
    this.selectedAtaNumber.set(this.form.controls.numeroAta.value.trim());

    this.service.previewAta(this.previewParams()).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.successMessage.set('Previa carregada com sucesso.');
        this.loadingPreview.set(false);
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'Nao foi possivel consultar a previa no backend.'));
        this.loadingPreview.set(false);
      },
    });
  }

  importAta(): void {
    if (!this.canImport() || this.form.invalid || this.importing()) {
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
        this.errorMessage.set(getErrorMessage(error, 'Nao foi possivel importar a ATA.'));
        this.importing.set(false);
      },
    });
  }

  clearPreview(): void {
    this.preview.set(null);
    this.selectedAtaNumber.set('');
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

  selectAta(ata: ComprasGovAtaFound): void {
    const ataNumber = ata.ataNumber?.trim();

    if (!ataNumber) {
      return;
    }

    this.form.controls.numeroAta.setValue(ataNumber);
    this.selectedAtaNumber.set(ataNumber);
    this.loadPreview();
  }

  itemFacts(item: ComprasGovAtaPreviewItem): MetadataItem[] {
    return [
      { label: 'Unidade', value: item.unit || 'N/I' },
      { label: 'Quantidade', value: item.initialQuantity ?? 'Nao informado' },
      { label: 'Valor unitario', value: formatCurrency(item.unitPrice), highlight: true },
      { label: 'Codigo externo', value: item.externalItemId || item.externalItemNumber || 'Nao informado' },
    ];
  }

  ataFornecedor(ata: ComprasGovAtaFound): string {
    return ata.fornecedor || ata.vendorName || 'Fornecedor nao informado';
  }

  ataItens(ata: ComprasGovAtaFound): string {
    const items = ata.itens ?? ata.items;

    if (Array.isArray(items)) {
      return String(items.length);
    }

    return items == null || items === '' ? 'Nao informado' : String(items);
  }

  ataValor(ata: ComprasGovAtaFound): number | string | null | undefined {
    return ata.valor ?? ata.totalValue;
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
    return [numeroPregao, anoPregao].filter(Boolean).join('/') || 'Nao informado';
  }

  private dateRange(start: string | null | undefined, end: string | null | undefined): string {
    if (!start && !end) {
      return 'Nao informado';
    }

    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);

    return `${formattedStart} ate ${formattedEnd}`;
  }
}
