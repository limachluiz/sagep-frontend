import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
import { EmptyValuePipe } from '../../shared/pipes/empty-value.pipe';
import { formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import {
  Ata,
  AtaCoverageGroup,
  AtaCoverageGroupPayload,
  AtaCoverageGroupUpdatePayload,
  AtaCoverageLocalityPayload,
  AtaCoverageStateUf,
  AtaItem,
  AtaItemPayload,
  AtaItemUpdatePayload,
  AtaPayload,
} from './ata.model';
import { AtasService } from './atas.service';

@Component({
  selector: 'app-ata-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
      [title]="ataLabel(ata())"
      eyebrow="ATA"
      subtitle="Detalhe da ata com fornecedor, vigência, grupos de cobertura e itens disponíveis para estimativas."
      badge="Catálogo operacional"
      backLabel="Voltar para ATAs"
      backLink="/atas"
    >
      @if (canManageAtas() && ata()) {
        <button page-header-actions type="button" class="btn btn-gold" (click)="toggleEditForm()">
          {{ editingAta() ? 'Fechar' : 'Editar' }}
        </button>
      }
    </app-page-header>

    <div class="workspace">
      @if (itemsError()) {
        <div class="form-alert">{{ itemsError() }}</div>
      }

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
          title="Seu acesso atual não permite abrir esta ATA."
          description="A consulta ao detalhe foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/atas"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar o detalhe da ATA"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="reload()"
        />
      } @else if (!ata()) {
        <app-empty-state
          eyebrow="Sem dados"
          title="Nenhuma ATA foi encontrada"
          description="Retorne para a listagem e selecione outro registro."
        />
      } @else {
        @if (editingAta()) {
          <section class="card">
            <div class="card-body">
              <form [formGroup]="ataForm" class="ata-form" (ngSubmit)="updateAta()">
                <div class="grid grid-2">
                  <label class="field">
                    <span>Número da ATA</span>
                    <input formControlName="number" />
                  </label>
                  <label class="field">
                    <span>Tipo</span>
                    <select formControlName="type">
                      <option value="CFTV">CFTV</option>
                      <option value="FIBRA_OPTICA">Fibra Óptica</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Fornecedor</span>
                    <input formControlName="vendorName" />
                  </label>
                  <label class="field">
                    <span>Orgão gerenciador</span>
                    <input formControlName="managingAgency" />
                  </label>
                  <label class="field">
                    <span>Vigência início</span>
                    <input type="date" formControlName="startDate" />
                  </label>
                  <label class="field">
                    <span>Vigência fim</span>
                    <input type="date" formControlName="endDate" />
                  </label>
                </div>
                <label class="field">
                  <span>Observações</span>
                  <textarea formControlName="observations" rows="3"></textarea>
                </label>
                <label class="field-checkbox">
                  <input type="checkbox" formControlName="isActive" />
                  <span>ATA ativa</span>
                </label>
                <div class="form-actions">
                  <button type="button" class="btn btn-ghost" (click)="toggleEditForm()">Cancelar</button>
                  <button type="submit" class="btn btn-primary" [disabled]="savingAta() || ataForm.invalid">
                    {{ savingAta() ? 'Salvando...' : 'Salvar alteraÃ§Ãµes' }}
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

        <div class="grid grid-4">
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
          <app-section-card title="Dados da ATA" subtitle="Identificação, tipo, status e datas principais.">
            <app-metadata-grid [items]="ataFacts()" />
          </app-section-card>

          <app-section-card title="Fornecedor e vigência" subtitle="Fornecedor vinculado e período de validade.">
            <div class="next-action-card">
              <span class="badge" [class]="isActive(ata()) ? 'b-ok' : 'b-warn'">{{ isActive(ata()) ? 'Ativa' : 'Inativa' }}</span>
              <h3>{{ ata()?.vendorName | emptyValue:'Fornecedor não informado' }}</h3>
              <p>{{ dateRange(ata()?.validFrom || ata()?.startDate, ata()?.validUntil || ata()?.endDate) }}</p>
            </div>
            <app-metadata-grid [items]="vendorFacts()" />
          </app-section-card>
        </div>

        <app-section-card title="Grupos de cobertura" subtitle="Áreas ou grupos atendidos por esta ATA.">
          <div section-card-actions class="coverage-actions">
            <span class="badge b-neutral">{{ coverageGroups().length }} grupo(s)</span>
            @if (canManageAtas()) {
              <button type="button" class="btn btn-sm btn-gold" (click)="openCoverageGroupForm()">
                Novo grupo
              </button>
            }
          </div>

          @if (coverageGroupFormVisible()) {
            <form [formGroup]="coverageGroupForm" class="coverage-group-form" (ngSubmit)="saveCoverageGroup()">
              <div class="grid grid-2">
                <label class="field">
                  <span>Nome do grupo</span>
                  <input formControlName="name" placeholder="Ex.: Manaus e entorno" />
                </label>
                <label class="field">
                  <span>UF</span>
                  <select formControlName="stateUf">
                    @for (uf of coverageStates; track uf) {
                      <option [value]="uf">{{ uf }}</option>
                    }
                  </select>
                </label>
              </div>
              <label class="field">
                <span>Cidades/localidades</span>
                <textarea formControlName="localitiesText" rows="3" placeholder="Uma cidade por linha"></textarea>
              </label>
              <div class="form-actions">
                <button type="button" class="btn btn-ghost" (click)="closeCoverageGroupForm()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="savingCoverageGroup() || coverageGroupForm.invalid">
                  {{ savingCoverageGroup() ? 'Salvando...' : editingCoverageGroupId() ? 'Salvar grupo' : 'Criar grupo' }}
                </button>
              </div>
            </form>
          }

          @if (coverageGroups().length) {
            <div class="document-list">
              @for (group of coverageGroups(); track group.id) {
                <div class="document-item">
                  <div class="coverage-group-head">
                    <div>
                      <b>{{ coverageGroupLabel(group) }}</b>
                      <span>{{ coverageGroupLocalitiesLabel(group) }}</span>
                    </div>
                    @if (canManageAtas()) {
                      <div class="coverage-group-actions">
                        <button type="button" class="btn btn-sm btn-ghost" (click)="openCoverageGroupForm(group)">
                          Editar
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-ghost danger-action"
                          [disabled]="deletingCoverageGroupId() === group.id"
                          (click)="deleteCoverageGroup(group)"
                        >
                          {{ deletingCoverageGroupId() === group.id ? 'Excluindo...' : 'Excluir' }}
                        </button>
                      </div>
                    }
                  </div>
                  @if (group.description) {
                    <span>{{ group.description }}</span>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="empty"><p>Nenhum grupo de cobertura foi encontrado para esta ATA.</p></div>
          }
        </app-section-card>

        <app-section-card title="Itens da ATA" subtitle="Itens precificados, saldo e grupo de cobertura.">
          <div section-card-actions class="coverage-actions">
            <span class="badge b-neutral">{{ ataItems().length }} item(ns)</span>
            @if (canManageAtas()) {
              <button type="button" class="btn btn-sm btn-gold" (click)="openAtaItemForm()">
                Novo item
              </button>
            }
          </div>

          @if (ataItemFormVisible()) {
            <form [formGroup]="ataItemForm" class="coverage-group-form ata-item-form" (ngSubmit)="saveAtaItem()">
              <div class="grid grid-2">
                <label class="field">
                  <span>Código do item</span>
                  <input formControlName="referenceCode" placeholder="Ex.: CAM-001" />
                </label>
                <label class="field">
                  <span>Grupo de cobertura</span>
                  <select formControlName="coverageGroupCode">
                    <option value="">Selecione</option>
                    @for (group of coverageGroups(); track group.id) {
                      <option [value]="group.code || group.id">{{ coverageGroupLabel(group) }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span>Unidade</span>
                  <input formControlName="unit" placeholder="Ex.: UN" />
                </label>
                <label class="field">
                  <span>Valor unitário</span>
                  <input type="number" min="0.01" step="0.01" formControlName="unitPrice" />
                </label>
                <label class="field">
                  <span>Quantidade inicial</span>
                  <input type="number" min="0.01" step="0.01" formControlName="initialQuantity" />
                </label>
                @if (editingAtaItemId()) {
                  <label class="field-checkbox">
                    <input type="checkbox" formControlName="isActive" />
                    <span>Item ativo</span>
                  </label>
                }
              </div>
              <label class="field">
                <span>Descrição</span>
                <textarea formControlName="description" rows="3"></textarea>
              </label>
              <div class="form-actions">
                <button type="button" class="btn btn-ghost" (click)="closeAtaItemForm()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="savingAtaItem() || ataItemForm.invalid">
                  {{ savingAtaItem() ? 'Salvando...' : editingAtaItemId() ? 'Salvar item' : 'Criar item' }}
                </button>
              </div>
            </form>
          }

          @if (ataItems().length) {
            <div class="table-wrap hidden lg:block">
              <table class="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Unidade</th>
                    <th>Valor unit.</th>
                    <th>Qtd. inicial</th>
                    <th>Disponível</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of ataItems(); track item.id) {
                    <tr>
                      <td>
                        <p class="font-semibold text-(--sagep-brand-deep)">{{ item.referenceCode || item.ataItemCode || 'Item' }} - {{ item.description | emptyValue:'Descrição não informada' }}</p>
                        <p class="mt-1 text-sm text-(--sagep-muted)">{{ item.coverageGroup ? coverageGroupLabel(item.coverageGroup) : 'Grupo não informado' }}</p>
                      </td>
                      <td>{{ item.unit | emptyValue:'N/I' }}</td>
                      <td class="font-semibold text-(--sagep-brand-deep)">{{ formatCurrency(item.unitPrice) }}</td>
                      <td>{{ item.initialQuantity ?? item.balance?.initialQuantity ?? 'Não informado' }}</td>
                      <td>
                        <span class="badge" [class]="item.balance?.lowStock || item.balance?.insufficient ? 'b-warn' : 'b-ok'">
                          {{ item.balance?.availableQuantity ?? 'N/I' }}
                        </span>
                      </td>
                      <td>{{ item.isActive === false ? 'Inativo' : 'Ativo' }}</td>
                      <td>
                        @if (canManageAtas()) {
                          <div class="coverage-group-actions">
                            <button type="button" class="btn btn-sm btn-ghost" (click)="openAtaItemForm(item)">
                              Editar
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-ghost danger-action"
                              [disabled]="deletingAtaItemId() === item.id"
                              (click)="deleteAtaItem(item)"
                            >
                              {{ deletingAtaItemId() === item.id ? 'Excluindo...' : 'Excluir' }}
                            </button>
                          </div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="grid gap-4 lg:hidden">
              @for (item of ataItems(); track item.id) {
                <article class="estimate-item-card">
                  <div>
                    <p class="font-semibold text-(--sagep-brand-deep)">{{ item.referenceCode || item.ataItemCode || 'Item' }} - {{ item.description | emptyValue:'Descrição não informada' }}</p>
                    <p class="mt-1 text-sm text-(--sagep-muted)">{{ item.coverageGroup ? coverageGroupLabel(item.coverageGroup) : 'Grupo não informado' }}</p>
                  </div>
                  <app-metadata-grid [items]="itemFacts(item)" gridClass="sm:grid-cols-2" />
                  @if (canManageAtas()) {
                    <div class="coverage-group-actions">
                      <button type="button" class="btn btn-sm btn-ghost" (click)="openAtaItemForm(item)">
                        Editar
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-ghost danger-action"
                        [disabled]="deletingAtaItemId() === item.id"
                        (click)="deleteAtaItem(item)"
                      >
                        {{ deletingAtaItemId() === item.id ? 'Excluindo...' : 'Excluir' }}
                      </button>
                    </div>
                  }
                </article>
              }
            </div>
          } @else {
            <div class="empty"><p>Nenhum item foi encontrado para esta ATA.</p></div>
          }
        </app-section-card>
      }
    </div>
  `,
})
export class AtaDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly atasService = inject(AtasService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly itemsError = signal('');
  readonly editError = signal('');
  readonly successMessage = signal('');
  readonly editingAta = signal(false);
  readonly savingAta = signal(false);
  readonly coverageGroupFormVisible = signal(false);
  readonly editingCoverageGroupId = signal<string | null>(null);
  readonly savingCoverageGroup = signal(false);
  readonly deletingCoverageGroupId = signal<string | null>(null);
  readonly ataItemFormVisible = signal(false);
  readonly editingAtaItemId = signal<string | null>(null);
  readonly savingAtaItem = signal(false);
  readonly deletingAtaItemId = signal<string | null>(null);
  readonly ata = signal<Ata | null>(null);
  readonly ataItems = signal<AtaItem[]>([]);
  readonly coverageStates: AtaCoverageStateUf[] = ['AM', 'RO', 'RR', 'AC'];
  private ataIdentifier: string | null = null;

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

  readonly coverageGroupForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    stateUf: ['AM' as AtaCoverageStateUf, Validators.required],
    localitiesText: ['', Validators.required],
  });

  readonly ataItemForm = this.fb.nonNullable.group({
    referenceCode: ['', Validators.required],
    coverageGroupCode: ['', Validators.required],
    description: ['', Validators.required],
    unit: ['', Validators.required],
    unitPrice: [0, [Validators.required, Validators.min(0.01)]],
    initialQuantity: [0, [Validators.required, Validators.min(0.01)]],
    isActive: [true],
  });

  readonly coverageGroups = computed(() => {
    const groups = new Map<string, AtaCoverageGroup>();

    (this.ata()?.coverageGroups ?? []).forEach((group) => groups.set(group.id, group));
    this.ataItems()
      .map((item) => item.coverageGroup)
      .filter((group): group is AtaCoverageGroup => Boolean(group?.id))
      .forEach((group) => {
        if (!groups.has(group.id)) {
          groups.set(group.id, group);
        }
      });

    return Array.from(groups.values());
  });
  readonly heroFacts = computed<MetadataItem[]>(() => [
    { label: 'Número', value: this.ata()?.number || 'Não informado', highlight: true },
    { label: 'Tipo', value: this.ata()?.type ? formatLabel(this.ata()?.type) : 'Não informado' },
    { label: 'Fornecedor', value: this.ata()?.vendorName || 'Não informado' },
    { label: 'Vigência', value: this.dateRange(this.ata()?.validFrom || this.ata()?.startDate, this.ata()?.validUntil || this.ata()?.endDate) },
  ]);
  readonly summaryCards = computed(() => {
    const items = this.ataItems();
    const lowStock = items.filter((item) => item.balance?.lowStock || item.balance?.insufficient).length;

    return [
      {
        title: 'Itens',
        value: String(items.length),
        description: 'Itens precificados',
        icon: 'IT',
        tone: 'soft' as const,
      },
      {
        title: 'Cobertura',
        value: String(this.coverageGroups().length),
        description: 'Grupos vinculados',
        icon: 'GC',
        tone: 'accent' as const,
      },
      {
        title: 'Saldo',
        value: lowStock ? `${lowStock} alerta(s)` : 'Regular',
        description: 'Disponibilidade dos itens',
        icon: 'SD',
        tone: lowStock ? ('warning' as const) : ('success' as const),
      },
      {
        title: 'Status',
        value: this.isActive(this.ata()) ? 'Ativa' : 'Inativa',
        description: 'Situação da ATA',
        icon: 'ST',
        tone: this.isActive(this.ata()) ? ('success' as const) : ('warning' as const),
      },
    ];
  });

  ngOnInit(): void {
    this.ataIdentifier = this.route.snapshot.paramMap.get('id');

    if (!this.ataIdentifier) {
      this.errorMessage.set('Identificador da ATA não informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(): void {
    if (!this.ataIdentifier) return;

    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');
    this.itemsError.set('');
    this.ataItems.set([]);

    this.resolveAta(this.ataIdentifier).subscribe({
      next: (ata) => {
        if (!ata) {
          this.errorMessage.set('ATA não encontrada.');
          this.loading.set(false);
          return;
        }

        this.ata.set(ata);
        this.patchAtaForm(ata);
        this.loadAtaItems(ata.id);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'ATA não encontrada ou sem permissão de acesso.'));
        this.ata.set(null);
        this.loading.set(false);
      },
    });
  }

  toggleEditForm(): void {
    this.editingAta.update((visible) => !visible);
    this.editError.set('');
    this.successMessage.set('');

    if (this.editingAta() && this.ata()) {
      this.patchAtaForm(this.ata() as Ata);
    }
  }

  updateAta(): void {
    const ata = this.ata();

    if (!ata || !this.canManageAtas() || this.ataForm.invalid || this.savingAta()) {
      this.ataForm.markAllAsTouched();
      return;
    }

    this.savingAta.set(true);
    this.editError.set('');
    this.successMessage.set('');

    this.atasService.update(ata.id, this.ataPayload()).subscribe({
      next: () => {
        this.successMessage.set('ATA atualizada com sucesso.');
        this.savingAta.set(false);
        this.editingAta.set(false);
        this.reload();
      },
      error: (error) => {
        this.editError.set(getErrorMessage(error, 'NÃ£o foi possÃ­vel atualizar a ATA.'));
        this.savingAta.set(false);
      },
    });
  }

  openCoverageGroupForm(group?: AtaCoverageGroup): void {
    if (!this.canManageAtas()) return;

    const stateUf = this.groupStateUf(group);
    const localitiesText = group?.localities
      ?.map((locality) => locality.cityName?.trim())
      .filter(Boolean)
      .join('\n') ?? '';

    this.coverageGroupForm.reset({
      name: group?.name ?? '',
      stateUf,
      localitiesText,
    });
    this.editingCoverageGroupId.set(group?.id ?? null);
    this.coverageGroupFormVisible.set(true);
    this.editError.set('');
    this.successMessage.set('');
  }

  closeCoverageGroupForm(): void {
    this.coverageGroupFormVisible.set(false);
    this.editingCoverageGroupId.set(null);
    this.coverageGroupForm.reset({
      name: '',
      stateUf: 'AM',
      localitiesText: '',
    });
  }

  saveCoverageGroup(): void {
    const ata = this.ata();
    const editingId = this.editingCoverageGroupId();

    if (!ata || !this.canManageAtas() || this.coverageGroupForm.invalid || this.savingCoverageGroup()) {
      this.coverageGroupForm.markAllAsTouched();
      return;
    }

    this.savingCoverageGroup.set(true);
    this.editError.set('');
    this.successMessage.set('');

    const request = editingId
      ? this.atasService.updateCoverageGroup(ata.id, editingId, this.coverageGroupUpdatePayload())
      : this.atasService.createCoverageGroup(ata.id, this.coverageGroupCreatePayload());

    request.subscribe({
      next: () => {
        this.successMessage.set(editingId ? 'Grupo de cobertura atualizado com sucesso.' : 'Grupo de cobertura criado com sucesso.');
        this.savingCoverageGroup.set(false);
        this.closeCoverageGroupForm();
        this.reload();
      },
      error: (error) => {
        this.editError.set(getErrorMessage(error, 'Não foi possível salvar o grupo de cobertura.'));
        this.savingCoverageGroup.set(false);
      },
    });
  }

  deleteCoverageGroup(group: AtaCoverageGroup): void {
    const ata = this.ata();

    if (!ata || !this.canManageAtas() || this.deletingCoverageGroupId()) return;

    this.deletingCoverageGroupId.set(group.id);
    this.editError.set('');
    this.successMessage.set('');

    this.atasService.deleteCoverageGroup(ata.id, group.id).subscribe({
      next: () => {
        this.successMessage.set('Grupo de cobertura excluído com sucesso.');
        this.deletingCoverageGroupId.set(null);
        this.closeCoverageGroupForm();
        this.reload();
      },
      error: (error) => {
        this.editError.set(this.coverageGroupDeleteError(error));
        this.deletingCoverageGroupId.set(null);
      },
    });
  }

  openAtaItemForm(item?: AtaItem): void {
    if (!this.canManageAtas()) return;

    this.ataItemForm.reset({
      referenceCode: item?.referenceCode ?? '',
      coverageGroupCode: this.itemCoverageGroupCode(item),
      description: item?.description ?? '',
      unit: item?.unit ?? '',
      unitPrice: this.numberValue(item?.unitPrice),
      initialQuantity: this.numberValue(item?.initialQuantity ?? item?.balance?.initialQuantity),
      isActive: item?.isActive !== false,
    });
    this.editingAtaItemId.set(item?.id ?? null);
    this.ataItemFormVisible.set(true);
    this.editError.set('');
    this.successMessage.set('');
  }

  closeAtaItemForm(): void {
    this.ataItemFormVisible.set(false);
    this.editingAtaItemId.set(null);
    this.ataItemForm.reset({
      referenceCode: '',
      coverageGroupCode: '',
      description: '',
      unit: '',
      unitPrice: 0,
      initialQuantity: 0,
      isActive: true,
    });
  }

  saveAtaItem(): void {
    const ata = this.ata();
    const editingId = this.editingAtaItemId();

    if (!ata || !this.canManageAtas() || this.ataItemForm.invalid || this.savingAtaItem()) {
      this.ataItemForm.markAllAsTouched();
      return;
    }

    this.savingAtaItem.set(true);
    this.editError.set('');
    this.successMessage.set('');

    const request = editingId
      ? this.atasService.updateItem(editingId, this.ataItemUpdatePayload())
      : this.atasService.createItem(ata.id, this.ataItemCreatePayload());

    request.subscribe({
      next: () => {
        this.successMessage.set(editingId ? 'Item da ATA atualizado com sucesso.' : 'Item da ATA criado com sucesso.');
        this.savingAtaItem.set(false);
        this.closeAtaItemForm();
        this.loadAtaItems(ata.id);
      },
      error: (error) => {
        this.editError.set(getErrorMessage(error, 'Não foi possível salvar o item da ATA.'));
        this.savingAtaItem.set(false);
      },
    });
  }

  deleteAtaItem(item: AtaItem): void {
    const ata = this.ata();

    if (!ata || !this.canManageAtas() || this.deletingAtaItemId()) return;

    this.deletingAtaItemId.set(item.id);
    this.editError.set('');
    this.successMessage.set('');

    this.atasService.deleteItem(item.id).subscribe({
      next: () => {
        this.successMessage.set('Item da ATA excluído com sucesso.');
        this.deletingAtaItemId.set(null);
        this.closeAtaItemForm();
        this.loadAtaItems(ata.id);
      },
      error: (error) => {
        this.editError.set(this.ataItemDeleteError(error));
        this.deletingAtaItemId.set(null);
      },
    });
  }

  ataFacts(): MetadataItem[] {
    const ata = this.ata();
    return [
      { label: 'Código interno', value: ata?.ataCode ? `#${ata.ataCode}` : 'Não informado' },
      { label: 'Número', value: ata?.number || 'Não informado' },
      { label: 'Tipo', value: ata?.type ? formatLabel(ata.type) : 'Não informado' },
      { label: 'Status', value: this.isActive(ata) ? 'Ativa' : 'Inativa' },
      { label: 'Criada em', value: formatDate(ata?.createdAt) },
      { label: 'Atualizada em', value: formatDate(ata?.updatedAt) },
    ];
  }

  vendorFacts(): MetadataItem[] {
    const ata = this.ata();
    return [
      { label: 'Fornecedor', value: ata?.vendorName || 'Não informado', highlight: true },
      { label: 'Início da vigência', value: formatDate(ata?.validFrom || ata?.startDate) },
      { label: 'Fim da vigência', value: formatDate(ata?.validUntil || ata?.endDate) },
      { label: 'Grupos de cobertura', value: String(this.coverageGroups().length) },
    ];
  }

  itemFacts(item: AtaItem): MetadataItem[] {
    return [
      { label: 'Unidade', value: item.unit || 'N/I' },
      { label: 'Valor unitário', value: formatCurrency(item.unitPrice) },
      { label: 'Quantidade inicial', value: item.initialQuantity ?? item.balance?.initialQuantity ?? 'Não informado' },
      { label: 'Saldo disponível', value: item.balance?.availableQuantity ?? 'Não informado', highlight: true },
    ];
  }

  ataLabel(ata: Ata | null): string {
    if (!ata) return 'Detalhe da ATA';
    return [ata.type ? formatLabel(ata.type) : 'ATA', ata.number || (ata.ataCode ? `#${ata.ataCode}` : '')]
      .filter(Boolean)
      .join(' ');
  }

  coverageGroupLabel(group: AtaCoverageGroup): string {
    return [group.code, group.name].filter(Boolean).join(' - ') || group.id;
  }

  coverageGroupLocalitiesLabel(group: AtaCoverageGroup): string {
    const localities = group.localities ?? [];

    if (!localities.length) {
      return 'Localidades não informadas.';
    }

    return localities
      .map((locality) => [locality.cityName, locality.stateUf].filter(Boolean).join('/'))
      .filter(Boolean)
      .join(', ') || 'Localidades não informadas.';
  }

  isActive(ata: Ata | null): boolean {
    if (!ata) return false;
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

  readonly formatCurrency = formatCurrency;

  private resolveAta(identifier: string) {
    return this.atasService.getById(identifier).pipe(
      catchError(() =>
        this.atasService.list().pipe(
          catchError(() => of([] as Ata[])),
          map((items) => this.findAta(this.listItems(items), identifier)),
        ),
      ),
    );
  }

  private loadAtaItems(ataId: string): void {
    this.atasService
      .listItems(ataId)
      .pipe(catchError((error) => {
        this.itemsError.set(getErrorMessage(error, 'Não foi possível carregar os itens desta ATA.'));
        return of([] as AtaItem[]);
      }))
      .subscribe((response) => {
        this.ataItems.set(this.listItems(response));
        this.loading.set(false);
      });
  }

  private findAta(items: Ata[], identifier: string): Ata | null {
    const normalized = identifier.trim().toLowerCase();
    return items.find((ata) =>
      [ata.id, ata.number, ata.ataCode ? String(ata.ataCode) : '']
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === normalized),
    ) ?? null;
  }

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }

  private patchAtaForm(ata: Ata): void {
    this.ataForm.reset({
      number: ata.number ?? '',
      type: ata.type === 'FIBRA_OPTICA' ? 'FIBRA_OPTICA' : 'CFTV',
      vendorName: ata.vendorName ?? '',
      managingAgency: ata.managingAgency ?? ata.managerAgency ?? '',
      startDate: this.dateInputValue(ata.validFrom || ata.startDate),
      endDate: this.dateInputValue(ata.validUntil || ata.endDate),
      observations: ata.observations ?? ata.notes ?? '',
      isActive: this.isActive(ata),
    });
  }

  private ataPayload(): Partial<AtaPayload> {
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

  private coverageGroupCreatePayload(): AtaCoverageGroupPayload {
    const value = this.coverageGroupForm.getRawValue();
    return {
      code: value.stateUf,
      name: value.name.trim(),
      localities: this.coverageGroupLocalitiesPayload(),
    };
  }

  private coverageGroupUpdatePayload(): AtaCoverageGroupUpdatePayload {
    const value = this.coverageGroupForm.getRawValue();
    const group = this.coverageGroups().find((candidate) => candidate.id === this.editingCoverageGroupId());

    return {
      code: group?.code || value.stateUf,
      name: value.name.trim(),
      localities: this.coverageGroupLocalitiesPayload(),
    };
  }

  private coverageGroupLocalitiesPayload(): AtaCoverageLocalityPayload[] {
    const value = this.coverageGroupForm.getRawValue();
    return value.localitiesText
      .split(/\r?\n/)
      .map((cityName) => cityName.trim())
      .filter(Boolean)
      .map((cityName) => ({
        cityName,
        stateUf: value.stateUf,
      }));
  }

  private groupStateUf(group: AtaCoverageGroup | undefined): AtaCoverageStateUf {
    const fromLocality = group?.localities?.find((locality) => this.isCoverageStateUf(locality.stateUf))?.stateUf;
    const fromCode = this.isCoverageStateUf(group?.code) ? group?.code : null;

    return (fromLocality || fromCode || 'AM') as AtaCoverageStateUf;
  }

  private isCoverageStateUf(value: unknown): value is AtaCoverageStateUf {
    return this.coverageStates.includes(value as AtaCoverageStateUf);
  }

  private coverageGroupDeleteError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      return 'Não foi possível excluir este grupo porque ele possui itens da ATA ou estimativas vinculadas.';
    }

    return getErrorMessage(error, 'Não foi possível excluir o grupo de cobertura.');
  }

  private ataItemCreatePayload(): AtaItemPayload {
    const value = this.ataItemForm.getRawValue();
    return {
      coverageGroupCode: value.coverageGroupCode,
      referenceCode: value.referenceCode.trim(),
      description: value.description.trim(),
      unit: value.unit.trim(),
      unitPrice: Number(value.unitPrice),
      initialQuantity: Number(value.initialQuantity),
    };
  }

  private ataItemUpdatePayload(): AtaItemUpdatePayload {
    const value = this.ataItemForm.getRawValue();
    return {
      coverageGroupCode: value.coverageGroupCode,
      referenceCode: value.referenceCode.trim(),
      description: value.description.trim(),
      unit: value.unit.trim(),
      unitPrice: Number(value.unitPrice),
      initialQuantity: Number(value.initialQuantity),
      isActive: value.isActive,
    };
  }

  private itemCoverageGroupCode(item: AtaItem | undefined): string {
    if (!item) return this.coverageGroups()[0]?.code || '';
    return item.coverageGroup?.code || this.coverageGroups().find((group) => group.id === item.coverageGroupId)?.code || '';
  }

  private numberValue(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private ataItemDeleteError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      return 'Não foi possível excluir este item porque ele possui vínculo com estimativas, saldo ou movimentações.';
    }

    return getErrorMessage(error, 'Não foi possível excluir o item da ATA.');
  }

  private dateInputValue(value: string | null | undefined): string {
    return value ? value.slice(0, 10) : '';
  }
}
