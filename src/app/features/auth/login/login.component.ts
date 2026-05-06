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
    <div class="mx-auto flex h-full max-w-md flex-col justify-center">
      <p class="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700">Acesso ao sistema</p>
      <h2 class="mt-4 text-3xl font-semibold text-slate-900">Entrar no SAGEP</h2>
      <p class="mt-3 text-sm leading-6 text-slate-600">
        Use as credenciais provisionadas no backend. Exemplo local: <strong>admin@sagep.com</strong> / <strong>123456</strong>.
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-5">
        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-700">E-mail</span>
          <input
            type="email"
            formControlName="email"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
            placeholder="admin@sagep.com"
          />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <span class="text-xs text-red-600">Informe um e-mail válido.</span>
          }
        </label>

        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-700">Senha</span>
          <input
            type="password"
            formControlName="password"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
            placeholder="Digite sua senha"
          />
          @if (form.controls.password.invalid && form.controls.password.touched) {
            <span class="text-xs text-red-600">A senha precisa ter ao menos 6 caracteres.</span>
          }
        </label>

        @if (errorMessage()) {
          <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ errorMessage() }}
          </div>
        }

        <button
          type="submit"
          [disabled]="loading()"
          class="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {{ loading() ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
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
