import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { UserDTO } from '../user/user.dto';
import { UserService } from '../user/user.service';
import { MockAuthGuard } from './mock-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {

    constructor(
      private readonly authService: AuthService,
      private userService: UserService
    ) {}

    @UseGuards(MockAuthGuard)
    @Post('/login')
    async login(@Req() req, @Body() user: UserDTO) {
      const userInfo = await this.userService.getInfo(req.user._json.sAMAccountName);
      req.user.location = userInfo[0].location;
      req.user.web_token = userInfo[0].web_token;
      req.user.roles = userInfo[0].roles;
      req.user.areas = userInfo[0].areas || [];
      req.user.company = userInfo[0].company;
      console.log("req.user: ", req.user)
      console.log("userInfo[0]", userInfo[0])
      const valid = await this.authService.login(req.user);
      return valid;

    }

}
