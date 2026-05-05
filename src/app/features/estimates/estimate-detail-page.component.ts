import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, throwError } from 'rxjs';

import { Diex } from '../../core/models/diex.model';
import { ProjectDetails } from '../../core/models/project.model';
import { AuthService } from '../../core/services/auth.service';
import { DiexService } from '../../core/services/diex.service';
import { ProjectsService } from '../../core/services/projects.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MetadataGridComponent, MetadataItem } from '../../shared/components/metadata-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { EmptyValuePipe } from '../../shared/pipes/empty-value.pipe';
import {
  buildEstimateIdentifier,
  extractEstimateCodeFromFriendlyIdentifier,
  formatCurrency,
  formatDate,
  formatLabel,
} from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { Estimate } from './estimate.model';
import { EstimatesService } from './estimates.service';

@Component({
  selector: 'app-estimate-detail-page',
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
    StatusBadgeComponent,
    SummaryCardComponent,
  ],
  template: `
    <section class="space-y-6">
      <app-page-header
        [title]="estimate()?.project?.title || 'Detalhe da estimativa'"
        [eyebrow]="estimateDisplayCode()"
        subtitle="Detalhe da estimativa com vínculo ao projeto, resumo geral e itens retornados pela API."
        badge="Fonte: GET /estimates/:identifier"
        backLabel="← Voltar para estimativas"
        backLink="/estimates"
      >
        @if (canFinalizeEstimate()) {
          <button
            page-header-actions
            type="button"
            (click)="confirmFinalizeEstimate()"
            [disabled]="finalizing()"
            class="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {{ finalizing() ? 'Finalizando...' : 'Finalizar estimativa' }}
          </button>
        } @else if (isFinalized()) {
          <span
            page-header-actions
            class="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs uppercase tracking-[0.18em] text-emerald-700"
          >
            Estimativa finalizada
          </span>
        }
        @if (canGenerateDiex()) {
          <button
            page-header-actions
            type="button"
            (click)="toggleDiexPanel()"
            class="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Gerar DIEx requisitório
          </button>
        }
      </app-page-header>

      @if (finalizeSuccess()) {
        <div class="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800 shadow-[var(--sagep-shadow)]">
          Estimativa finalizada com sucesso. O detalhe foi atualizado com o status mais recente.
        </div>
      }

      @if (creditNoteSuccess()) {
        <div class="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800 shadow-[var(--sagep-shadow)]">
          Nota de Crédito informada com sucesso. A geração do DIEx requisitório foi liberada.
        </div>
      }

      @if (diexSuccess()) {
        <div class="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800 shadow-[var(--sagep-shadow)]">
          DIEx requisitório gerado com sucesso{{ createdDiexLabel() ? ': ' + createdDiexLabel() : '' }}.
        </div>
      }

      @if (finalizeForbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite finalizar esta estimativa."
          description="A API recusou a operação de finalização para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/estimates"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (finalizeError()) {
        <app-error-state title="Não foi possível finalizar a estimativa" [message]="finalizeError()" retryLabel="" />
      }

      @if (creditNoteForbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite informar a Nota de Crédito."
          description="A API recusou a atualização do fluxo do projeto para o perfil ou permissões atuais."
          primaryLink="/estimates"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (creditNoteError()) {
        <app-error-state title="Não foi possível informar a Nota de Crédito" [message]="creditNoteError()" retryLabel="" />
      }

      @if (diexForbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite gerar DIEx requisitório."
          description="A API recusou a emissão do DIEx para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/estimates"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (diexError()) {
        <app-error-state title="Não foi possível gerar o DIEx requisitório" [message]="diexError()" retryLabel="" />
      }

      @if (loading()) {
        <app-loading-state variant="detail" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite abrir esta estimativa."
          description="O backend bloqueou a visualização detalhada deste registro. Você pode voltar para a listagem sem encerrar a sessão."
          primaryLink="/estimates"
          primaryLabel="Voltar à listagem"
          secondaryLink="/dashboard"
          secondaryLabel="Ir para o dashboard"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar o detalhe da estimativa"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="reload()"
        />
      } @else if (!estimate()) {
        <app-empty-state
          eyebrow="Sem dados"
          title="O backend não retornou conteúdo para esta estimativa"
          description="Retorne para a listagem e selecione outro registro."
        />
      } @else {
        @if (hasDiexIssued()) {
          <app-section-card title="DIEx requisitório já emitido">
            <app-metadata-grid [items]="diexIssuedFacts()" gridClass="md:grid-cols-2" />
          </app-section-card>
        }

        @if (showCreditNotePrompt()) {
          <app-section-card
            title="Nota de Crédito pendente"
            subtitle="Antes de gerar o DIEx requisitório, informe a Nota de Crédito do projeto."
          >
            @if (!showCreditNotePanel()) {
              <div class="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <p class="text-sm leading-6">
                  A estimativa já está finalizada, mas o projeto ainda não possui Nota de Crédito informada.
                  Essa etapa é obrigatória antes da emissão do DIEx requisitório.
                </p>
                <button
                  type="button"
                  (click)="toggleCreditNotePanel()"
                  class="mt-5 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Informar Nota de Crédito
                </button>
              </div>
            } @else {
              <form [formGroup]="creditNoteForm" class="grid gap-4 md:grid-cols-2">
                <label class="text-sm font-medium text-slate-700">
                  Número da Nota de Crédito
                  <input
                    type="text"
                    formControlName="creditNoteNumber"
                    class="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
                    placeholder="Ex.: NC-2026-001"
                  />
                </label>
                <label class="text-sm font-medium text-slate-700">
                  Data de recebimento
                  <input
                    type="date"
                    formControlName="creditNoteReceivedAt"
                    class="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
                  />
                </label>
              </form>
              <div class="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-end">
                <button
                  type="button"
                  (click)="toggleCreditNotePanel()"
                  [disabled]="savingCreditNote()"
                  class="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  (click)="saveCreditNote()"
                  [disabled]="creditNoteForm.invalid || savingCreditNote()"
                  class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {{ savingCreditNote() ? 'Salvando...' : 'Salvar Nota de Crédito' }}
                </button>
              </div>
            }
          </app-section-card>
        }

        @if (showDiexPanel()) {
          <app-section-card
            title="Gerar DIEx requisitório"
            subtitle="Informe os dados documentais mínimos exigidos pela API para emitir o DIEx a partir desta estimativa finalizada."
          >
            <form [formGroup]="diexForm" class="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <label class="text-sm font-medium text-slate-700">
                CNPJ do fornecedor
                <input
                  type="text"
                  formControlName="supplierCnpj"
                  class="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
                  placeholder="Somente números"
                />
              </label>
              <label class="text-sm font-medium text-slate-700">
                Número do DIEx
                <input
                  type="text"
                  formControlName="diexNumber"
                  class="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
                  placeholder="Opcional"
                />
              </label>
              <label class="text-sm font-medium text-slate-700">
                Requisitante
                <input
                  type="text"
                  formControlName="requesterName"
                  class="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
                  placeholder="Opcional"
                />
              </label>
              <label class="text-sm font-medium text-slate-700">
                Posto/graduação
                <input
                  type="text"
                  formControlName="requesterRank"
                  class="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
                  placeholder="Opcional"
                />
              </label>
              <label class="text-sm font-medium text-slate-700">
                CPF do requisitante
                <input
                  type="text"
                  formControlName="requesterCpf"
                  class="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
                  placeholder="Opcional"
                />
              </label>
              <label class="text-sm font-medium text-slate-700 lg:col-span-2">
                Observações
                <textarea
                  formControlName="notes"
                  rows="3"
                  class="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
                  placeholder="Opcional"
                ></textarea>
              </label>
            </form>
            <div class="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-end">
              <button
                type="button"
                (click)="toggleDiexPanel()"
                [disabled]="generatingDiex()"
                class="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmGenerateDiex()"
                [disabled]="diexForm.invalid || generatingDiex()"
                class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {{ generatingDiex() ? 'Gerando DIEx...' : 'Confirmar geração' }}
              </button>
            </div>
          </app-section-card>
        }

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          @for (item of highlightFacts(); track item.label) {
            <app-summary-card [title]="item.label" [value]="item.value" tone="soft" />
          }
        </div>

        <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <app-section-card title="Dados gerais" subtitle="Resumo do vínculo com projeto, ata, grupo de cobertura e OM.">
            <app-status-badge
              section-card-actions
              [label]="formatLabel(estimate()?.status || '')"
              [status]="estimate()?.status"
            />
            <app-metadata-grid class="mt-5 block" [items]="generalFacts()" />
          </app-section-card>

          <app-section-card title="Projeto vinculado e observações">
            <div class="mt-5 rounded-[1.75rem] border border-teal-200 bg-teal-50 p-5">
              <p class="text-xs uppercase tracking-[0.18em] text-teal-700">Projeto vinculado</p>
              <p class="mt-3 text-lg font-semibold text-teal-950">
                #{{ estimate()?.project?.projectCode || estimate()?.projectCode }} - {{ estimate()?.project?.title || 'Projeto não informado' }}
              </p>
              <p class="mt-2 text-sm leading-6 text-teal-900/80">
                Fase do projeto: {{ formatLabel(projectStage()) }}
              </p>
              <p class="mt-1 text-sm leading-6 text-teal-900/80">
                Nota de Crédito: {{ creditNoteLabel() }}
              </p>
            </div>
            <div class="mt-5 rounded-[1.75rem] border border-slate-200 p-5">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Observações</p>
              <p class="mt-3 text-sm leading-6 text-slate-700">
                {{ estimate()?.notes | emptyValue:'Sem observações registradas nesta estimativa.' }}
              </p>
            </div>
          </app-section-card>
        </div>

        <app-section-card title="Itens da estimativa" subtitle="Linhas retornadas pela API com quantidades, preços unitários, subtotais e observações.">
          <span section-card-actions class="text-sm text-slate-500">{{ (estimate()?.items ?? []).length }} item(ns)</span>

          @if ((estimate()?.items ?? []).length) {
            <div class="mt-6 hidden overflow-x-auto lg:block">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr class="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                    <th class="px-4 py-3">Item</th>
                    <th class="px-4 py-3">Qtd.</th>
                    <th class="px-4 py-3">Unidade</th>
                    <th class="px-4 py-3">Valor unit.</th>
                    <th class="px-4 py-3">Valor total</th>
                    <th class="px-4 py-3">Observações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (item of estimate()?.items ?? []; track item.id) {
                    <tr class="align-top">
                      <td class="px-4 py-4">
                        <p class="font-semibold text-slate-900">{{ item.referenceCode }} - {{ item.description }}</p>
                        <p class="mt-1 text-sm text-slate-500">
                          ATA item: {{ item.ataItem?.ataItemCode || 'Não informado' }} - {{ item.ataItem?.referenceCode || 'Sem referência' }}
                        </p>
                      </td>
                      <td class="px-4 py-4 text-sm text-slate-700">{{ item.quantity }}</td>
                      <td class="px-4 py-4 text-sm text-slate-700">{{ item.unit }}</td>
                      <td class="px-4 py-4 text-sm text-slate-700">{{ formatCurrency(item.unitPrice) }}</td>
                      <td class="px-4 py-4 text-sm font-semibold text-slate-900">{{ formatCurrency(item.subtotal) }}</td>
                      <td class="px-4 py-4 text-sm text-slate-700">{{ item.notes | emptyValue:'Sem observações' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="mt-6 grid gap-4 lg:hidden">
              @for (item of estimate()?.items ?? []; track item.id) {
                <article class="rounded-[1.5rem] border border-slate-200 p-4">
                  <p class="font-semibold text-slate-900">{{ item.referenceCode }} - {{ item.description }}</p>
                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <div class="rounded-2xl bg-slate-50 p-3">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Quantidade</p>
                      <p class="mt-2 text-sm font-medium text-slate-900">{{ item.quantity }}</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 p-3">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Unidade</p>
                      <p class="mt-2 text-sm font-medium text-slate-900">{{ item.unit }}</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 p-3">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Valor unitário</p>
                      <p class="mt-2 text-sm font-medium text-slate-900">{{ formatCurrency(item.unitPrice) }}</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 p-3">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Subtotal</p>
                      <p class="mt-2 text-sm font-medium text-slate-900">{{ formatCurrency(item.subtotal) }}</p>
                    </div>
                  </div>
                  <p class="mt-4 text-sm text-slate-600">{{ item.notes | emptyValue:'Sem observações para esta linha.' }}</p>
                </article>
              }
            </div>
          } @else {
            <div class="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              A API não retornou itens para esta estimativa.
            </div>
          }
        </app-section-card>
      }
    </section>
  `,
})
export class EstimateDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly diexService = inject(DiexService);
  private readonly estimatesService = inject(EstimatesService);
  private readonly projectsService = inject(ProjectsService);

  readonly creditNoteForm = this.fb.nonNullable.group({
    creditNoteNumber: ['', Validators.required],
    creditNoteReceivedAt: [''],
  });
  readonly diexForm = this.fb.nonNullable.group({
    supplierCnpj: ['', [Validators.required, Validators.minLength(14)]],
    diexNumber: [''],
    requesterName: [''],
    requesterRank: [''],
    requesterCpf: [''],
    notes: [''],
  });

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly finalizing = signal(false);
  readonly finalizeError = signal('');
  readonly finalizeForbidden = signal(false);
  readonly finalizeSuccess = signal(false);
  readonly showCreditNotePanel = signal(false);
  readonly savingCreditNote = signal(false);
  readonly creditNoteError = signal('');
  readonly creditNoteForbidden = signal(false);
  readonly creditNoteSuccess = signal(false);
  readonly showDiexPanel = signal(false);
  readonly generatingDiex = signal(false);
  readonly diexError = signal('');
  readonly diexForbidden = signal(false);
  readonly diexSuccess = signal(false);
  readonly createdDiex = signal<Diex | null>(null);
  readonly estimate = signal<Estimate | null>(null);
  readonly projectDetails = signal<ProjectDetails | null>(null);
  private estimateIdentifier: string | null = null;

  readonly estimateDisplayCode = computed(() => {
    const estimate = this.estimate();
    return estimate ? buildEstimateIdentifier(estimate.estimateCode, estimate.id, estimate.createdAt) : 'Estimativa';
  });
  readonly isFinalized = computed(() => this.estimate()?.status === 'FINALIZADA');
  readonly projectStage = computed(() => this.projectDetails()?.workflow?.stage || this.estimateProjectValue('stage') || 'Não informado');
  readonly hasCreditNote = computed(() => {
    const milestones = this.projectDetails()?.workflow?.milestones ?? {};
    return Boolean(
      milestones['creditNoteNumber'] ||
        milestones['creditNoteReceivedAt'] ||
        this.estimateProjectValue('creditNoteNumber') ||
        this.estimateProjectValue('creditNoteReceivedAt'),
    );
  });
  readonly creditNoteLabel = computed(() => {
    const milestones = this.projectDetails()?.workflow?.milestones ?? {};
    return String(
      milestones['creditNoteNumber'] ||
        this.estimateProjectValue('creditNoteNumber') ||
        'Não informada',
    );
  });
  readonly canFinalizeEstimate = computed(() => {
    const role = this.authService.getUserRole();
    const status = this.estimate()?.status as string | undefined;
    const isDraft = status === 'RASCUNHO' || status === 'DRAFT';
    const hasPermission = this.authService.hasAnyPermission(['estimates.finalize', 'estimates.edit']);
    const roleAllowed = role === 'ADMIN' || role === 'GESTOR' || role === 'PROJETISTA';

    return isDraft && (hasPermission || roleAllowed);
  });
  readonly hasLinkedDiex = computed(() => {
    const estimate = this.estimate() as (Estimate & Record<string, unknown>) | null;

    if (!estimate) return false;

    return Boolean(
      estimate['diexId'] ||
        estimate['diexRequestId'] ||
        estimate['diex'] ||
        estimate['diexRequest'] ||
        (Array.isArray(estimate['diexRequests']) && estimate['diexRequests'].length),
    );
  });
  readonly hasDiexIssued = computed(() => Boolean(this.diexNumber() || this.diexIssuedAt() || this.hasLinkedDiex()));
  readonly diexNumber = computed(() => {
    const details = this.projectDetails();
    const milestones = details?.workflow?.milestones ?? {};
    const project = details?.project as Record<string, unknown> | undefined;
    const documents = details?.documents ?? {};
    const diexRequests = this.asRecordArray(documents['diexRequests'] ?? documents['diex'] ?? documents['diexRequest']);
    const firstDiex = diexRequests[0];

    return this.firstValue([
      milestones['diexNumber'],
      project?.['diexNumber'],
      firstDiex?.['diexNumber'],
      firstDiex?.['number'],
      firstDiex?.['diexCode'],
      firstDiex?.['code'],
      this.createdDiex()?.diexNumber,
      this.createdDiex()?.number,
      this.createdDiex()?.diexCode,
      this.createdDiex()?.code,
    ]);
  });
  readonly diexIssuedAt = computed(() => {
    const details = this.projectDetails();
    const milestones = details?.workflow?.milestones ?? {};
    const project = details?.project as Record<string, unknown> | undefined;
    const documents = details?.documents ?? {};
    const diexRequests = this.asRecordArray(documents['diexRequests'] ?? documents['diex'] ?? documents['diexRequest']);
    const firstDiex = diexRequests[0];

    return this.firstValue([
      milestones['diexIssuedAt'],
      project?.['diexIssuedAt'],
      firstDiex?.['issuedAt'],
      firstDiex?.['createdAt'],
      this.createdDiex()?.issuedAt,
      this.createdDiex()?.createdAt,
    ]);
  });
  readonly diexIssuedFacts = computed<MetadataItem[]>(() => [
    { label: 'Número do DIEx', value: this.diexNumber() || 'Não informado', highlight: true },
    { label: 'Emitido em', value: this.diexIssuedAt() ? formatDate(this.diexIssuedAt()) : 'Não informado' },
  ]);
  readonly canInformCreditNote = computed(() => {
    const role = this.authService.getUserRole();
    return this.authService.hasAnyPermission(['projects.edit_own', 'projects.edit_all']) ||
      role === 'ADMIN' ||
      role === 'GESTOR' ||
      role === 'PROJETISTA';
  });
  readonly showCreditNotePrompt = computed(() =>
    this.isFinalized() && !this.hasCreditNote() && !this.hasLinkedDiex() && this.canInformCreditNote(),
  );
  readonly canGenerateDiex = computed(() => {
    const role = this.authService.getUserRole();
    const hasPermission = this.authService.hasAnyPermission(['diex.issue']);
    const roleAllowed = role === 'ADMIN' || role === 'GESTOR' || role === 'PROJETISTA';
    const compatibleStage = ['DIEX_REQUISITORIO', 'AGUARDANDO_NOTA_EMPENHO', 'OS_LIBERADA'].includes(this.projectStage());

    return this.isFinalized() &&
      this.hasCreditNote() &&
      compatibleStage &&
      !this.hasDiexIssued() &&
      (hasPermission || roleAllowed);
  });
  readonly createdDiexLabel = computed(() => {
    const diex = this.createdDiex();
    if (!diex) return '';
    return diex.diexNumber || diex.number || (diex.diexCode ? `DIEx #${diex.diexCode}` : diex.id);
  });
  readonly highlightFacts = computed(() => {
    const estimate = this.estimate();
    return [
      { label: 'Status', value: formatLabel(estimate?.status ?? '') },
      { label: 'Projeto', value: estimate?.project?.projectCode ? `#${estimate.project.projectCode}` : `#${estimate?.projectCode ?? '-'}` },
      { label: 'OM', value: estimate?.om?.sigla || estimate?.omName || 'Não informado' },
      { label: 'Cidade / UF', value: this.locationLabel(estimate) },
      { label: 'Valor total', value: formatCurrency(estimate?.totalAmount) },
    ];
  });
  readonly generalFacts = computed<MetadataItem[]>(() => {
    const estimate = this.estimate();
    return [
      { label: 'Código da estimativa', value: estimate?.estimateCode ? `EST-${estimate.estimateCode}` : 'Não informado' },
      { label: 'Projeto vinculado', value: estimate?.project?.title || 'Não informado' },
      { label: 'Ata', value: estimate?.ata ? `ATA #${estimate.ata.ataCode} - ${estimate.ata.number}` : 'Não informado' },
      { label: 'Fornecedor', value: estimate?.ata?.vendorName || 'Não informado' },
      { label: 'Grupo de cobertura', value: estimate?.coverageGroup ? `${estimate.coverageGroup.code} - ${estimate.coverageGroup.name}` : 'Não informado' },
      { label: 'OM', value: estimate?.om ? `${estimate.om.sigla} - ${estimate.om.name}` : estimate?.omName || 'Não informado' },
      { label: 'Criada em', value: formatDate(estimate?.createdAt) },
      { label: 'Atualizada em', value: formatDate(estimate?.updatedAt || estimate?.createdAt) },
    ];
  });

  ngOnInit(): void {
    this.estimateIdentifier = this.route.snapshot.paramMap.get('id');

    if (!this.estimateIdentifier) {
      this.errorMessage.set('Identificador da estimativa não informado na rota.');
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  reload(showLoading = true): void {
    if (!this.estimateIdentifier) return;

    if (showLoading) this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const routeIdentifier = this.estimateIdentifier;
    const codeCandidate = extractEstimateCodeFromFriendlyIdentifier(routeIdentifier);
    const shouldTryCodeLookup = routeIdentifier !== codeCandidate || /^\d+$/.test(routeIdentifier.trim());
    const estimateRequest$ = shouldTryCodeLookup
      ? this.estimatesService.getByCode(codeCandidate).pipe(catchError(() => this.estimatesService.getByIdentifier(routeIdentifier)))
      : this.estimatesService.getByIdentifier(routeIdentifier).pipe(
          catchError((originalError) =>
            this.estimatesService.getByCode(codeCandidate).pipe(catchError(() => throwError(() => originalError))),
          ),
        );

    estimateRequest$.subscribe({
      next: (response) => {
        this.estimate.set(response);
        this.loadProjectContext(response);
        if (showLoading) this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Estimativa não encontrada ou sem permissão de acesso.'));
        this.estimate.set(null);
        this.projectDetails.set(null);
        if (showLoading) this.loading.set(false);
      },
    });
  }

  locationLabel(estimate: Estimate | null): string {
    const city = estimate?.om?.cityName || estimate?.destinationCityName;
    const state = estimate?.om?.stateUf || estimate?.destinationStateUf;
    return [city, state].filter(Boolean).join(' / ') || 'Não informado';
  }

  confirmFinalizeEstimate(): void {
    const estimate = this.estimate();
    if (!estimate || !this.canFinalizeEstimate()) return;

    if (!window.confirm('Deseja finalizar esta estimativa? Após a finalização, ela poderá avançar no fluxo documental.')) {
      return;
    }

    this.finalizeEstimate(estimate.id);
  }

  toggleCreditNotePanel(): void {
    this.showCreditNotePanel.update((visible) => !visible);
    this.clearCreditNoteFeedback();
  }

  saveCreditNote(): void {
    const estimate = this.estimate();
    const projectId = estimate?.project?.id || estimate?.projectId;

    if (!projectId) {
      this.creditNoteError.set('Projeto vinculado não informado para esta estimativa.');
      return;
    }

    if (this.creditNoteForm.invalid) {
      this.creditNoteForm.markAllAsTouched();
      return;
    }

    this.savingCreditNote.set(true);
    this.clearCreditNoteFeedback();

    const formValue = this.creditNoteForm.getRawValue();
    this.projectsService
      .updateFlow(projectId, {
        stage: 'DIEX_REQUISITORIO',
        creditNoteNumber: formValue.creditNoteNumber,
        creditNoteReceivedAt: formValue.creditNoteReceivedAt
          ? new Date(`${formValue.creditNoteReceivedAt}T00:00:00`).toISOString()
          : new Date().toISOString(),
      })
      .pipe(finalize(() => this.savingCreditNote.set(false)))
      .subscribe({
        next: () => {
          this.creditNoteSuccess.set(true);
          this.showCreditNotePanel.set(false);
          this.reload(false);
        },
        error: (error) => {
          this.creditNoteForbidden.set(isForbiddenError(error));
          this.creditNoteError.set(getErrorMessage(error, 'Falha ao informar a Nota de Crédito.'));
        },
      });
  }

  toggleDiexPanel(): void {
    this.showDiexPanel.update((visible) => !visible);
    this.clearDiexFeedback();
  }

  confirmGenerateDiex(): void {
    const estimate = this.estimate();
    if (!estimate || !this.canGenerateDiex()) return;

    if (this.diexForm.invalid || this.onlyDigits(this.diexForm.controls.supplierCnpj.value).length < 14) {
      this.diexForm.markAllAsTouched();
      this.diexError.set('Informe o CNPJ do fornecedor com ao menos 14 dígitos.');
      return;
    }

    if (!window.confirm('Deseja gerar o DIEx requisitório desta estimativa? O documento será vinculado ao projeto e dará continuidade ao fluxo documental.')) {
      return;
    }

    this.generateDiex(estimate);
  }

  private loadProjectContext(estimate: Estimate): void {
    const projectId = estimate.project?.id || estimate.projectId;
    if (!projectId) {
      this.projectDetails.set(null);
      return;
    }

    this.projectsService.getDetails(projectId).subscribe({
      next: (details) => this.projectDetails.set(details),
      error: () => this.projectDetails.set(null),
    });
  }

  private generateDiex(estimate: Estimate): void {
    this.generatingDiex.set(true);
    this.clearDiexFeedback();

    const formValue = this.diexForm.getRawValue();
    const payload = {
      projectId: estimate.project?.id || estimate.projectId,
      estimateId: estimate.id,
      supplierCnpj: this.onlyDigits(formValue.supplierCnpj),
      diexNumber: formValue.diexNumber || undefined,
      requesterName: formValue.requesterName || undefined,
      requesterRank: formValue.requesterRank || undefined,
      requesterCpf: formValue.requesterCpf ? this.onlyDigits(formValue.requesterCpf) : undefined,
      notes: formValue.notes || undefined,
    };

    this.diexService
      .createDiex(payload)
      .pipe(finalize(() => this.generatingDiex.set(false)))
      .subscribe({
        next: (diex) => {
          this.createdDiex.set(diex);
          this.diexSuccess.set(true);
          this.showDiexPanel.set(false);
          this.reload(false);
        },
        error: (error) => {
          this.diexForbidden.set(isForbiddenError(error));
          this.diexError.set(getErrorMessage(error, 'Falha ao gerar o DIEx requisitório.'));
        },
      });
  }

  private finalizeEstimate(id: string): void {
    this.finalizing.set(true);
    this.clearFinalizeFeedback();

    this.estimatesService
      .finalizeEstimate(id)
      .pipe(finalize(() => this.finalizing.set(false)))
      .subscribe({
        next: (response) => {
          this.finalizeSuccess.set(true);
          this.estimate.set(response);
          this.loadProjectContext(response);
        },
        error: (error) => {
          this.finalizeForbidden.set(isForbiddenError(error));
          this.finalizeError.set(getErrorMessage(error, 'Falha ao finalizar a estimativa.'));
        },
      });
  }

  private estimateProjectValue(key: string): string {
    const project = this.estimate()?.project as Record<string, unknown> | undefined;
    const value = project?.[key];
    return value ? String(value) : '';
  }

  private asRecordArray(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
    }

    if (value && typeof value === 'object') {
      return [value as Record<string, unknown>];
    }

    return [];
  }

  private firstValue(values: unknown[]): string {
    const value = values.find((item) => item !== null && item !== undefined && item !== '');
    return value ? String(value) : '';
  }

  private clearFinalizeFeedback(): void {
    this.finalizeError.set('');
    this.finalizeForbidden.set(false);
    this.finalizeSuccess.set(false);
  }

  private clearCreditNoteFeedback(): void {
    this.creditNoteError.set('');
    this.creditNoteForbidden.set(false);
    this.creditNoteSuccess.set(false);
  }

  private clearDiexFeedback(): void {
    this.diexError.set('');
    this.diexForbidden.set(false);
    this.diexSuccess.set(false);
  }

  private onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
  }

  protected readonly formatLabel = formatLabel;
  protected readonly formatDate = formatDate;
  protected readonly formatCurrency = formatCurrency;
}
