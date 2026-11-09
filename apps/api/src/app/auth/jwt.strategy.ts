import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Falls back to the same demo secret used in auth.module.ts so the app runs with zero configuration.
      secretOrKey: process.env.JWT_SECRET_KEY || 'demo-jwt-secret-not-for-production-use',
    });
  }

  async validate(payload: any) {
    return { username: payload.username, location: payload.location, web_token: payload.web_token, roles: payload.roles, areas: payload.areas, company: payload.company };
  }
}