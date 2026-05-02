import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  template: `
    <main class="flex min-h-screen items-center justify-center px-4 py-10">
      <div class="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-[var(--sagep-shadow)] backdrop-blur lg:grid-cols-[1.15fr_0.85fr]">
        <section class="hidden min-h-[720px] flex-col justify-between bg-[linear-gradient(160deg,#0f766e_0%,#115e59_50%,#0f172a_100%)] p-10 text-white lg:flex">
          <div>
            <p class="text-sm uppercase tracking-[0.35em] text-teal-100">SAGEP</p>
            <h1 class="mt-6 max-w-md text-4xl font-semibold leading-tight">
              Gestao documental e operacional de projetos em um unico fluxo.
            </h1>
          </div>
          <div class="space-y-4 text-sm leading-6 text-teal-50/90">
            <p>Frontend inicial integrado ao backend real para autenticação, dashboard e consulta de projetos.</p>
            <p>Fluxo alinhado às fases documentais oficiais e às permissões efetivas devolvidas pela API.</p>
          </div>
        </section>
        <section class="min-h-[640px] bg-white p-6 sm:p-10">
          <router-outlet />
        </section>
      </div>
    </main>
  `,
})
export class AuthLayoutComponent {}
