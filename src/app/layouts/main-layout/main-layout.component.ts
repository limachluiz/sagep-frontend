import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BreadcrumbComponent } from './breadcrumb.component';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, BreadcrumbComponent],
  template: `
    <div class="min-h-screen bg-transparent">
      <div class="mx-auto grid min-h-screen max-w-[1680px] lg:grid-cols-[306px_minmax(0,1fr)]">
        <app-sidebar />

        <div class="flex min-h-screen min-w-0 flex-col">
          <app-topbar />

          <main class="flex-1 bg-[linear-gradient(180deg,var(--sagep-surface),#fbf9f1)] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <div class="mx-auto w-full max-w-7xl">
              <app-breadcrumb />
              <router-outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  `,
})
export class MainLayoutComponent {}
