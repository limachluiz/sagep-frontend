import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import { Ata, AtaCoverageGroup, AtaItem } from '../../core/models/ata.model';
import { MilitaryOrganization } from '../../core/models/military-organization.model';
import { Project } from '../../core/models/project.model';
import { AtasService } from '../../core/services/atas.service';
import { MilitaryOrganizationsService } from '../../core/services/military-organizations.service';
import { ProjectsService } from '../../core/services/projects.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MetadataGridComponent, MetadataItem } from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import {
  buildEstimateIdentifier,
  buildProjectIdentifier,
  formatCurrency,
  formatDate,
  formatLabel,
} from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { Estimate } from './estimate.model';
import { EstimateCreatePayload, EstimatesService } from './estimates.service';

type ItemFormGroup = FormGroup<{
  ataItemId: FormControl<string>;
  quantity: FormControl<number>;
}>;

interface SelectedItemSummary {
  item: AtaItem;
  quantity: number;
  subtotal: number;
}

@Component({
  selector: 'app-estimate-create-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccessDeniedStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    MetadataGridComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  template: `
    <section class="estimate-wizard-workspace">
      <app-page-header
        title="Nova estimativa"
        eyebrow="Estimativas"
        subtitle="Fluxo inicial para montar uma estimativa de preço a partir de projeto, ATA, grupo de cobertura, OM e itens."
        badge="Fonte: POST /estimates"
        backLabel="← Voltar para estimativas"
        backLink="/estimates"
      />

      @if (loading()) {
        <app-loading-state variant="detail" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite criar estimativas."
          description="A API retornou acesso negado para esta operação. Você pode voltar para a listagem sem encerrar a sessão."
          primaryLink="/estimates"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else {
        @if (errorMessage()) {
          <app-error-state
            title="Não foi possível preparar a nova estimativa"
            [message]="errorMessage()"
            retryLabel="Tentar novamente"
            (retry)="loadInitialData()"
          />
        }

        <div class="estimate-stepper">
          @for (step of steps; track step.id) {
            <button
              type="button"
              (click)="goToStep(step.id)"
              [disabled]="step.id > maxReachableStep()"
              class="estimate-step"
              [class.active]="currentStep() === step.id"
            >
              <span>Etapa {{ step.id }}</span>
              <b>{{ step.label }}</b>
            </button>
          }
        </div>

        @if (saveError()) {
          <app-error-state
            title="Não foi possível salvar a estimativa"
            [message]="saveError()"
            retryLabel=""
          />
        }

        @if (currentStep() === 1) {
          <app-section-card title="Selecionar projeto" subtitle="Busque por texto ou código e escolha o projeto que receberá a estimativa.">
            <input
              type="search"
              [formControl]="projectSearchControl"
              class="input estimate-search"
              placeholder="Buscar projeto por título ou código"
            />

            @if (loadingProjects()) {
              <app-loading-state class="mt-5 block" variant="list" [count]="2" />
            } @else {
              <div class="mt-5 grid gap-4">
                @for (project of projects(); track project.id) {
                  <button
                    type="button"
                    (click)="selectProject(project)"
                    class="estimate-choice-card"
                    [class.active]="selectedProject()?.id === project.id"
                  >
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p class="font-semibold text-[var(--sagep-brand-deep)]">
                          {{ projectFriendlyCode(project) }} - {{ project.title }}
                        </p>
                        <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ project.description || 'Sem descrição cadastrada.' }}</p>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <app-status-badge [label]="formatLabel(project.status)" [status]="project.status" />
                        <app-status-badge [label]="formatLabel(project.stage)" [status]="project.stage" />
                      </div>
                    </div>
                    <app-metadata-grid class="mt-4 block" [items]="projectMetadata(project)" gridClass="md:grid-cols-3" />
                  </button>
                } @empty {
                  <div class="estimate-empty-note">
                    Nenhum projeto retornado para a busca atual.
                  </div>
                }
              </div>
            }
          </app-section-card>
        }

        @if (currentStep() === 2) {
          <app-section-card title="Selecionar ATA, cobertura e OM" subtitle="Escolha a ATA disponível e complete os vínculos exigidos para criação.">
            <div class="estimate-wizard-grid">
              <div>
                <input
                  type="search"
                  [formControl]="ataSearchControl"
                  class="input estimate-search"
                  placeholder="Filtrar ATAs por número, tipo ou fornecedor"
                />
                <div class="mt-5 grid gap-4">
                  @for (ata of filteredAtas(); track ata.id) {
                    <button
                      type="button"
                      (click)="selectAta(ata)"
                      class="estimate-choice-card"
                      [class.active]="selectedAta()?.id === ata.id"
                    >
                      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ ataLabel(ata) }}</p>
                          <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ ata.vendorName || 'Fornecedor não informado' }}</p>
                        </div>
                        <span class="rounded-full border border-[var(--sagep-line)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sagep-muted)]">
                          {{ ata.isActive === false ? 'Inativa' : formatLabel(ata.status || 'Ativa') }}
                        </span>
                      </div>
                      <app-metadata-grid class="mt-4 block" [items]="ataMetadata(ata)" gridClass="md:grid-cols-3" />
                    </button>
                  } @empty {
                    <div class="estimate-empty-note">
                      Nenhuma ATA disponível para o filtro atual.
                    </div>
                  }
                </div>
              </div>

              <div class="estimate-side-panel" [formGroup]="form">
                <div class="field">
                  <label for="coverageGroupId">
                    Grupo de cobertura
                  </label>
                  <select
                    id="coverageGroupId"
                    formControlName="coverageGroupId"
                    (change)="selectCoverageGroup($any($event.target).value)"
                    class="select"
                  >
                    <option value="">Selecione</option>
                    @for (group of coverageGroups(); track group.id) {
                      <option [value]="group.id">{{ coverageGroupLabel(group) }}</option>
                    }
                  </select>
                  @if (selectedAta() && !coverageGroups().length) {
                    <p class="mt-3 text-sm text-amber-700">A ATA selecionada ainda não retornou grupos de cobertura.</p>
                  }
                </div>

                <div class="field">
                  <label for="omId">OM</label>
                  <select
                    id="omId"
                    formControlName="omId"
                    (change)="selectOm($any($event.target).value)"
                    class="select"
                  >
                    <option value="">Selecione</option>
                    @for (om of oms(); track om.id) {
                      <option [value]="om.id">{{ omLabel(om) }}</option>
                    }
                  </select>
                </div>

                @if (loadingItems()) {
                  <app-loading-state variant="list" [count]="2" />
                }
              </div>
            </div>
          </app-section-card>
        }

        @if (currentStep() === 3) {
          <app-section-card title="Selecionar itens" subtitle="Marque os itens da ATA que farão parte da estimativa.">
            <div class="grid gap-4">
              @for (item of ataItems(); track item.id) {
                <label class="estimate-item-card">
                  <input
                    type="checkbox"
                    class="mt-1 h-5 w-5 rounded border-[var(--sagep-line)] text-[var(--sagep-brand)]"
                    [checked]="isItemSelected(item.id)"
                    (change)="toggleItem(item, $any($event.target).checked)"
                  />
                  <div class="estimate-item-card-body">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.referenceCode || 'Item sem referência' }} - {{ item.description || 'Sem descrição' }}</p>
                        <p class="mt-1 text-sm text-[var(--sagep-muted)]">Unidade: {{ item.unit || 'Não informado' }}</p>
                      </div>
                      <p class="text-sm font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(item.unitPrice) }}</p>
                    </div>
                    <app-metadata-grid class="mt-4 block" [items]="itemMetadata(item)" gridClass="md:grid-cols-4" />
                  </div>
                </label>
              } @empty {
                <div class="estimate-empty-note">
                  Selecione uma ATA para carregar os itens disponíveis.
                </div>
              }
            </div>
          </app-section-card>
        }

        @if (currentStep() === 4) {
          <app-section-card title="Informar quantidades" subtitle="Defina a quantidade desejada para cada item selecionado.">
            <div class="grid gap-4">
              @for (entry of selectedItemSummaries(); track entry.item.id) {
                <div class="estimate-quantity-card">
                  <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ entry.item.referenceCode || 'Item' }} - {{ entry.item.description || 'Sem descrição' }}</p>
                      <p class="mt-1 text-sm text-[var(--sagep-muted)]">Valor unitário: {{ formatCurrency(entry.item.unitPrice) }}</p>
                    </div>
                    <label class="w-full max-w-48 text-sm font-semibold text-[var(--sagep-ink)]">
                      Quantidade
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        [formControl]="quantityControl(entry.item.id)"
                        class="input"
                      />
                    </label>
                  </div>
                  <app-metadata-grid
                    class="mt-4 block"
                    [items]="quantityMetadata(entry)"
                    gridClass="md:grid-cols-3"
                  />
                </div>
              } @empty {
                <div class="estimate-empty-note">
                  Selecione ao menos um item antes de informar quantidades.
                </div>
              }
            </div>
          </app-section-card>
        }

        @if (currentStep() === 5) {
          <app-section-card title="Revisar e salvar" subtitle="Confira os vínculos e os totais calculados para prévia antes de enviar ao backend.">
            <div class="estimate-review-grid">
              <div class="estimate-review-summary">
                <app-metadata-grid [items]="reviewMetadata()" gridClass="grid-cols-1" />
                <div class="estimate-total-card">
                  <p>Total estimado</p>
                  <b>{{ formatCurrency(totalPreview()) }}</b>
                </div>
              </div>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th class="text-right">Qtd.</th>
                      <th class="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (entry of selectedItemSummaries(); track entry.item.id) {
                      <tr>
                        <td><b>{{ entry.item.referenceCode || 'Item' }}</b></td>
                        <td class="text-right">{{ entry.quantity }}</td>
                        <td class="text-right"><b>{{ formatCurrency(entry.subtotal) }}</b></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </app-section-card>
        }

        <div class="estimate-wizard-actions">
          <button
            type="button"
            (click)="previousStep()"
            [disabled]="currentStep() === 1 || saving()"
            class="btn btn-ghost"
          >
            Anterior
          </button>

          @if (currentStep() < 5) {
            <button
              type="button"
              (click)="nextStep()"
              [disabled]="!canGoNext() || saving()"
              class="btn btn-primary"
            >
              Próxima etapa
            </button>
          } @else {
            <button
              type="button"
              (click)="saveEstimate()"
              [disabled]="!canSave() || saving()"
              class="btn btn-primary"
            >
              {{ saving() ? 'Salvando...' : 'Salvar estimativa' }}
            </button>
          }
        </div>
      }
    </section>
  `,
})
export class EstimateCreatePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly atasService = inject(AtasService);
  private readonly militaryOrganizationsService = inject(MilitaryOrganizationsService);
  private readonly estimatesService = inject(EstimatesService);

  readonly steps = [
    { id: 1, label: 'Projeto' },
    { id: 2, label: 'ATA e vínculos' },
    { id: 3, label: 'Itens' },
    { id: 4, label: 'Quantidades' },
    { id: 5, label: 'Resumo' },
  ];

  readonly form = this.fb.nonNullable.group({
    projectId: ['', Validators.required],
    ataId: ['', Validators.required],
    coverageGroupId: ['', Validators.required],
    omId: ['', Validators.required],
    items: this.fb.array<ItemFormGroup>([]),
  });

  readonly projectSearchControl = this.fb.nonNullable.control('');
  readonly ataSearchControl = this.fb.nonNullable.control('');

  readonly loading = signal(true);
  readonly loadingProjects = signal(false);
  readonly loadingItems = signal(false);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly saveError = signal('');
  readonly saving = signal(false);
  readonly currentStep = signal(1);
  readonly projects = signal<Project[]>([]);
  readonly atas = signal<Ata[]>([]);
  readonly oms = signal<MilitaryOrganization[]>([]);
  readonly ataItems = signal<AtaItem[]>([]);
  readonly selectedProject = signal<Project | null>(null);
  readonly selectedAta = signal<Ata | null>(null);

  readonly filteredAtas = computed(() => {
    const term = this.ataSearchControl.value.trim().toLowerCase();
    const atas = this.atas();

    if (!term) {
      return atas;
    }

    return atas.filter((ata) =>
      [ata.number, ata.type, ata.vendorName, ata.ataCode ? String(ata.ataCode) : '']
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  });

  readonly coverageGroups = computed<AtaCoverageGroup[]>(() => {
    const fromAta = this.selectedAta()?.coverageGroups ?? [];
    const fromItems = this.ataItems()
      .map((item) => item.coverageGroup)
      .filter((group): group is AtaCoverageGroup => Boolean(group?.id));
    const byId = new Map<string, AtaCoverageGroup>();

    [...fromAta, ...fromItems].forEach((group) => byId.set(group.id, group));

    return Array.from(byId.values());
  });

  readonly selectedItemSummaries = computed<SelectedItemSummary[]>(() =>
    this.itemsArray.controls
      .map((control) => {
        const ataItemId = control.controls.ataItemId.value;
        const item = this.ataItems().find((candidate) => candidate.id === ataItemId);
        const quantity = this.normalizedQuantity(control.controls.quantity.value);

        if (!item) {
          return null;
        }

        return {
          item,
          quantity,
          subtotal: quantity * this.numericValue(item.unitPrice),
        };
      })
      .filter((entry): entry is SelectedItemSummary => Boolean(entry)),
  );

  readonly totalPreview = computed(() =>
    this.selectedItemSummaries().reduce((total, entry) => total + entry.subtotal, 0),
  );

  get itemsArray(): FormArray<ItemFormGroup> {
    return this.form.controls.items;
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.projectSearchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe((search) => {
      this.loadProjects(search);
    });
  }

  loadInitialData(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    forkJoin({
      projects: this.projectsService.list({ page: 1, pageSize: 10 }),
      atas: this.atasService.list(),
      oms: this.militaryOrganizationsService.list(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ projects, atas, oms }) => {
          this.projects.set(projects.items ?? []);
          this.atas.set(this.listItems(atas));
          this.oms.set(this.listItems(oms));
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.errorMessage.set(getErrorMessage(error, 'Falha ao carregar dados para criação da estimativa.'));
        },
      });
  }

  loadProjects(search = ''): void {
    this.loadingProjects.set(true);
    this.projectsService
      .list({ page: 1, pageSize: 10, search: search || undefined })
      .pipe(finalize(() => this.loadingProjects.set(false)))
      .subscribe({
        next: (response) => this.projects.set(response.items ?? []),
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar projetos.'));
        },
      });
  }

  selectProject(project: Project): void {
    this.selectedProject.set(project);
    this.form.controls.projectId.setValue(project.id);
    this.form.controls.projectId.updateValueAndValidity();

    const projectOmId = this.recordValue(project, ['omId', 'militaryOrganizationId']);
    if (projectOmId) {
      this.form.controls.omId.setValue(projectOmId);
      this.form.controls.omId.updateValueAndValidity();
    }
  }

  selectAta(ata: Ata): void {
    this.selectedAta.set(ata);
    this.form.patchValue({
      ataId: ata.id,
      coverageGroupId: '',
    });
    this.form.controls.ataId.updateValueAndValidity();
    this.form.controls.coverageGroupId.updateValueAndValidity();
    this.itemsArray.clear();
    this.selectDefaultCoverageGroup();
    this.loadAtaItems(ata.id);
  }

  loadAtaItems(ataId: string): void {
    this.loadingItems.set(true);
    this.ataItems.set([]);

    this.atasService
      .listItems(ataId)
      .pipe(finalize(() => this.loadingItems.set(false)))
      .subscribe({
        next: (response) => {
          this.ataItems.set(this.listItems(response));
          this.selectDefaultCoverageGroup();
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.errorMessage.set(getErrorMessage(error, 'Falha ao carregar itens da ATA.'));
        },
      });
  }

  toggleItem(item: AtaItem, checked: boolean): void {
    const index = this.itemsArray.controls.findIndex((control) => control.controls.ataItemId.value === item.id);

    if (checked && index === -1) {
      this.itemsArray.push(
        this.fb.nonNullable.group({
          ataItemId: [item.id, Validators.required],
          quantity: [1, [Validators.required, Validators.min(0.01)]],
        }),
      );
    }

    if (!checked && index >= 0) {
      this.itemsArray.removeAt(index);
    }
  }

  isItemSelected(itemId: string): boolean {
    return this.itemsArray.controls.some((control) => control.controls.ataItemId.value === itemId);
  }

  quantityControl(itemId: string): FormControl<number> {
    const control = this.itemsArray.controls.find((candidate) => candidate.controls.ataItemId.value === itemId);
    return control?.controls.quantity ?? this.fb.nonNullable.control(0);
  }

  selectCoverageGroup(coverageGroupId: string): void {
    this.form.controls.coverageGroupId.setValue(coverageGroupId);
    this.form.controls.coverageGroupId.updateValueAndValidity();
  }

  selectOm(omId: string): void {
    this.form.controls.omId.setValue(omId);
    this.form.controls.omId.updateValueAndValidity();
  }

  goToStep(step: number): void {
    if (step <= this.maxReachableStep()) {
      this.currentStep.set(step);
    }
  }

  previousStep(): void {
    this.currentStep.update((step) => Math.max(1, step - 1));
  }

  nextStep(): void {
    if (this.canGoNext()) {
      this.currentStep.update((step) => Math.min(5, step + 1));
    }
  }

  canGoNext(): boolean {
    switch (this.currentStep()) {
      case 1:
        return Boolean(this.form.controls.projectId.value);
      case 2:
        return Boolean(
          this.form.controls.ataId.value &&
            this.form.controls.coverageGroupId.value &&
            this.form.controls.omId.value,
        );
      case 3:
        return this.itemsArray.length > 0;
      case 4:
        return this.itemsArray.controls.every((control) => this.normalizedQuantity(control.controls.quantity.value) > 0);
      default:
        return true;
    }
  }

  canSave(): boolean {
    return this.form.valid && this.itemsArray.length > 0;
  }

  maxReachableStep(): number {
    if (!this.form.controls.projectId.value) return 1;
    if (!this.form.controls.ataId.value || !this.form.controls.coverageGroupId.value || !this.form.controls.omId.value) return 2;
    if (!this.itemsArray.length) return 3;
    if (!this.itemsArray.controls.every((control) => this.normalizedQuantity(control.controls.quantity.value) > 0)) return 4;
    return 5;
  }

  saveEstimate(): void {
    if (!this.canSave()) {
      this.form.markAllAsTouched();
      this.saveError.set('Revise os campos obrigatórios antes de salvar.');
      return;
    }

    this.saving.set(true);
    this.saveError.set('');

    const payload: EstimateCreatePayload = {
      projectId: this.form.controls.projectId.value,
      ataId: this.form.controls.ataId.value,
      coverageGroupId: this.form.controls.coverageGroupId.value,
      omId: this.form.controls.omId.value,
      items: this.itemsArray.controls.map((control) => ({
        ataItemId: control.controls.ataItemId.value,
        quantity: this.normalizedQuantity(control.controls.quantity.value),
      })),
    };

    this.estimatesService
      .create(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (estimate) => {
          void this.router.navigate(['/estimates', this.estimateIdentifier(estimate)]);
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.saveError.set(getErrorMessage(error, 'Falha ao criar a estimativa.'));
        },
      });
  }

  projectFriendlyCode(project: Project): string {
    return buildProjectIdentifier(project.projectCode, project.id, project.createdAt);
  }

  projectMetadata(project: Project): MetadataItem[] {
    return [
      { label: 'OM', value: this.recordValue(project, ['omName', 'militaryOrganizationName', 'om.sigla']) },
      { label: 'Cidade / UF', value: this.locationFromRecord(project) },
      { label: 'Criado em', value: formatDate(project.createdAt) },
    ];
  }

  ataLabel(ata: Ata): string {
    return [ata.type ? formatLabel(ata.type) : 'ATA', ata.number || (ata.ataCode ? `#${ata.ataCode}` : '')]
      .filter(Boolean)
      .join(' ');
  }

  ataMetadata(ata: Ata): MetadataItem[] {
    return [
      { label: 'Tipo', value: ata.type ? formatLabel(ata.type) : null },
      { label: 'Número', value: ata.number || ata.ataCode },
      { label: 'Vigência', value: this.dateRange(ata.validFrom || ata.startDate, ata.validUntil || ata.endDate) },
    ];
  }

  itemMetadata(item: AtaItem): MetadataItem[] {
    return [
      { label: 'Código', value: item.ataItemCode ? `#${item.ataItemCode}` : item.referenceCode },
      { label: 'Saldo disponível', value: item.balance?.availableQuantity ?? null },
      { label: 'Saldo reservado', value: item.balance?.reservedQuantity ?? null },
      { label: 'Grupo', value: item.coverageGroup ? this.coverageGroupLabel(item.coverageGroup) : item.coverageGroupId },
    ];
  }

  quantityMetadata(entry: SelectedItemSummary): MetadataItem[] {
    return [
      { label: 'Saldo disponível', value: entry.item.balance?.availableQuantity ?? null },
      { label: 'Subtotal', value: formatCurrency(entry.subtotal), highlight: true },
      { label: 'Unidade', value: entry.item.unit },
    ];
  }

  reviewMetadata(): MetadataItem[] {
    return [
      { label: 'Projeto', value: this.selectedProject() ? this.projectFriendlyCode(this.selectedProject() as Project) : null },
      { label: 'ATA', value: this.selectedAta() ? this.ataLabel(this.selectedAta() as Ata) : null },
      { label: 'Grupo de cobertura', value: this.coverageGroupLabelById(this.form.controls.coverageGroupId.value) },
      { label: 'OM', value: this.omLabelById(this.form.controls.omId.value) },
    ];
  }

  coverageGroupLabel(group: AtaCoverageGroup): string {
    return [group.code, group.name].filter(Boolean).join(' - ') || group.id;
  }

  coverageGroupLabelById(id: string): string {
    const group = this.coverageGroups().find((candidate) => candidate.id === id);
    return group ? this.coverageGroupLabel(group) : 'Não informado';
  }

  omLabel(om: MilitaryOrganization): string {
    const name = [om.sigla, om.name].filter(Boolean).join(' - ') || om.id;
    const location = [om.cityName, om.stateUf].filter(Boolean).join(' / ');
    return location ? `${name} (${location})` : name;
  }

  omLabelById(id: string): string {
    const om = this.oms().find((candidate) => candidate.id === id);
    return om ? this.omLabel(om) : 'Não informado';
  }

  private estimateIdentifier(estimate: Estimate): string {
    return estimate.estimateCode
      ? buildEstimateIdentifier(estimate.estimateCode, estimate.id, estimate.createdAt)
      : estimate.id;
  }

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }

  private selectDefaultCoverageGroup(): void {
    if (this.form.controls.coverageGroupId.value) {
      return;
    }

    const groups = this.coverageGroups();

    if (groups.length === 1) {
      this.form.controls.coverageGroupId.setValue(groups[0].id);
      this.form.controls.coverageGroupId.updateValueAndValidity();
    }
  }

  private recordValue(source: unknown, keys: string[]): string {
    const record = source as Record<string, unknown>;

    for (const key of keys) {
      const value = key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && part in current) {
          return (current as Record<string, unknown>)[part];
        }

        return undefined;
      }, record);

      if (value !== null && value !== undefined && value !== '') {
        return String(value);
      }
    }

    return '';
  }

  private locationFromRecord(source: unknown): string {
    const city = this.recordValue(source, ['cityName', 'destinationCityName', 'om.cityName']);
    const state = this.recordValue(source, ['stateUf', 'destinationStateUf', 'om.stateUf']);
    return [city, state].filter(Boolean).join(' / ') || 'Não informado';
  }

  private dateRange(start: string | null | undefined, end: string | null | undefined): string {
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);

    if (formattedStart === 'Não informado' && formattedEnd === 'Não informado') {
      return 'Não informado';
    }

    return `${formattedStart} a ${formattedEnd}`;
  }

  private numericValue(value: unknown): number {
    const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
    return Number.isNaN(numericValue) ? 0 : numericValue;
  }

  private normalizedQuantity(value: unknown): number {
    const numericValue = this.numericValue(value);
    return numericValue > 0 ? numericValue : 0;
  }

  protected readonly formatLabel = formatLabel;
  protected readonly formatCurrency = formatCurrency;
}
