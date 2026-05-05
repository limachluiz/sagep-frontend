import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>'
})
export class App {
  private readonly authService = inject(AuthService);

  constructor() {
    if (this.authService.getAccessToken() || this.authService.hasRefreshToken()) {
      this.authService.hydrateSession().subscribe();
    }
  }
}
