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
    <section class="workspace estimate-detail-workspace space-y-6">
      <app-page-header
        [title]="estimate()?.project?.title || 'Detalhe da estimativa'"
        [eyebrow]="estimateDisplayCode()"
        subtitle="Detalhe da estimativa com contexto do projeto, resumo executivo, itens e andamento documental."
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
            class="inline-flex rounded-[14px] bg-[linear-gradient(135deg,var(--sagep-brand),var(--sagep-brand-dark))] px-5 py-3 text-sm font-bold text-white shadow-[var(--sagep-shadow-soft)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-300"
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
            class="inline-flex rounded-[14px] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] px-5 py-3 text-sm font-semibold text-[var(--sagep-brand-dark)] transition hover:border-[var(--sagep-brand-mid)] hover:bg-[var(--sagep-brand-soft)]"
          >
            Gerar DIEx requisitório
          </button>
        }
      </app-page-header>

      @if (finalizeSuccess()) {
        <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-success-soft)] bg-[var(--sagep-success-soft)] p-5 text-sm font-semibold text-[var(--sagep-success)] shadow-[var(--sagep-shadow-soft)]">
          Estimativa finalizada com sucesso. O detalhe foi atualizado com o status mais recente.
        </div>
      }

      @if (creditNoteSuccess()) {
        <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-success-soft)] bg-[var(--sagep-success-soft)] p-5 text-sm font-semibold text-[var(--sagep-success)] shadow-[var(--sagep-shadow-soft)]">
          Nota de Crédito informada com sucesso. A geração do DIEx requisitório foi liberada.
        </div>
      }

      @if (diexSuccess()) {
        <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-success-soft)] bg-[var(--sagep-success-soft)] p-5 text-sm font-semibold text-[var(--sagep-success)] shadow-[var(--sagep-shadow-soft)]">
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
        <section class="card estimate-hero-card">
          <div class="card-body estimate-hero-body">
            <div class="estimate-hero-main">
              <p class="estimate-hero-kicker">Estimativa de preço</p>
              <div class="estimate-hero-title-row">
                <h2>{{ estimateDisplayCode() }}</h2>
                <app-status-badge [label]="formatLabel(estimate()?.status || '')" [status]="estimate()?.status" />
              </div>
              <p class="estimate-hero-copy">
                {{ estimate()?.project?.title || 'Projeto não informado' }} ·
                {{ estimate()?.om?.sigla || estimate()?.omName || 'OM não informada' }} ·
                {{ locationLabel(estimate()) }}
              </p>
              <div class="estimate-hero-tags">
                <span class="badge b-neutral">Projeto #{{ estimate()?.project?.projectCode || estimate()?.projectCode || 'N/I' }}</span>
                <span class="badge b-info">{{ (estimate()?.items ?? []).length }} item(ns)</span>
                @if (hasCreditNote()) {
                  <span class="badge b-ok">NC informada</span>
                } @else {
                  <span class="badge b-warn">NC pendente</span>
                }
                @if (hasDiexIssued()) {
                  <span class="badge b-ok">DIEx emitido</span>
                } @else if (canGenerateDiex()) {
                  <span class="badge b-info">DIEx liberado</span>
                } @else {
                  <span class="badge b-neutral">DIEx indisponível</span>
                }
              </div>
            </div>

            <app-metadata-grid
              [items]="heroFacts()"
              gridClass="sm:grid-cols-2"
              itemClass="estimate-hero-detail"
            />
          </div>
        </section>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

        <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <app-section-card
            title="Projeto vinculado"
            subtitle="Contexto carregado do projeto relacionado e situação atual do fluxo."
            bodyClass="estimate-section-stack"
          >
            <app-status-badge
              section-card-actions
              [label]="formatLabel(projectStage())"
              variantClass="b-info"
            />
            <div class="estimate-project-callout">
              <p class="estimate-project-code">Projeto #{{ estimate()?.project?.projectCode || estimate()?.projectCode || 'N/I' }}</p>
              <h3>{{ estimate()?.project?.title || 'Projeto não informado' }}</h3>
              <p>
                Fluxo atual: {{ formatLabel(projectStage()) }} · Nota de Crédito:
                {{ creditNoteLabel() }}
              </p>
            </div>
            <app-metadata-grid [items]="projectFacts()" gridClass="md:grid-cols-2" />
          </app-section-card>

          <app-section-card
            title="Dados gerais"
            subtitle="Resumo da estimativa, vínculo com ATA, cobertura, OM e observações."
            bodyClass="estimate-section-stack"
          >
            <app-status-badge
              section-card-actions
              [label]="formatLabel(estimate()?.status || '')"
              [status]="estimate()?.status"
            />
            <app-metadata-grid [items]="generalFacts()" gridClass="md:grid-cols-2" />
            <div class="estimate-note-block">
              <p class="estimate-note-label">Observações</p>
              <p>{{ estimate()?.notes | emptyValue:'Sem observações registradas nesta estimativa.' }}</p>
            </div>
          </app-section-card>
        </div>

        <app-section-card
          title="Itens da estimativa"
          subtitle="Linhas retornadas pela API com quantidades, preços unitários, subtotais e observações."
          bodyClass="estimate-section-stack"
        >
          <span section-card-actions class="text-sm text-[var(--sagep-muted)]">
            {{ (estimate()?.items ?? []).length }} item(ns)
          </span>

          @if ((estimate()?.items ?? []).length) {
            <div class="table-wrap hidden lg:block">
              <table class="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qtd.</th>
                    <th>Unidade</th>
                    <th>Valor unit.</th>
                    <th>Valor total</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of estimate()?.items ?? []; track item.id) {
                    <tr>
                      <td>
                        <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.referenceCode }} - {{ item.description }}</p>
                        <p class="mt-1 text-sm text-[var(--sagep-muted)]">
                          ATA item: {{ item.ataItem?.ataItemCode || 'Não informado' }} - {{ item.ataItem?.referenceCode || 'Sem referência' }}
                        </p>
                      </td>
                      <td>{{ item.quantity }}</td>
                      <td>{{ item.unit }}</td>
                      <td>{{ formatCurrency(item.unitPrice) }}</td>
                      <td class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(item.subtotal) }}</td>
                      <td>{{ item.notes | emptyValue:'Sem observações' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="grid gap-4 lg:hidden">
              @for (item of estimate()?.items ?? []; track item.id) {
                <article class="estimate-item-card">
                  <div>
                    <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ item.referenceCode }} - {{ item.description }}</p>
                    <p class="mt-1 text-sm text-[var(--sagep-muted)]">
                      ATA item: {{ item.ataItem?.ataItemCode || 'Não informado' }} - {{ item.ataItem?.referenceCode || 'Sem referência' }}
                    </p>
                  </div>
                  <app-metadata-grid
                    class="mt-4 block"
                    [items]="itemFacts(item)"
                    gridClass="sm:grid-cols-2"
                  />
                  <p class="text-sm text-[var(--sagep-muted)]">
                    {{ item.notes | emptyValue:'Sem observações para esta linha.' }}
                  </p>
                </article>
              }
            </div>
          } @else {
            <div class="estimate-inline-state">
              A API não retornou itens para esta estimativa.
            </div>
          }
        </app-section-card>

        <app-section-card
          title="Ações documentais"
          subtitle="Acompanhamento da finalização, da Nota de Crédito e da emissão do DIEx requisitório."
          bodyClass="estimate-section-stack"
        >
          <div class="document-action-list">
            <article class="document-action-card">
              <div>
                <p class="document-action-label">Finalização da estimativa</p>
                <h3>{{ isFinalized() ? 'Estimativa finalizada' : 'Estimativa em elaboração' }}</h3>
                <p>
                  {{ isFinalized()
                    ? 'A finalização já ocorreu e a estimativa segue pronta para o fluxo documental.'
                    : 'A estimativa ainda pode ser finalizada para avançar no fluxo.' }}
                </p>
              </div>
              @if (canFinalizeEstimate()) {
                <button
                  type="button"
                  (click)="confirmFinalizeEstimate()"
                  [disabled]="finalizing()"
                  class="estimate-action-button estimate-action-button--primary"
                >
                  {{ finalizing() ? 'Finalizando...' : 'Finalizar estimativa' }}
                </button>
              } @else {
                <app-status-badge
                  [label]="isFinalized() ? 'Concluída' : 'Sem ação disponível'"
                  [status]="isFinalized() ? 'FINALIZADA' : 'RASCUNHO'"
                  [variantClass]="isFinalized() ? 'b-ok' : 'b-neutral'"
                />
              }
            </article>

            <article class="document-action-card">
              <div>
                <p class="document-action-label">Nota de Crédito</p>
                <h3>{{ hasCreditNote() ? 'Nota de Crédito registrada' : 'Nota de Crédito pendente' }}</h3>
                <p>
                  {{ hasCreditNote()
                    ? 'O contexto do projeto já informa a Nota de Crédito exigida antes da emissão do DIEx.'
                    : 'Sem Nota de Crédito, a geração do DIEx permanece bloqueada.' }}
                </p>
              </div>
              @if (showCreditNotePrompt() && !showCreditNotePanel()) {
                <button
                  type="button"
                  (click)="toggleCreditNotePanel()"
                  class="estimate-action-button estimate-action-button--primary"
                >
                  Informar Nota de Crédito
                </button>
              } @else {
                <span class="badge" [class]="hasCreditNote() ? 'b-ok' : 'b-warn'">
                  {{ hasCreditNote() ? creditNoteLabel() : 'Aguardando informação' }}
                </span>
              }
            </article>

            <article class="document-action-card">
              <div>
                <p class="document-action-label">DIEx requisitório</p>
                <h3>
                  {{ hasDiexIssued()
                    ? 'DIEx já emitido'
                    : canGenerateDiex()
                      ? 'DIEx liberado para emissão'
                      : 'DIEx ainda indisponível' }}
                </h3>
                <p>
                  {{ hasDiexIssued()
                    ? 'A emissão já foi registrada no contexto do projeto e novas gerações permanecem bloqueadas.'
                    : canGenerateDiex()
                      ? 'Os requisitos atuais permitem emitir o DIEx requisitório.'
                      : 'A liberação depende da finalização da estimativa, da Nota de Crédito e da etapa correta do projeto.' }}
                </p>
              </div>
              @if (canGenerateDiex() && !showDiexPanel()) {
                <button
                  type="button"
                  (click)="toggleDiexPanel()"
                  class="estimate-action-button estimate-action-button--secondary"
                >
                  Gerar DIEx requisitório
                </button>
              } @else {
                <app-status-badge
                  [label]="hasDiexIssued() ? (diexNumber() || 'Emitido') : 'Sem emissão disponível'"
                  [variantClass]="hasDiexIssued() ? 'b-ok' : 'b-neutral'"
                />
              }
            </article>
          </div>

          @if (showCreditNotePrompt() && showCreditNotePanel()) {
            <section class="estimate-form-panel estimate-form-panel--warning">
              <div class="estimate-form-head">
                <div>
                  <p class="estimate-form-kicker">Etapa obrigatória</p>
                  <h3>Informar Nota de Crédito</h3>
                  <p>Antes de gerar o DIEx requisitório, registre os dados mínimos exigidos no fluxo do projeto.</p>
                </div>
              </div>
              <form [formGroup]="creditNoteForm" class="estimate-form-grid estimate-form-grid--two">
                <label class="estimate-field">
                  Número da Nota de Crédito
                  <input type="text" formControlName="creditNoteNumber" placeholder="Ex.: NC-2026-001" />
                </label>
                <label class="estimate-field">
                  Data de recebimento
                  <input type="date" formControlName="creditNoteReceivedAt" />
                </label>
              </form>
              <div class="estimate-form-actions">
                <button
                  type="button"
                  (click)="toggleCreditNotePanel()"
                  [disabled]="savingCreditNote()"
                  class="estimate-action-button estimate-action-button--ghost"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  (click)="saveCreditNote()"
                  [disabled]="creditNoteForm.invalid || savingCreditNote()"
                  class="estimate-action-button estimate-action-button--primary"
                >
                  {{ savingCreditNote() ? 'Salvando...' : 'Salvar Nota de Crédito' }}
                </button>
              </div>
            </section>
          }

          @if (showDiexPanel()) {
            <section class="estimate-form-panel">
              <div class="estimate-form-head">
                <div>
                  <p class="estimate-form-kicker">Emissão documental</p>
                  <h3>Gerar DIEx requisitório</h3>
                  <p>Informe os dados documentais mínimos exigidos pela API para emitir o DIEx a partir desta estimativa finalizada.</p>
                </div>
              </div>
              <form [formGroup]="diexForm" class="estimate-form-grid estimate-form-grid--wide">
                <label class="estimate-field">
                  CNPJ do fornecedor
                  <input type="text" formControlName="supplierCnpj" placeholder="Somente números" />
                </label>
                <label class="estimate-field">
                  Número do DIEx
                  <input type="text" formControlName="diexNumber" placeholder="Opcional" />
                </label>
                <label class="estimate-field">
                  Requisitante
                  <input type="text" formControlName="requesterName" placeholder="Opcional" />
                </label>
                <label class="estimate-field">
                  Posto/graduação
                  <input type="text" formControlName="requesterRank" placeholder="Opcional" />
                </label>
                <label class="estimate-field">
                  CPF do requisitante
                  <input type="text" formControlName="requesterCpf" placeholder="Opcional" />
                </label>
                <label class="estimate-field estimate-field--full">
                  Observações
                  <textarea formControlName="notes" rows="3" placeholder="Opcional"></textarea>
                </label>
              </form>
              <div class="estimate-form-actions">
                <button
                  type="button"
                  (click)="toggleDiexPanel()"
                  [disabled]="generatingDiex()"
                  class="estimate-action-button estimate-action-button--ghost"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  (click)="confirmGenerateDiex()"
                  [disabled]="diexForm.invalid || generatingDiex()"
                  class="estimate-action-button estimate-action-button--primary"
                >
                  {{ generatingDiex() ? 'Gerando DIEx...' : 'Confirmar geração' }}
                </button>
              </div>
            </section>
          }
        </app-section-card>

        @if (hasDiexIssued()) {
          <app-section-card
            title="Status do DIEx"
            subtitle="Dados do DIEx requisitório emitido e bloqueio de geração duplicada preservado."
            bodyClass="estimate-section-stack"
          >
            <app-status-badge section-card-actions [label]="diexNumber() || 'Emitido'" variantClass="b-ok" />
            <app-metadata-grid [items]="diexIssuedFacts()" gridClass="md:grid-cols-2" />
            <div class="estimate-inline-state estimate-inline-state--success">
              O detalhe reconhece o DIEx já emitido no contexto do projeto e mantém bloqueada uma nova geração.
            </div>
          </app-section-card>
        }
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
  readonly heroFacts = computed<MetadataItem[]>(() => {
    const estimate = this.estimate();
    return [
      { label: 'Valor total', value: formatCurrency(estimate?.totalAmount), highlight: true },
      { label: 'Criada em', value: formatDate(estimate?.createdAt) },
      { label: 'Atualizada em', value: formatDate(estimate?.updatedAt || estimate?.createdAt) },
      { label: 'Ata vinculada', value: estimate?.ata ? `ATA #${estimate.ata.ataCode} - ${estimate.ata.number}` : 'Não informado' },
    ];
  });
  readonly summaryCards = computed(() => {
    const estimate = this.estimate();
    const itemsCount = estimate?.items?.length ?? 0;

    return [
      {
        title: 'Valor total',
        value: formatCurrency(estimate?.totalAmount),
        description: 'Consolidado financeiro da estimativa',
        icon: 'R$',
        tone: 'accent' as const,
      },
      {
        title: 'Itens',
        value: String(itemsCount),
        description: 'Linhas retornadas pela API',
        icon: 'IT',
        tone: 'soft' as const,
      },
      {
        title: 'Nota de Crédito',
        value: this.hasCreditNote() ? 'Informada' : 'Pendente',
        description: this.hasCreditNote() ? this.creditNoteLabel() : 'Obrigatória antes da emissão do DIEx',
        icon: 'NC',
        tone: this.hasCreditNote() ? ('success' as const) : ('warning' as const),
      },
      {
        title: 'DIEx',
        value: this.hasDiexIssued() ? (this.diexNumber() || 'Emitido') : this.canGenerateDiex() ? 'Liberado' : 'Pendente',
        description: this.hasDiexIssued()
          ? 'Emissão já registrada'
          : this.canGenerateDiex()
            ? 'Pronto para gerar'
            : 'Aguardando requisitos do fluxo',
        icon: 'DX',
        tone: this.hasDiexIssued() ? ('success' as const) : this.canGenerateDiex() ? ('soft' as const) : ('warning' as const),
      },
    ];
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
  readonly projectFacts = computed<MetadataItem[]>(() => {
    const details = this.projectDetails();
    const project = details?.project;
    const nextAction = details?.workflow?.nextAction;
    const owner = project?.owner?.name || project?.ownerName;

    return [
      { label: 'Status do projeto', value: formatLabel(project?.status || details?.workflow?.status || '') || 'Não informado' },
      { label: 'Próxima ação', value: nextAction?.label || 'Não informada', description: nextAction?.description ? String(nextAction.description) : undefined },
      { label: 'Responsável', value: owner || 'Não informado' },
      { label: 'Pendências abertas', value: String(details?.pendingActions?.length ?? 0) },
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

  itemFacts(item: NonNullable<Estimate['items']>[number]): MetadataItem[] {
    return [
      { label: 'Quantidade', value: item.quantity },
      { label: 'Unidade', value: item.unit },
      { label: 'Valor unitário', value: formatCurrency(item.unitPrice) },
      { label: 'Subtotal', value: formatCurrency(item.subtotal), highlight: true },
    ];
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
