import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private auth = inject(Auth);
  private router = inject(Router);

  username = '';
  userId = '';
  token = '';

  ngOnInit(): void {
    const payload = this.auth.getTokenPayload();
    if (payload) {
      this.username = payload.sub;
      this.userId = payload.id;
    }
    this.token = this.auth.getToken() ?? '';
  }

  logout(): void {
    this.auth.logout();
  }
}
