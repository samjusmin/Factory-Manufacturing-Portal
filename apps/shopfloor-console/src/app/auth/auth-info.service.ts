import { Injectable } from '@angular/core';
import { TrainingArea, isTrainingArea } from '@webproject/data';

// Who is logged in, read from localStorage (set by LoginService). This drives navigation
// and route guards only. The API enforces access with the roles and locations in the JWT.
@Injectable({
  providedIn: 'root'
})
export class AuthInfoService {

  get roles(): string[] {
    return (localStorage.getItem('role') || '')
      .split(',')
      .map(r => r.trim().toUpperCase())
      .filter(r => r);
  }

  isAdmin(): boolean {
    return this.roles.includes('ADMIN');
  }

  // The parts of the app (warehouse, config, fat) the person holds a role in, set by an administrator in the Training
  // register. They decide which pages open; the API checks the same list from the token.
  get areas(): TrainingArea[] {
    try {
      const stored = JSON.parse(localStorage.getItem('areas'));
      if (Array.isArray(stored)) {
        return stored.filter(isTrainingArea);
      }
    } catch (e) { /* fall through to the token */ }
    const fromToken = this.tokenPayload();
    return fromToken && Array.isArray(fromToken.areas) ? fromToken.areas.filter(isTrainingArea) : [];
  }

  // Admins can open every area.
  hasArea(area: TrainingArea): boolean {
    return this.isAdmin() || this.areas.includes(area);
  }

  // Non-admins reach Config through their own location, which needs the OPERATOR role (the same roles the config API
  // routes allow) and a role in the Config area.
  hasLocationConfigAccess(): boolean {
    return !this.isAdmin() && this.roles.includes('OPERATOR') && this.hasArea('config') && !!this.firstLocation();
  }

  userLocations(): string[] {
    try {
      const stored = JSON.parse(localStorage.getItem('locations'));
      if (Array.isArray(stored)) {
        return stored;
      }
    } catch (e) { /* fall through to the token */ }
    return this.locationsFromToken();
  }

  firstLocation(): string | null {
    return this.userLocations()[0] || null;
  }

  // Route commands for the Config entry point of the current user, or null if none.
  configRoute(): any[] | null {
    if (this.isAdmin()) {
      return ['/config-admin'];
    }
    const location = this.firstLocation();
    return this.hasLocationConfigAccess() && location ? ['/config-categories', location] : null;
  }

  // Sessions that started before `locations` or `areas` were stored at login still carry them in the token.
  private locationsFromToken(): string[] {
    const locations = (this.tokenPayload() || {}).location;
    return Array.isArray(locations) ? locations.map(l => l.name).filter(n => n) : [];
  }

  private tokenPayload(): any {
    try {
      const payload = localStorage.getItem('token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(payload).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
}
