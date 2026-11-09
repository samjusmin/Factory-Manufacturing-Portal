import { Controller, Get, Post, Body, Param, UseGuards, Req, UseInterceptors } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderUpdateDTO } from './purchase-order.update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';

@Controller('purchase-order')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('warehouse')
export class PurchaseOrderController {
    constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get()
    async getAllProducts() {
        const receive = await this.purchaseOrderService.findAll();
        return receive;
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('orders')
    async getAllOrders() {
        const orders = await this.purchaseOrderService.findOrders();
        return orders;
    }

    // Read-only order view: head office sees every line of the order, not only the lines at its own locations.
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('orders/:id')
    async findOneOrder(@Param('id') id: string) {
        return this.purchaseOrderService.findPOForOrders(id);
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get(':id')
    async findOne(@Param('id') id: string) {
       const filteredOrders = await this.purchaseOrderService.findPO(id);
       return filteredOrders;
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Post()
    async updatePurchOrderQty(@Body() purchaseOrderUpdate: PurchaseOrderUpdateDTO[], @Req() req) {
        //console.log("Request: ", purchaseOrderUpdate);
        const result = await this.purchaseOrderService.updateNAV(purchaseOrderUpdate);
        return result;
    }

}
