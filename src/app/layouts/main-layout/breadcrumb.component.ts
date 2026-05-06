import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

interface BreadcrumbItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink],
  template: `
    @if (items().length > 0) {
      <nav class="mb-5 flex flex-wrap items-center gap-2 text-xs text-[var(--sagep-muted-soft)]" aria-label="Breadcrumb">
        <a routerLink="/dashboard" class="font-semibold text-[var(--sagep-brand)] transition hover:text-[var(--sagep-brand-deep)]">Início</a>
        @for (item of items(); track item.path) {
          <span class="text-[var(--sagep-line-strong)]">/</span>
          <a [routerLink]="item.path" class="font-medium text-[var(--sagep-muted)] transition hover:text-[var(--sagep-ink)]">
            {{ item.label }}
          </a>
        }
      </nav>
    }
  `,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<BreadcrumbItem[]>([]);

  private readonly labels: Record<string, string> = {
    dashboard: 'Dashboard',
    projects: 'Projetos',
    estimates: 'Estimativas',
    new: 'Nova estimativa',
    diex: 'DIEx',
    'ordens-servico': 'Ordens de Serviço',
    atas: 'ATAs',
    'itens-ata': 'Itens da ATA',
    'saldo-ata': 'Saldo da ATA',
    relatorios: 'Relatórios',
    auditoria: 'Auditoria',
    usuarios: 'Usuários',
    oms: 'OMs',
  };

  constructor() {
    this.updateItems(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.updateItems(event.urlAfterRedirects));
  }

  private updateItems(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    const segments = path.split('/').filter(Boolean);

    if (segments.length <= 1 && segments[0] === 'dashboard') {
      this.items.set([]);
      return;
    }

    const items = segments.map((segment, index) => ({
      label: this.labels[segment] ?? (index > 0 ? 'Detalhe' : segment),
      path: `/${segments.slice(0, index + 1).join('/')}`,
    }));

    this.items.set(items);
  }
}
