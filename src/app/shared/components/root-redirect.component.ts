import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-root-redirect',
  template: '',
})
export class RootRedirectComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    const target = this.authService.isAuthenticated() ? '/dashboard' : '/login';
    void this.router.navigateByUrl(target);
  }
}
