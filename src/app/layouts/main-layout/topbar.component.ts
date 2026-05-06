import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  template: `
    <header class="topbar">
      <div class="topbar-brand">
        <div class="mini-crest">4º</div>
        <div>
          <h2>SAGEP</h2>
          <span>Exército Brasileiro</span>
        </div>
      </div>

      <div class="topbar-center">
        <div class="command-search" aria-label="Busca visual">
          <span>⌕</span>
          <input type="text" placeholder="Buscar projetos, estimativas ou documentos" disabled />
        </div>
        <div class="context-chip">Manaus-AM · Região Amazônica</div>
      </div>

      <div class="topbar-actions">
        <button type="button" class="icon-btn" title="Alertas" aria-label="Alertas">!</button>
        <button type="button" class="icon-btn" title="Ajuda" aria-label="Ajuda">?</button>
        <div class="user-menu">
          <div class="avatar">{{ initials() }}</div>
          <div>
            <b>{{ userName() }}</b>
            <span>{{ userRole() }}</span>
          </div>
        </div>
        <button type="button" class="icon-btn" title="Sair" aria-label="Sair" (click)="logout()">⎋</button>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly userName = computed(() => this.authService.getCurrentUser()?.name ?? 'Usuário');
  readonly userRole = computed(() => this.authService.getUserRole() ?? 'SEM PERFIL');
  readonly initials = computed(() =>
    (this.authService.getCurrentUser()?.name ?? 'S A')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase(),
  );

  logout(): void {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
    });
  }
}
