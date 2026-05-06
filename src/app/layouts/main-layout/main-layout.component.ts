import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BreadcrumbComponent } from './breadcrumb.component';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, BreadcrumbComponent],
  template: `
    <div class="app-shell">
      <app-topbar />
      <div class="main-layout">
        <app-sidebar />
        <main class="content">
          <app-breadcrumb />
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class MainLayoutComponent {}
