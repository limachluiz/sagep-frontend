import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { getErrorMessage } from '../../../shared/utils/http-error.util';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="mx-auto flex w-full max-w-md flex-col justify-center">
      <div class="mb-8 lg:hidden">
        <p class="text-xs font-bold uppercase tracking-[0.28em] text-[var(--sagep-brand)]">4º CTA · Exército Brasileiro</p>
        <h1 class="mt-3 text-3xl font-semibold leading-tight text-[var(--sagep-brand-deep)]">SAGEP</h1>
        <p class="mt-2 text-sm text-[var(--sagep-muted)]">Sistema de Apoio à Gestão de Projetos</p>
      </div>

      <div class="rounded-[24px] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-6 shadow-[var(--sagep-shadow)] sm:p-8">
        <div class="mb-8 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.22em] text-[var(--sagep-brand)]">Acesso ao sistema</p>
            <h2 class="mt-3 text-3xl font-semibold text-[var(--sagep-brand-deep)]">Entrar no SAGEP</h2>
          </div>
          <div class="hidden h-12 w-12 place-items-center rounded-2xl bg-[var(--sagep-gold-soft)] text-sm font-black text-[var(--sagep-brand-deep)] sm:grid">
            EB
          </div>
        </div>

        <p class="text-sm leading-6 text-[var(--sagep-muted)]">
          Use as credenciais provisionadas no backend. Exemplo local:
          <strong class="font-semibold text-[var(--sagep-ink)]">admin@sagep.com</strong> /
          <strong class="font-semibold text-[var(--sagep-ink)]">123456</strong>.
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-5">
          <label class="block space-y-2">
            <span class="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sagep-muted)]">E-mail</span>
            <input
              type="email"
              formControlName="email"
              class="w-full rounded-[14px] border border-[var(--sagep-line)] bg-white px-4 py-3 text-[var(--sagep-ink)] outline-none transition focus:border-[var(--sagep-brand-mid)] focus:ring-4 focus:ring-[rgba(82,102,43,0.12)]"
              placeholder="admin@sagep.com"
            />
            @if (form.controls.email.invalid && form.controls.email.touched) {
              <span class="text-xs text-[var(--sagep-danger)]">Informe um e-mail válido.</span>
            }
          </label>

          <label class="block space-y-2">
            <span class="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sagep-muted)]">Senha</span>
            <input
              type="password"
              formControlName="password"
              class="w-full rounded-[14px] border border-[var(--sagep-line)] bg-white px-4 py-3 text-[var(--sagep-ink)] outline-none transition focus:border-[var(--sagep-brand-mid)] focus:ring-4 focus:ring-[rgba(82,102,43,0.12)]"
              placeholder="Digite sua senha"
            />
            @if (form.controls.password.invalid && form.controls.password.touched) {
              <span class="text-xs text-[var(--sagep-danger)]">A senha precisa ter ao menos 6 caracteres.</span>
            }
          </label>

          @if (errorMessage()) {
            <div class="rounded-[14px] border border-[var(--sagep-danger-soft)] bg-[var(--sagep-danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--sagep-danger)]">
              {{ errorMessage() }}
            </div>
          }

          <button
            type="submit"
            [disabled]="loading()"
            class="inline-flex w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--sagep-brand),var(--sagep-brand-dark))] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(61,76,32,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--sagep-brand-dark)] focus:ring-4 focus:ring-[rgba(200,166,75,0.24)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-400"
          >
            {{ loading() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal(this.route.snapshot.queryParamMap.get('reason') === 'expired'
    ? 'Sessão expirada. Faça login novamente.'
    : '');
  readonly form = this.fb.nonNullable.group({
    email: ['admin@sagep.com', [Validators.required, Validators.email]],
    password: ['123456', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/dashboard']),
        error: (error) => this.errorMessage.set(getErrorMessage(error, 'Não foi possível autenticar.')),
      });
  }
}
