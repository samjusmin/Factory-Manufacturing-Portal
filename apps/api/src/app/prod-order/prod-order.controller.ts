import { Controller, Get, Post, Body, Param, UseGuards, Req, UseFilters, UseInterceptors } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { ProdOrder } from './prod-order.schema';
import { ProdOrderService } from './prod-order.service';
import { ProdOrderUpdateDTO } from './prod-order.update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { StockkeepingService } from '../stockkeeping/stockkeeping.service';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';
import { RolesGuard } from '../role/roles.guard';

@Controller('prod-order')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('warehouse')
export class ProdOrderController {
    constructor(
        private readonly prodOrderService: ProdOrderService,
        private readonly stockkeepingService: StockkeepingService
    ) {}

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get()
    async getAllProduction(@Req() req) {
        const orders = await this.prodOrderService.findAll();
        return orders;
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('/:mrpId')
    async findAssembly(@Param('mrpId') mrpId: string) {
        const filteredOrders = await this.prodOrderService.findSubassembly(mrpId);
        return filteredOrders;
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('/:mrpId/:lineId')
    async findComponent(@Param('mrpId') mrpId: string, @Param('lineId') lineId: string) {
        const filteredOrders = await this.prodOrderService.findComponents(mrpId, lineId);
        //const refresh = await this.stockkeepingService.refreshInventory(filteredOrders);
        return filteredOrders;
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('/:mrpId/:lineId/:refresh')
    async refreshComponent(@Param('mrpId') mrpId: string, @Param('lineId') lineId: string,  @Param('refresh') refresh: string) {
        const filteredOrders = await this.prodOrderService.findComponents(mrpId, lineId);
        const refreshC = await this.stockkeepingService.refreshInventory(filteredOrders);
        return filteredOrders;
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Post()
    async updateProdOrderQty(@Body() prodOrderUpdate: ProdOrderUpdateDTO[]) {

        console.log("Update: ", prodOrderUpdate);
        const result = prodOrderUpdate[0].type == "consumption" 
            ? await this.prodOrderService.updateNAVConsumption(prodOrderUpdate)
            : await this.prodOrderService.updateNAVOutput(prodOrderUpdate);
        
        //const result = await this.prodOrderService.updateNAV(prodOrderUpdate);
        if (result == false) {
            throw new Error("Unable to post update. Please check that you have enough quantity.");
        }
        return result;
    }
}