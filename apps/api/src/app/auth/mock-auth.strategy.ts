import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

// Portfolio/demo replacement for the original Active Directory / LDAP strategy.
// Validates against a small hardcoded set of demo accounts instead of a real directory server,
// and returns a profile shaped the same way the AD strategy used to (`_json.sAMAccountName`, `name.givenName`)
// so the rest of the auth flow (auth.controller.ts, auth.service.ts) doesn't need to change.
const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', givenName: 'Alex' },
  { username: 'operator', password: 'operator123', givenName: 'Sam' },
  { username: 'partner', password: 'partner123', givenName: 'Jordan' },
];

@Injectable()
export class MockStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ usernameField: 'username', passwordField: 'password' });
  }

  async validate(username: string, password: string): Promise<any> {
    const account = DEMO_ACCOUNTS.find(
      (a) => a.username === username?.toLowerCase() && a.password === password,
    );
    if (!account) {
      throw new UnauthorizedException('Invalid demo credentials');
    }
    return {
      _json: { sAMAccountName: account.username },
      name: { givenName: account.givenName },
    };
  }
}
