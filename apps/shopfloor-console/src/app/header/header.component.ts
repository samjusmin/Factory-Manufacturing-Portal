import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { LoginService } from '../login/login.service';

@Component({
  selector: 'webproject-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  title = 'Manufacturing Portal';
  username = localStorage.getItem('name');
  //userloc = localStorage.getItem('location');

  constructor(
    private router: Router,
    private loginService: LoginService,
    public dialog: MatDialog
  ) { 
    loginService.loginValue.subscribe(currentUser => {
      this.username = currentUser;
    })
  }

  ngOnInit(): void {}

  // The first letter of the name, shown in the circle beside it.
  get initial(): string {
    return (this.username || '').trim().charAt(0).toUpperCase();
  }

  // How the signed-in user's role reads in the account menu.
  get roleLabel(): string {
    switch ((localStorage.getItem('role') || '').toUpperCase()) {
      case 'ADMIN': return 'Administrator';
      case 'OPERATOR': return 'Operator';
      case 'EXTUSER': return 'External partner';
      default: return '';
    }
  }

  logout() {
    this.username = '';
    this.loginService.currentUser = this.username;
    window.location.href = window.location.protocol + '//' + window.location.host + '/login';
    /*this.router.navigate(['/login']).then(() => {
      window.location.reload();
    });*/
  }
  
}
