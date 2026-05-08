import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, map, of, switchMap, throwError } from 'rxjs';

import { ProjectsService } from '../../core/services/projects.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card.component';
import { extractProjectCodeFromFriendlyIdentifier } from '../../shared/utils/format.util';
import { getErrorMessage } from '../../shared/utils/http-error.util';
import { ReportsService } from './reports.service';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent, SectionCardComponent],
  template: `
    <section class="workspace">
      <app-page-header
        title="Relatórios"
        eyebrow="Governança"
        subtitle="Central de exportações e documentos consolidados do projeto."
        badge="Exportações"
      />

      <div class="grid grid-2 project-main-grid">
        <app-section-card
          title="Exportar projetos XLSX"
          subtitle="Baixe a planilha consolidada de projetos."
        >
          <div class="next-action-card">
            <span class="badge b-neutral">Planilha</span>
            <h3>Projetos consolidados</h3>
            <p>Exportação pronta para análise externa e acompanhamento operacional.</p>
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="projectsLoading()"
              (click)="exportProjects()"
            >
              {{ projectsLoading() ? 'Gerando...' : 'Exportar projetos XLSX' }}
            </button>
          </div>
          @if (projectsError()) {
            <div class="form-alert">{{ projectsError() }}</div>
          }
        </app-section-card>

        <app-section-card
          title="Dossiê do projeto"
          subtitle="Informe o ID ou código do projeto para abrir o documento consolidado."
        >
          <form
            [formGroup]="dossierForm"
            class="document-actions-panel"
            (ngSubmit)="openDossierHtml()"
          >
            <label class="form-field">
              <span>Projeto</span>
              <input
                type="text"
                formControlName="projectIdentifier"
                class="input"
                placeholder="ID ou código do projeto"
                autocomplete="off"
              />
            </label>

            <div class="document-actions">
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="dossierLoading() || dossierForm.invalid"
              >
                {{ dossierLoading() === 'html' ? 'Abrindo...' : 'Abrir dossiê HTML' }}
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                [disabled]="!!dossierLoading() || dossierForm.invalid"
                (click)="openDossierPdf()"
              >
                {{ dossierLoading() === 'pdf' ? 'Abrindo...' : 'Abrir dossiê PDF' }}
              </button>
            </div>
          </form>

          @if (dossierError()) {
            <div class="form-alert">{{ dossierError() }}</div>
          }
        </app-section-card>
      </div>
    </section>
  `,
})
export class ReportsPageComponent {
  private readonly reportsService = inject(ReportsService);
  private readonly projectsService = inject(ProjectsService);
  private readonly fb = inject(FormBuilder);

  readonly projectsLoading = signal(false);
  readonly projectsError = signal('');
  readonly dossierLoading = signal<'' | 'html' | 'pdf'>('');
  readonly dossierError = signal('');

  readonly dossierForm = this.fb.nonNullable.group({
    projectIdentifier: ['', [Validators.required]],
  });

  exportProjects(): void {
    this.projectsLoading.set(true);
    this.projectsError.set('');

    this.reportsService.exportProjectsXlsx().subscribe({
      next: (blob) => {
        this.openBlobWindow(
          new Blob([blob], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        );
        this.projectsLoading.set(false);
      },
      error: (error) => {
        this.projectsError.set(getErrorMessage(error, 'Não foi possível exportar os projetos.'));
        this.projectsLoading.set(false);
      },
    });
  }

  openDossierHtml(): void {
    if (this.dossierForm.invalid) {
      this.dossierForm.markAllAsTouched();
      return;
    }

    this.dossierLoading.set('html');
    this.dossierError.set('');

    this.resolveProjectDossierId()
      .pipe(
        switchMap((projectId) => this.reportsService.getProjectDossierHtml(projectId)),
        catchError((error) => throwError(() => this.normalizeDossierError(error))),
      )
      .subscribe({
        next: (blob) => {
          this.openBlobWindow(new Blob([blob], { type: 'text/html' }));
          this.dossierLoading.set('');
        },
        error: (error) => {
          this.dossierError.set(
            getErrorMessage(error, 'Não foi possível abrir o dossiê HTML do projeto.'),
          );
          this.dossierLoading.set('');
        },
      });
  }

  openDossierPdf(): void {
    if (this.dossierForm.invalid) {
      this.dossierForm.markAllAsTouched();
      return;
    }

    this.dossierLoading.set('pdf');
    this.dossierError.set('');

    this.resolveProjectDossierId()
      .pipe(
        switchMap((projectId) => this.reportsService.getProjectDossierPdf(projectId)),
        catchError((error) => throwError(() => this.normalizeDossierError(error))),
      )
      .subscribe({
        next: (blob) => {
          this.openBlobWindow(new Blob([blob], { type: 'application/pdf' }));
          this.dossierLoading.set('');
        },
        error: (error) => {
          this.dossierError.set(
            getErrorMessage(error, 'Não foi possível abrir o dossiê PDF do projeto.'),
          );
          this.dossierLoading.set('');
        },
      });
  }

  private resolveProjectDossierId() {
    const identifier = this.projectIdentifier();
    const codeCandidate = extractProjectCodeFromFriendlyIdentifier(identifier);
    const shouldUseProjectCode = identifier !== codeCandidate || /^\d+$/.test(identifier);

    if (!shouldUseProjectCode) {
      return of(identifier);
    }

    const projectCode = String(Number.parseInt(codeCandidate, 10));

    return this.projectsService.getByCode(projectCode).pipe(map((project) => project.id));
  }

  private normalizeDossierError(error: unknown): unknown {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return new Error('Projeto não encontrado. Verifique o ID ou código informado.');
    }

    return error;
  }

  private projectIdentifier(): string {
    return this.dossierForm.controls.projectIdentifier.value.trim();
  }

  private openBlobWindow(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
