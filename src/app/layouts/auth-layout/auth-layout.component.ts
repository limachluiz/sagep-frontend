import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  template: `
    <main class="login-screen">
      <section class="login-brand">
        <div class="brand-mark">
          <div class="crest">4º</div>
          <div class="brand-title">
            <h1>SAGEP</h1>
            <p>Sistema de Apoio à Gestão de Projetos</p>
          </div>
        </div>

        <div class="login-hero">
          <span class="tag">Exército Brasileiro</span>
          <h2>4º Centro de Telemática de Área</h2>
          <p>Divisão Técnica</p>
          <p class="login-copy">Ambiente institucional para apoio à gestão de projetos.</p>
        </div>

        <p class="login-unit">Manaus-AM · Comando Militar da Amazônia</p>
      </section>

      <section class="login-card-area" aria-label="Acesso ao sistema">
        <router-outlet />
      </section>
    </main>
  `,
})
export class AuthLayoutComponent {}
