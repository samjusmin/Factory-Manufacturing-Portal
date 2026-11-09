import { Controller, Get, Post, Body, Param, UseGuards, UseFilters, UseInterceptors } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { Stockkeeping } from './stockkeeping.schema';
import { StockkeepingService } from './stockkeeping.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';

@Controller('stockkeeping')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('warehouse')
export class StockkeepingController {
    constructor(private readonly stockkeepingService: StockkeepingService) {}

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get()
    async getAllProducts() {
        const stock = await this.stockkeepingService.findAll();
        return stock;   
    }
    
}
