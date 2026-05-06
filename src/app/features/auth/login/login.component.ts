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
    <div class="login-card">
      <p class="tag">Sessão segura</p>
      <h2>Entrar no SAGEP</h2>
      <p class="sub">
        Use as credenciais provisionadas no backend. Exemplo local:
        <strong>admin@sagep.com</strong> / <strong>123456</strong>.
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" type="email" formControlName="email" placeholder="admin@sagep.com" />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <span class="mt-2 block text-xs text-[var(--danger)]">Informe um e-mail válido.</span>
          }
        </div>

        <div class="field">
          <label for="password">Senha</label>
          <input id="password" type="password" formControlName="password" placeholder="Digite sua senha" />
          @if (form.controls.password.invalid && form.controls.password.touched) {
            <span class="mt-2 block text-xs text-[var(--danger)]">A senha precisa ter ao menos 6 caracteres.</span>
          }
        </div>

        @if (errorMessage()) {
          <div class="mb-4 rounded-[14px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--danger)]">
            {{ errorMessage() }}
          </div>
        }

        <button type="submit" [disabled]="loading()" class="btn btn-primary btn-full disabled:cursor-not-allowed disabled:opacity-60">
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
