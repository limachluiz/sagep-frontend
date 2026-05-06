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
          <span class="tag">4º CTA · Divisão Técnica</span>
          <h2>Gestão institucional de projetos para a Região Amazônica.</h2>
          <p>
            Acompanhe projetos, estimativas, documentos e próximas ações em um fluxo integrado ao backend real do SAGEP.
          </p>
          <div class="login-metrics">
            <div class="login-metric">
              <b>4º</b>
              <span>Centro de Telemática de Área</span>
            </div>
            <div class="login-metric">
              <b>DT</b>
              <span>Divisão Técnica</span>
            </div>
            <div class="login-metric">
              <b>EB</b>
              <span>Exército Brasileiro</span>
            </div>
          </div>
        </div>

        <p class="login-unit">Manaus-AM · Comando Militar da Amazônia</p>
      </section>

      <section class="login-card-area">
        <router-outlet />
      </section>
    </main>
  `,
})
export class AuthLayoutComponent {}
