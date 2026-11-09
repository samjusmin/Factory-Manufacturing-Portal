import { Inject, Injectable, LoggerService, Req } from '@nestjs/common';
import { UserDTO } from '../user/user.dto';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class AuthService {
    constructor(
      private userService: UserService,
      private jwtService: JwtService,
      @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
      ) {}

    async validateUser(@Req() req): Promise<any> {
      if (req.user) {
        return await req.user;
      }
      else {
        return await false;
      }
    }

    async login(user: any) {
      const payload = { username: user._json.sAMAccountName, location: user.location, web_token: user.web_token, roles: user.roles, areas: user.areas || [], company: user.company };
      return {
        access_token: this.jwtService.sign(payload),
        name: user.name.givenName,
        location: user.location && user.location[0] ? user.location[0].name : '',
        //location: user.company,
        role: user.roles.toString(),
        areas: user.areas || [],
        locations: Array.isArray(user.location) ? user.location.map(l => l.name) : []
      };
    }

}
