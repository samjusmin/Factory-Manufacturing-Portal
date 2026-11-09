import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './role.enum';
import { ROLES_KEY } from './roles.decorator';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';


//var request = require('request');

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    //@Inject(REQUEST) private request: Request
    ) {}


  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role.toUpperCase()));
  }
}