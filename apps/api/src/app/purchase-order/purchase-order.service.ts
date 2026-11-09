import { Model, isValidObjectId } from 'mongoose';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Scope, Inject, NotFoundException, LoggerService } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PurchaseOrder, PurchaseOrderDocument } from './purchase-order.schema';
import { PurchaseOrderUpdateDTO } from './purchase-order.update.dto';
import { Subcontractor, SubcontractorDocument } from '../subcontractor/subcontractor.schema';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { elementAt } from 'rxjs/operators';
import { summarisePurchaseOrder } from '@webproject/data';
import { buildPipeline, isHeadOffice } from './purchase-order.scope';

const util = require('util')
var request = require('request');
const requestPromise = util.promisify(request);
var xml2js = require('xml2js');
var strip = require('xml2js').processors.stripPrefix;
var parser = new xml2js.Parser({explicitArray: false, trim: true, tagNameProcessors: [strip]});
var faultcode;
var username = '';
var contextName = 'PurchaseOrderService: ';

var options = {
    url: '',
    method: 'POST',
    body: 'none',
    headers: {}
};


@Injectable()
export class PurchaseOrderService {

    constructor(
        @InjectModel('purchase_orders') private PurchaseOrderModel: Model<PurchaseOrderDocument>,
        @InjectModel('subcontractors') private SubcontractorModel: Model<SubcontractorDocument>,
        @Inject(REQUEST) private request: Request,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        var url = 'http://' + process.env.NAV_DOMAIN + '/' + process.env.NAV_ENV + '_WS/WS/' + process.env.NAV_COMPANY + '/Page/PurchaseOrder';
        options.url = url;
    }

    async findSubcon(locExp): Promise<Subcontractor[]> {
        let subcon = await this.SubcontractorModel.find({ "location.loc": { "$in": locExp } }).exec();
        return subcon;
    }

    // The signed-in user's locations and the vendor numbers of their subcontractors.
    private async userScope() {
        username = this.request.user['username'];
        const locCodes: string[] = this.request.user['location'].map(value => value.code);
        const vendorNumbers: string[] = [];
        const subcons = await this.findSubcon(locCodes);
        subcons.forEach(element => { element.vendor.forEach(num => vendorNumbers.push(num.vendor_no)) });
        return { locCodes, vendorNumbers, headOffice: isHeadOffice(locCodes) };
    }

    // Runs a pipeline and attaches each order's status, progress and due-date bucket.
    private async withSummary(pipeline: object[]): Promise<PurchaseOrder[]> {
        const docs = await this.PurchaseOrderModel.aggregate(pipeline);
        return docs.map(po => ({ ...po, summary: summarisePurchaseOrder(po) }));
    }

    // Receiving: released orders that still have lines to receive, earliest due first.
    async findAll(): Promise<PurchaseOrder[]> {
        const { locCodes, vendorNumbers, headOffice } = await this.userScope();
        this.logger.info("Username: " + username + ", Location: " + locCodes, {label: contextName + this.findAll.name});
        return this.withSummary(buildPipeline('receiving', locCodes, vendorNumbers, headOffice));
    }

    // Orders: every order at the user's locations in any status (head office sees all), including received ones.
    async findOrders(): Promise<PurchaseOrder[]> {
        const { locCodes, vendorNumbers, headOffice } = await this.userScope();
        this.logger.info("Username: " + username + ", Location: " + locCodes, {label: contextName + this.findOrders.name});
        return this.withSummary(buildPipeline('orders', locCodes, vendorNumbers, headOffice));
    }

    // Receiving detail: only the lines at the user's locations.
    async findPO(id): Promise<PurchaseOrder[]> {
        const { locCodes, vendorNumbers } = await this.userScope();
        this.logger.info("Username: " + username + ", Location: " + locCodes, {label: contextName + this.findPO.name});
        return this.withSummary(this.detailPipeline(id, locCodes, vendorNumbers, true));
    }

    // Order detail (read-only): head office sees every line, including lines at other locations.
    async findPOForOrders(id): Promise<PurchaseOrder[]> {
        const { locCodes, vendorNumbers, headOffice } = await this.userScope();
        this.logger.info("Username: " + username + ", Location: " + locCodes, {label: contextName + this.findPOForOrders.name});
        return this.withSummary(this.detailPipeline(id, locCodes, vendorNumbers, !headOffice));
    }

    private detailPipeline(id: string, locCodes: string[], vendorNumbers: string[], filterLines: boolean): object[] {
        const pipeline: object[] = [{ "$match": { "doc_no": id } }];
        if (filterLines) {
            pipeline.push({ "$addFields": { "items": { "$filter": {
                "input": "$items", "as": "item", "cond": { "$in": ["$$item.location", locCodes] }
            }}}});
        }
        // to render different html components depending on value
        // true: this PO is for user to fulfill
        // false: this PO is for user to receive
        pipeline.push({ "$addFields": { "owner": { "$in": ["$vendor_no", vendorNumbers] } } });
        return pipeline;
    }

    // What a user may receive: more than nothing, no more than is left on the line, on a released order, at one of their
    // locations. The page limits this too, but only the server can be relied on. Returns the stored line of each row.
    private async assertReceivable(purchOrderDetail: PurchaseOrderUpdateDTO[]) {
        const rows = (Array.isArray(purchOrderDetail) ? purchOrderDetail : []).filter(e => e && e.id !== null);
        if (rows.length === 0) {
            throw new BadRequestException('Enter a quantity to receive.');
        }
        const { locCodes } = await this.userScope();
        const received = new Map<string, number>();
        const lines = [];
        for (const row of rows) {
            const qty = Number(row.qty);
            if (!isFinite(qty) || qty <= 0) {
                throw new BadRequestException('The quantity to receive must be more than 0.');
            }
            const po: any = isValidObjectId(row.id) ? await this.PurchaseOrderModel.findById(row.id).lean() : null;
            const line = po && (po.items || []).find(i => i.line_no === row.line);
            if (!line) {
                throw new NotFoundException('That order line no longer exists.');
            }
            if (po.status !== 'Released') {
                throw new BadRequestException(`${po.doc_no} is not released, so it cannot be received.`);
            }
            if (!locCodes.includes(line.location)) {
                throw new ForbiddenException(`Line ${line.line_no} of ${po.doc_no} is not at your location.`);
            }
            // The same line twice in one request counts as one amount.
            const key = row.id + '/' + row.line;
            const total = (received.get(key) || 0) + qty;
            if (total > line.qty_remaining) {
                throw new BadRequestException(`Only ${line.qty_remaining} left to receive on line ${line.line_no} of ${po.doc_no}.`);
            }
            received.set(key, total);
            lines.push({ row: { ...row, qty }, line });
        }
        return lines;
    }

    async updateQuantity(purchOrderDetail: PurchaseOrderUpdateDTO[]) {
        // The line must still have enough left when the write happens, in case someone else received it just now.
        const result: any = await this.PurchaseOrderModel.bulkWrite(
            purchOrderDetail.map(({ id, ref, key, line, line_key, qty }) =>
              ({
                "updateOne": {
                  "filter": { _id: id, "items": { "$elemMatch": { "line_no": line, "qty_remaining": { "$gte": qty } } } },
                  "update": {
                    "$set": { "key": key, "shipping_ref": ref, "items.$.key": line_key, "items.$.qty_to_receive": 0 },
                    "$inc": { "items.$.qty_received": +qty,
                              "items.$.qty_remaining": -qty  }
                  },
                  "upsert": false
                }
              })
            )
          )
          .catch((error) => {
              this.logger.error(error);
              throw error;
          });
        if (result && result.nMatched !== undefined && result.nMatched < purchOrderDetail.length) {
            throw new ConflictException('Someone else received this order just now. Reload the page and try again.');
        }
        this.logger.info(username + " has sucessfully updated Mongo purchase orders " + purchOrderDetail, {label: contextName + this.updateQuantity.name});
    }


    async updateNAV(purchOrderDetail: PurchaseOrderUpdateDTO[]) {
        username = this.request.user['username'];
        const lines = await this.assertReceivable(purchOrderDetail);
        // Demo mode: no ERP configured, so only the local database is updated.
        if (!process.env.NAV_DOMAIN) {
            await this.updateQuantity(lines.map(l => l.row));
            // Keep the demo inventory consistent: receiving adds stock at the line's location.
            const stock = this.PurchaseOrderModel.db.collection('stockkeepings');
            for (const { row, line } of lines) {
                await stock.updateOne({ no: line.item_no, variant: line.revision, location: line.location }, { $inc: { inventory: +row.qty } });
            }
            return true;
        }
        const serviceType = purchOrderDetail[0].no.startsWith('TD') ? "transferorder" : "purchaseorder";
        try {
            const latestKey = await this.getLatestNAVKey(purchOrderDetail, serviceType);
            const updateKey = serviceType == "transferorder" ? await this.updateNAVTransferReceiving(purchOrderDetail) : await this.updateNAVPurchaseReceiving(purchOrderDetail);
            const postResult = await this.postNAVUpdate(updateKey, purchOrderDetail[0].no, serviceType);
            purchOrderDetail = purchOrderDetail.filter(e => e.id !== null);
            await this.updateQuantity(purchOrderDetail);
            return true;
        } catch(e) {
            this.logger.error(username + e, {label: contextName + this.updateNAV.name});
            throw e;
        }
    }

    async updateNAVPurchaseReceiving(purchOrderDetail: PurchaseOrderUpdateDTO[]) {

        let tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        let today = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);

        let xml = 
`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pur="urn:microsoft-dynamics-schemas/page/purchaseorder">
<soapenv:Header/>
<soapenv:Body>
   <pur:Update>
      <pur:PurchaseOrder>
         <pur:Key>`+ purchOrderDetail[0].key + `</pur:Key>
         <pur:Vendor_Shipment_No>` + purchOrderDetail[0].ref + `</pur:Vendor_Shipment_No>
         <pur:Posting_Date>` + today + `</pur:Posting_Date>
         <pur:PurchLines>`

         purchOrderDetail.forEach(element => {
             xml +=
             `<pur:Purchase_Order_Line>
                <pur:Key>` + element.line_key + `</pur:Key>
                <pur:Qty_to_Receive>` + element.qty + `</pur:Qty_to_Receive>
             </pur:Purchase_Order_Line>`
         });
         
        xml +=
         `</pur:PurchLines>
      </pur:PurchaseOrder>
   </pur:Update>
</soapenv:Body>
</soapenv:Envelope>`

        let headerText = this.generateHeader('Update', xml.length);
        options.body = xml;
        options.headers = headerText;

        return new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    parser.parseString(body, (err, result) => {
                        let newKey = result.Envelope.Body.Update_Result.PurchaseOrder.Key;
                        this.logger.info(username + " has successfully updated NAV PO Receiving: " + purchOrderDetail[0].no + ". Details: " + xml, {label: contextName + this.updateNAVPurchaseReceiving.name});
                        resolve(newKey);
                    });
                }
                // Handle SOAP request error
                else if (response.statusCode != 200) {
                    parser.parseString(body, (err, result) => {
                        if (result) {
                            faultcode = result.Envelope.Body.Fault.faultstring._;
                            reject("Failed to update " + purchOrderDetail[0].no + ": " + faultcode);
                        }
                        else {
                            reject("Failed to update " + purchOrderDetail[0].no + ": " + err);
                        }
                    })
                }
                else if (error) {
                    reject("Failed to update " + purchOrderDetail[0].no + ": " + error);
                }
                else {
                    reject("Failed to update " + purchOrderDetail[0].no + ": " + body);
                }
                this.logger.info(username + ' updateNAVPurchaseReceiving E ' + response.statusCode + " " + response.statusMessage, {label: contextName + this.updateNAVPurchaseReceiving.name});
            });
        });
    }

    async updateNAVTransferReceiving(transferOrderDetail: PurchaseOrderUpdateDTO[]) {

        let tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        let today = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
        
        let xml = 
`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tran="urn:microsoft-dynamics-schemas/page/transferorder">
<soapenv:Header/>
<soapenv:Body>
   <tran:Update>
      <tran:TransferOrder>
         <tran:Key>`+ transferOrderDetail[0].key + `</tran:Key>
         <tran:External_Document_No>` + transferOrderDetail[0].ref + `</tran:External_Document_No>
         <tran:Posting_Date>` + today + `</tran:Posting_Date>
         <tran:TransferLines>`

         transferOrderDetail.forEach(element => {
             xml +=
             `<tran:Transfer_Order_Line>
                <tran:Key>` + element.line_key + `</tran:Key>
                <tran:Qty_to_Receive>` + element.qty + `</tran:Qty_to_Receive>
             </tran:Transfer_Order_Line>`
         });
         
        xml +=
         `</tran:TransferLines>
      </tran:TransferOrder>
   </tran:Update>
</soapenv:Body>
</soapenv:Envelope>`

        let headerText = this.generateHeader('Update', xml.length, 'transferorder');
        options.body = xml;
        options.headers = headerText;

        return new Promise((resolve, reject) => {
            
            request(options, (error, response, body) => {
                // console.log("updateNAVTransferReceiving Err", error);
                // console.log("updateNAVTransferReceiving Res", response);
                // console.log("updateNAVTransferReceiving Bod", body);
                if (!error && response.statusCode == 200) {
                    parser.parseString(body, (err, result) => {
                        let newKey = result.Envelope.Body.Update_Result.TransferOrder.Key;
                        this.logger.info(username + " has successfully updated NAV TD Receiving: " + transferOrderDetail[0].no + ". Details: " + xml, {label: contextName + this.updateNAVTransferReceiving.name})
                        resolve(newKey);
                    });
                }
                // Handle SOAP request error
                else if (response.statusCode != 200) {
                    parser.parseString(body, (err, result) => {
                        if (result) {
                            faultcode =  result.Envelope.Body.Fault.faultstring._;
                            reject("Failed to update " + transferOrderDetail[0].no + ": " + faultcode);
                        }
                        else {
                            reject("Failed to update " + transferOrderDetail[0].no + ": " + err);
                        }
                    })
                }
                else if (error) {
                    reject("Failed to update " + transferOrderDetail[0].no + ": " + error);
                }
                else {
                    reject("Failed to update " + transferOrderDetail[0].no + ": " + body);
                }
                this.logger.info(username + 'updateNAVTransferReceiving E ' + response.statusCode + " " + response.statusMessage, {label: contextName + this.updateNAVTransferReceiving.name});
            });  
        });
    }

    async getLatestNAVKey (purchOrderDetail: PurchaseOrderUpdateDTO[], service = "purchaseorder") {
        let xml = 
`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pur="urn:microsoft-dynamics-schemas/page/` + service + `">
<soapenv:Header/>
<soapenv:Body>
   <pur:ReadMultiple>
      <pur:filter>
         <pur:Field>No</pur:Field>
         <pur:Criteria>`+ purchOrderDetail[0].no +`</pur:Criteria>
      </pur:filter>
      <pur:bookmarkKey></pur:bookmarkKey>
      <pur:setSize></pur:setSize>
   </pur:ReadMultiple>
</soapenv:Body>
</soapenv:Envelope>`

        let headerText = this.generateHeader('ReadMultiple', xml.length, service);
        options.body = xml;
        options.headers = headerText;

        return new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                //console.log("getLatestNAVKey", response);
                if (!error && response.statusCode == 200) {
                    parser.parseString(body, (err, result) => {
                        let newMainKey = '';
                        let newLinesKey: Array<{key: string, line: number}> = [];

                        if (service == 'purchaseorder') {
                            let orderHeader = result.Envelope.Body.ReadMultiple_Result.ReadMultiple_Result.PurchaseOrder;
                            let orderDetail = orderHeader.PurchLines.Purchase_Order_Line;
                            newMainKey = orderHeader.Key;
                            if (orderDetail.length == 1 || (!orderDetail.length && orderDetail.Key)) {
                                newLinesKey.push({
                                    key: orderDetail.Key,
                                    line: orderDetail.Line_No
                                })
                            }
                            else {
                                orderDetail.forEach(element => {
                                    newLinesKey.push({
                                        key: element.Key,
                                        line: element.Line_No
                                    });
                                });
                            }
                        }
                        else if (service == 'transferorder') {
                            let orderHeader = result.Envelope.Body.ReadMultiple_Result.ReadMultiple_Result.TransferOrder;
                            let orderDetail = orderHeader.TransferLines.Transfer_Order_Line;
                            newMainKey = orderHeader.Key;
                            if (orderDetail.length == 1 || (!orderDetail.length && orderDetail.Key)) {
                                newLinesKey.push({
                                    key: orderDetail.Key,
                                    line: orderDetail.Line_No
                                })
                            }
                            else {
                                orderDetail.forEach(element => {
                                    newLinesKey.push({
                                        key: element.Key,
                                        line: element.Line_No
                                    });
                                });
                            }
                        }

                        newLinesKey.forEach((element, index) => {
                            let idx = purchOrderDetail.findIndex(e => e.line == element.line);
                            if (idx > -1) {
                                purchOrderDetail[idx].line_key = element.key;
                                purchOrderDetail[idx].key = newMainKey; 
                            }
                            else {
                                purchOrderDetail.push({
                                    id: null,
                                    ref: purchOrderDetail[0].ref,
                                    no: null,
                                    line: element.line,
                                    key: newMainKey,
                                    line_key: element.key,
                                    qty: 0
                                })
                            }
                        })
                        resolve(purchOrderDetail);
                    });
                }
                // Handle SOAP request error
                //else if (response.statusCode === undefined || response.statusCode != 200) {
                else {
                    console.log("Options: ", options);
                    console.log("Error:", error);
                    parser.parseString(body, (err, result) => {
                        if (result) {
                            faultcode =  result.Envelope.Body.Fault.faultcode._;
                            reject("Failed to get latest NAV key for " + purchOrderDetail[0].no + ": " + faultcode);
                        }
                        else {
                            reject("Failed to get latest NAV key for " + purchOrderDetail[0].no + ": " + err);
                        } 
                    });
                }
                /*else if (error) {
                    reject("Failed to get latest NAV key for " + purchOrderDetail[0].no + ": " + error);
                }
                else {
                    reject("Failed to get latest NAV key for " + purchOrderDetail[0].no + ": " + body);
                }*/
                this.logger.error('E ' + response.statusCode + " " + response.statusMessage, {label: contextName + this.getLatestNAVKey.name});  
            });
        });
    }


    async postNAVUpdate(key, docNo, service = "purchaseorder") {
        
        let xml = 
`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pur="urn:microsoft-dynamics-schemas/page/` + service + `">
<soapenv:Header/>
<soapenv:Body>
   <pur:PostDocReceive>
      <pur:document>`+ key +`</pur:document>
   </pur:PostDocReceive>
</soapenv:Body>
</soapenv:Envelope>`

        let headerText = this.generateHeader('PostDocReceive', xml.length, service);
        options.body = xml;
        options.headers = headerText;

        return new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    resolve(true);
                }
                // Handle SOAP request error
                //else if (response.statusCode === undefined || response.statusCode != 200) {
                else {
                    console.log("Fail Post:", response);
                    console.log("Body Post:", body);
                    parser.parseString(body, (err, result) => {
                        var faultcode =  result.Envelope.Body.Fault.faultstring._;
                        reject("Failed to post1 " + docNo + ": " + faultcode);
                    });
                }
                /*else if (error) {
                    reject("Failed to post2 " + docNo + ": " + error);
                }
                else {
                    reject("Failed to post3 " + docNo + ": " + body);
                }*/
                this.logger.info(username + ' postNAVUpdate E ' + response.statusCode + " " + response.statusMessage, {label: contextName + this.postNAVUpdate.name}); 
            })
        });
    }

    generateHeader(page, length, service = "PurchaseOrder") {

        if (service.toLowerCase() == "purchaseorder") { service = "PurchaseOrder" }
        if (service.toLowerCase() == "transferorder") { service = "TransferOrder" }

        let user = process.env.NAV_USER_PREFIX + username;
        let auth = this.request.user['web_token'];
        let token = 'Basic ' + Buffer.from(user + ':' + auth).toString('base64');
        let text = {
            'Content-Type':'text/xml;charset=utf-8',
            'Accept-Encoding': 'gzip,deflate',
            'Content-Length': length,
            'SOAPAction': "urn:microsoft-dynamics-schemas/page/" + service + ":" + page,
            'Host': process.env.NAV_DOMAIN,
            'Connection': 'Keep-Alive',
            'User-Agent': 'Apache-HttpClient/4.5.5 (Java/12.0.1)',
            'Authorization': token
        }

        if (service != "PurchaseOrder") {
            options.url = 'http://' + process.env.NAV_DOMAIN + '/' + process.env.NAV_ENV + '_WS/WS/' + process.env.NAV_COMPANY + '/Page/' + service;
        }
        return text;
    }
}
