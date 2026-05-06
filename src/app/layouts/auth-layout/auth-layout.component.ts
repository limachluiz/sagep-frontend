import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  template: `
    <main class="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div class="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-[var(--sagep-surface-strong)] shadow-[var(--sagep-shadow)] lg:grid-cols-[1.08fr_0.92fr]">
        <section class="relative hidden min-h-[720px] flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_88%_12%,rgba(200,166,75,0.22),transparent_28%),linear-gradient(145deg,#11180c_0%,#1b2814_48%,#3d4c20_100%)] p-10 text-white lg:flex">
          <div class="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#c8a64b,#e0c26b,#52662b)]"></div>
          <div class="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:42px_42px]"></div>

          <div class="relative">
            <div class="flex items-center gap-4">
              <div class="grid h-16 w-16 place-items-center rounded-[20px] border border-white/30 bg-[linear-gradient(135deg,#e0c26b,#c8a64b)] text-2xl font-black text-[var(--sagep-brand-deep)] shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
                EB
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--sagep-gold)]">Exército Brasileiro</p>
                <h1 class="mt-1 text-4xl font-semibold tracking-[0.16em] text-white">SAGEP</h1>
              </div>
            </div>

            <div class="mt-12 max-w-2xl">
              <span class="inline-flex rounded-full border border-[var(--sagep-gold)]/45 bg-[var(--sagep-gold)]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#e0c26b]">
                4º CTA · Divisão Técnica
              </span>
              <h2 class="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.04em]">
                Gestão de projetos com comando, rastreabilidade e prontidão documental.
              </h2>
              <p class="mt-5 max-w-xl text-base leading-7 text-white/[0.72]">
                Ambiente institucional para acompanhar demandas, estimativas e documentos com acesso orientado por perfil.
              </p>
            </div>
          </div>

          <div class="relative grid gap-3 text-sm leading-6 text-white/75">
            <div class="rounded-[18px] border border-white/[0.12] bg-white/[0.07] p-4">
              <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#e0c26b]">Unidade</p>
              <p class="mt-2">4º Centro de Telemática de Área</p>
            </div>
            <div class="rounded-[18px] border border-white/[0.12] bg-white/[0.07] p-4">
              <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#e0c26b]">Fluxo</p>
              <p class="mt-2">Projetos, estimativas e acompanhamento operacional integrados ao backend real.</p>
            </div>
          </div>
        </section>

        <section class="flex min-h-[640px] bg-[linear-gradient(180deg,#fffdf7_0%,#f7f3e8_100%)] p-6 sm:p-10">
          <router-outlet />
        </section>
      </div>
    </main>
  `,
})
export class AuthLayoutComponent {}
