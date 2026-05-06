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
      <div class="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[300px_1fr]">
        <app-sidebar />

        <div class="flex min-h-screen min-w-0 flex-col">
          <app-topbar />

          <main class="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <app-breadcrumb />
            <router-outlet />
          </main>
        </div>
      </div>
    </div>
  `,
})
export class MainLayoutComponent {}
