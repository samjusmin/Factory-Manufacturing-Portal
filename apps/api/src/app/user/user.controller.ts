import { Controller, Get, Param, UseGuards, UseFilters, UseInterceptors, Res } from '@nestjs/common';
import { User } from './user.schema';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';


@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}


    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('loclist')
    async getLocationList() {
        const locList = await this.userService.getLocations();
        console.log(locList);
        return locList;
    }

}