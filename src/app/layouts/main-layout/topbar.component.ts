import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import {
  EMPTY,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  switchMap,
  tap,
} from 'rxjs';

import { GlobalSearchGroup, GlobalSearchResult } from '../../core/models/global-search.model';
import { AuthService } from '../../core/services/auth.service';
import { GlobalSearchService } from '../../core/services/global-search.service';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, ReactiveFormsModule],
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
        <div class="global-search-shell">
          <div class="command-search" aria-label="Busca global">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              [formControl]="searchControl"
              placeholder="Buscar projetos, estimativas ou documentos"
              autocomplete="off"
              (focus)="openSearch()"
              aria-label="Busca global"
            />
          </div>

          @if (dropdownOpen()) {
            <div class="global-search-dropdown" role="listbox">
              @if (searchTerm().length < 3) {
                <div class="global-search-state">
                  <b>Digite ao menos 3 caracteres</b>
                  <span>Pesquise por códigos, títulos, documentos ou organizações.</span>
                </div>
              } @else if (searchLoading()) {
                <div class="global-search-state">
                  <b>Buscando...</b>
                  <span>Consultando registros disponíveis para seu perfil.</span>
                </div>
              } @else if (searchError()) {
                <div class="global-search-state">
                  <b>Não foi possível buscar agora</b>
                  <span>{{ searchError() }}</span>
                </div>
              } @else if (!visibleSearchGroups().length) {
                <div class="global-search-state">
                  <b>Nenhum resultado encontrado</b>
                  <span>Tente outro termo ou refine a busca.</span>
                </div>
              } @else {
                @for (group of visibleSearchGroups(); track group.key) {
                  <section class="global-search-group">
                    <p>{{ group.label }}</p>
                    @for (item of group.items; track item.type + '-' + item.id + '-' + item.code) {
                      <button type="button" class="global-search-result" (click)="goToResult(item)">
                        <span class="global-search-kind">{{ item.typeLabel }}</span>
                        <span>
                          <b>{{ item.title }}</b>
                          <small>{{ item.code || item.typeLabel }}</small>
                          <em>{{ item.subtitle }}</em>
                        </span>
                      </button>
                    }
                  </section>
                }
              }
            </div>
          }
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
        <button type="button" class="icon-btn" title="Sair" aria-label="Sair" (click)="logout()">
          ⎋
        </button>
      </div>
    </header>
  `,
})
export class TopbarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly globalSearchService = inject(GlobalSearchService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchGroups = signal<GlobalSearchGroup[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal('');
  readonly dropdownOpen = signal(false);
  readonly searchTerm = signal('');

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
  readonly visibleSearchGroups = computed(() =>
    this.searchGroups().filter((group) => group.items.length > 0),
  );

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((value) => {
          const term = value.trim();
          this.searchTerm.set(term);
          this.searchError.set('');
          this.dropdownOpen.set(term.length > 0);

          if (term.length < 3) {
            this.searchGroups.set([]);
            this.searchLoading.set(false);
          }
        }),
        switchMap((value) => {
          const term = value.trim();

          if (term.length < 3) {
            return EMPTY;
          }

          this.searchLoading.set(true);

          return this.globalSearchService.search(term).pipe(
            catchError(() => {
              this.searchGroups.set([]);
              this.searchError.set('A busca não retornou resultados no momento.');
              return EMPTY;
            }),
            finalize(() => this.searchLoading.set(false)),
          );
        }),
      )
      .subscribe((groups) => this.searchGroups.set(groups));

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.closeSearch();
      }
    });
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeSearch();
    }
  }

  openSearch(): void {
    if (this.searchControl.value.trim()) {
      this.dropdownOpen.set(true);
    }
  }

  goToResult(result: GlobalSearchResult): void {
    this.closeSearch();
    void this.router.navigate(result.route);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
    });
  }

  private closeSearch(): void {
    this.dropdownOpen.set(false);
  }
}
