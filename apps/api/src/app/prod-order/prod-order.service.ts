import { Model } from 'mongoose';
import { Injectable, Inject, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { ProdOrder, ProdOrderDocument } from './prod-order.schema';
import { ProdOrderUpdateDTO } from './prod-order.update.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { summariseProdOrder } from '@webproject/data';

import { UserService } from '../user/user.service';

var request = require('request');
var xml2js = require('xml2js');
var strip = require('xml2js').processors.stripPrefix;
var parser = new xml2js.Parser({explicitArray: false, trim: true, tagNameProcessors: [strip]});
var faultcode;
var username = '';
var ObjectID = require('mongodb').ObjectID;
var contextName = 'ProdOrderService: ';

var options = {
    url: '',
    method: 'POST',
    body: 'none',
    headers: {}
};

@Injectable()
export class ProdOrderService {
    constructor(
        @InjectModel('prod_orders') private ProdOrderModel: Model<ProdOrderDocument>,
        private userService: UserService,
        @Inject(REQUEST) private request: Request,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        var url = 'http://' + process.env.NAV_DOMAIN + '/' + process.env.NAV_ENV + '_WS/WS/' + process.env.NAV_COMPANY + '/Page/ConsumptionJournal';
        options.url = url;
    }

    async findAll(): Promise<ProdOrder[]> {
        username = this.request.user['username'];
        //let locFilter = this.request.user['default_loc'];
        let loc = this.request.user['location'];
        let locExp = loc.map(value => value.code);
        
        // let locResult = await this.userService.checkLoc(username, locFilter);
        // if (locResult.length > 0) {
        //     locExp = locResult[0].location[0].code.split(/(?:\|)+/);
        // }
        // else {
        //     throw new BadRequestException("No location found for user");
        // }

        this.logger.info("Username: " + username + ", Location: " + locExp, {label: contextName + this.findAll.name});

        const orders = await this.ProdOrderModel.aggregate([
            {"$match" : { '$and': [
                { "parent_ref" : 0 },
                { "status" : "Released" },
                { "location" : { "$in": locExp } }
            ] } },
            {
                "$lookup": {
                    "from": 'purchase_orders',
                    "let":{"res":"$doc_no", "num":"$source_no", "project":"$project"},
                    "pipeline":[
                        {"$unwind":"$items"},
                        {"$match":{"$expr":{"$and":[
                            {"$eq":["$$res","$items.prod_order"]},
                            {"$eq":["$$num","$items.item_no"]},
                            //{"$eq":["$$rev","$items.revision"]},
		                    {"$eq":["$$project","$items.project"]}
                            ]}
                        }},
                        {"$project": { '_id': 0, 'doc_no': 1, 'vendor': 1 }},
                    ],
                    "as": 'result'
                }
            },
            {
                "$lookup": {
                    "from": 'prod_orders',
                    // 'let' assigns variable name to fields inside prod-order collection
                    "let":{"no":"$items.item_no", "project":"$project", "loc":"$location", "self":"$doc_no"},
                    "pipeline":[
                        {"$match":{"$expr":{"$and":[
                            {"$eq":["$$no","$source_no"]},
                            {"$eq":[0,"$parent_ref"]},
                            {"$eq":["$$project", "$project"]},
                            {"$eq":["$$loc","$location"]},
                            // an MRP is not "another MRP" that produces its own item
                            {"$ne":["$$self","$doc_no"]},
                            ]}
                        }},
                        {"$project": { '_id': 0, 'doc_no': 1, 'vendor': 1 }},
                    ],
                    "as": "mrp_result"
                }
            },
            {
                "$lookup": {
                    "from": "prod_orders",
                    "let":{"doc":"$doc_no", "ref":"$parent_ref"},
                    "pipeline":[
                        {"$match":{"$expr":{"$and":[
                            {"$eq":["$$doc","$doc_no"]},
                            {"$ne":["$$ref", "$parent_ref"]}
                            ]}
                        }},
                        {"$project": { '_id': 0, 'parent_ref': 1 }},
                    ],
                    "as": "parents"
                }
            }
        ]);
        // Status and progress, so the list can show a progress bar and filter by status.
        return orders.map(order => ({ ...order, summary: summariseProdOrder(order) }));
    }

    async findSubassembly(mrpId): Promise<ProdOrder[]> {
        let loc = this.request.user['location'];
        let locExp = loc.map(value => value.code);

        this.logger.info("Username: " + username + ", MRP: " + mrpId, {label: contextName + this.findSubassembly.name});
        
        return this.ProdOrderModel.aggregate([
            {"$match" : { '$and': [
                { "doc_no" : mrpId },
                { "parent_ref" : 0 },
                { "location" : { "$in": locExp } }
            ] } }, 
            {"$unwind":"$items"},
            {
                "$lookup": {
                    "from": 'purchase_orders',
                    "let":{"res":"$doc_no", "num":"$items.item_no", "project":"$project", "rev":"$items.revision"},
                    "pipeline":[
                        {"$unwind":"$items"},
                        {"$match":{"$expr":{"$and":[
                            {"$eq":["$$res","$items.prod_order"]},
                            {"$eq":["$$num","$items.item_no"]},
                            {"$eq":["$$rev","$items.revision"]},
		                    {"$eq":["$$project","$items.project"]}
                            ]}
                        }},
                        {"$project": { '_id': 0, 'doc_no': 1, 'vendor': 1 }},
                    ],
                    "as": 'result'
                }
            },
            {
                "$lookup": {
                    "from": 'prod_orders',
                    // 'let' assigns variable name to fields inside prod-order collection
                    "let":{"no":"$items.item_no", "project":"$project", "loc":"$location", "self":"$doc_no"},
                    "pipeline":[
                        {"$match":{"$expr":{"$and":[
                            {"$eq":["$$no","$source_no"]},
                            {"$eq":[0,"$parent_ref"]},
                            {"$eq":["$$project", "$project"]},
                            {"$eq":["$$loc","$location"]},
                            // an MRP is not "another MRP" that produces its own item
                            {"$ne":["$$self","$doc_no"]},
                            ]}
                        }},
                        {"$project": { '_id': 0, 'doc_no': 1, 'vendor': 1 }},
                    ],
                    "as": "mrp_result"
                }
            },
            {   
                "$addFields": {
                    "result": 
                        { "$concatArrays": [ "$result", "$mrp_result" ] }
                }
            },
            {
                "$lookup": {
                    "from": "prod_orders",
                    "let":{"doc":"$doc_no", "ref":"$parent_ref"},
                    "pipeline":[
                        {"$match":{"$expr":{"$and":[
                            {"$eq":["$$doc","$doc_no"]},
                            {"$ne":["$$ref", "$parent_ref"]}
                            ]}
                        }},
                        {"$project": { '_id': 0, 'parent_ref': 1 }},
                    ],
                    "as": "parents"
                }
            }
        ]);
    }

    async findComponents(mrpId, lineId): Promise<ProdOrder[]> {
        let loc = this.request.user['location'];
        let locExp = loc.map(value => value.code);
        
        lineId = parseInt(lineId);

        this.logger.info("Username: " + username + ", MRP: " + mrpId + ", Subassembly:" + lineId, {label: contextName + this.findComponents.name});

        return this.ProdOrderModel.aggregate([
            {"$match" : { "$and": [
                { "doc_no" : mrpId },
                { "parent_ref" : lineId },
                { "location" : { "$in": locExp } }
            ] } },
            {"$unwind":"$items"},

            // Find PO of items
            {
                "$lookup": {
                    "from": 'purchase_orders',
                    // 'let' assigns variable name to fields inside prod-order collection
                    "let":{"num":"$items.item_no", "project":"$project", "rev":"$items.revision", "loc":"$location"},
                    "pipeline":[
                        {"$unwind":"$items"},
                        {"$match":{"$expr":{"$and":[
                            {"$eq":["$$num","$items.item_no"]},
                            {"$eq":["$$rev","$items.revision"]},
		                    {"$eq":["$$project","$items.project"]},
                            {"$eq":["$$loc","$location"]}
                            ]}
                        }},
                        {"$project": { '_id': 0, 'doc_no': 1, 'vendor': 1 }},
                        // {"$project": { '_id': 0, 'doc_no': 1, 'vendor': 1, 'qty' : { "$sum": "$items.qty" }} },
                        // {"$group": { '_id': '$doc_no', 'vendor' : { '$first': '$vendor' }, 'qty': { '$sum': '$qty' }} }
                    ],
                    "as": 'result'
                }
            },
            // Find MRP that produces this item
            {
                "$lookup": {
                    "from": 'prod_orders',
                    // 'let' assigns variable name to fields inside prod-order collection
                    "let":{"no":"$items.item_no", "project":"$project", "loc":"$location", "self":"$doc_no"},
                    "pipeline":[
                        {"$match":{"$expr":{"$and":[
                            {"$eq":["$$no","$source_no"]},
                            {"$eq":[0,"$parent_ref"]},
                            {"$eq":["$$project", "$project"]},
                            {"$eq":["$$loc","$location"]},
                            // an MRP is not "another MRP" that produces its own item
                            {"$ne":["$$self","$doc_no"]},
                            ]}
                        }},
                        {"$project": { '_id': 0, 'doc_no': 1, 'vendor': 1 }},
                    ],
                    "as": "mrp_result"
                }
            },
            {   
                "$addFields": {
                    "result": 
                        { "$concatArrays": [ "$result", "$mrp_result" ] }
                }
            },
            //lookup current inventory from Stockkeepings table
            {
                "$lookup": {
                    "from": 'stockkeepings',
                    "let":{"num":"$items.item_no", "rev":"$items.revision", "loc":"$location"},
                    "pipeline":[
                          {"$match":{"$expr":{"$and":[
                            {"$eq":["$$num","$no"]},
                            {"$eq":["$$rev","$variant"]},
                            {"$eq":["$$loc","$location"]}
                            ]}
                        }}
                    ],
                    "as": 'stock'
                },
            }
        ]);
    }

    updateQuantity(prodOrderDetail: ProdOrderUpdateDTO[]) {
        
          this.ProdOrderModel.bulkWrite(
            prodOrderDetail.map(({ id, doc_no, parent_ref, line, qty }) => 
              ({
                "updateOne": {
                  "filter": { "doc_no": doc_no, "parent_ref": parent_ref, "items.line_no": line },
                  "update": {
                    "$set": { "items.$.qty_to_receive": 0 },
                    "$inc": { "items.$.qty_received": +qty,
                              "items.$.qty_remaining": -qty  }
                  },
                  "upsert": false
                }
              })
            )
          )
          .catch((error) => {
            //this.logger.error(error);
            throw error;
          });
          this.logger.info(username + " has sucessfully updated Mongo production order " + prodOrderDetail, {label: contextName + this.updateQuantity.name});
          
    }

    // async updateNAV(prodOrderDetail: ProdOrderUpdateDTO[]) {
    //     username = this.request.user['username'];
    //     try {
    //         const updateKey = await this.updateNAVConsumption(prodOrderDetail);
    //         const postResult = await this.postNAVUpdate(updateKey);
    //         //purchOrderDetail = purchOrderDetail.filter(e => e.id !== null);
    //         const testing = this.updateQuantity(prodOrderDetail);
    //         console.log("Testing", testing);
    //         return testing;
    //     } catch(e) {
    //         console.log(e);
    //         throw e;
    //     }
    // }



    // What a user may post: no more than is left on the line, on an order at one of their locations, and for consumption
    // no more than is in stock. The page limits this too, but only the server can be relied on. Rows with no quantity
    // are left out, and the item and location come from the stored order, not from the request.
    private async checkedRows(prodOrderDetail: ProdOrderUpdateDTO[], type: string): Promise<ProdOrderUpdateDTO[]> {
        const given = Array.isArray(prodOrderDetail) ? prodOrderDetail.filter(e => e && e.qty) : [];
        if (given.length === 0) {
            throw new BadRequestException('Enter a quantity.');
        }
        const locCodes = this.request.user['location'].map(value => value.code);
        const posted = new Map<string, number>();
        const rows = [];
        for (const row of given) {
            const qty = Number(row.qty);
            if (!isFinite(qty) || qty <= 0) {
                throw new BadRequestException('The quantity must be more than 0.');
            }
            if (typeof row.doc_no !== 'string' || typeof row.parent_ref !== 'number') {
                throw new BadRequestException('That order line is not valid.');
            }
            const order: any = await this.ProdOrderModel.findOne({ doc_no: row.doc_no, parent_ref: row.parent_ref }).lean();
            const item = order && (order.items || []).find(i => i.line_no === row.line);
            if (!item) {
                throw new NotFoundException('That order line no longer exists.');
            }
            if (!locCodes.includes(order.location)) {
                throw new ForbiddenException(`${order.doc_no} is not at your location.`);
            }
            // The same line twice in one request counts as one amount.
            const key = row.doc_no + '/' + row.parent_ref + '/' + row.line;
            const total = (posted.get(key) || 0) + qty;
            if (total > item.qty_remaining) {
                throw new BadRequestException(`Only ${item.qty_remaining} left on line ${item.line_no} of ${order.doc_no}.`);
            }
            posted.set(key, total);
            if (type === 'consumption') {
                const stock: any = await this.ProdOrderModel.db.collection('stockkeepings').findOne({ no: item.item_no, variant: item.revision, location: order.location });
                if (stock && total > stock.inventory) {
                    throw new BadRequestException(`Only ${stock.inventory} of ${item.item_no} in stock.`);
                }
            }
            rows.push({ ...row, type, qty, item_no: item.item_no, variant: item.revision, location: order.location });
        }
        return rows;
    }

    // Demo mode (no ERP configured): apply received/consumed quantities to the local database only.
    private async applyLocally(prodOrderDetail: ProdOrderUpdateDTO[]) {
        const ops = prodOrderDetail.filter(e => e.qty >= 1).map(e => {
            return {
                updateOne: {
                    filter: { doc_no: e.doc_no, parent_ref: e.parent_ref, 'items.line_no': e.line },
                    update: { $set: { 'items.$.qty_to_receive': 0 }, $inc: { 'items.$.qty_received': +e.qty, 'items.$.qty_remaining': -e.qty } },
                },
            };
        });
        if (ops.length) { await this.ProdOrderModel.bulkWrite(ops as any); }
        // Keep the demo inventory consistent: consumption draws stock down, output adds finished goods.
        const stock = this.ProdOrderModel.db.collection('stockkeepings');
        for (const e of prodOrderDetail.filter(x => x.qty >= 1)) {
            const delta = e.type === 'consumption' ? -e.qty : +e.qty;
            await stock.updateOne({ no: e.item_no, variant: e.variant, location: e.location }, { $inc: { inventory: delta } });
        }
        return true;
    }

    async updateNAVConsumption(prodOrderDetail: ProdOrderUpdateDTO[]) {
        username = this.request.user['username'];
        prodOrderDetail = await this.checkedRows(prodOrderDetail, 'consumption');
        if (!process.env.NAV_DOMAIN) { return this.applyLocally(prodOrderDetail); }
        let xml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="urn:microsoft-dynamics-schemas/page/consumptionjournal">
        <soapenv:Header/>
        <soapenv:Body>
           <con:CreateMultiple>
              <con:CurrentJnlBatchName>` + process.env.NAV_CONSUMPTION_JOURNAL + `</con:CurrentJnlBatchName>
              <con:ConsumptionJournal_List>`

              prodOrderDetail.forEach(element => {
                  if(element.qty >= 1) {
                xml +=
                 `<con:ConsumptionJournal>
                    <con:Order_No>` + element.doc_no + `</con:Order_No>
                    <con:Order_Line_No>` + element.parent_ref + `</con:Order_Line_No>
                    <con:Prod_Order_Comp_Line_No>` + element.line + `</con:Prod_Order_Comp_Line_No>
                    <con:Document_No>` + element.doc_no + `</con:Document_No>
                    <con:Item_No>` + element.item_no + `</con:Item_No>
                    <con:Variant_Code>` + element.variant + `</con:Variant_Code>
                    <con:Location_Code>` + element.location + `</con:Location_Code>
                    <con:Quantity>` + element.qty + `</con:Quantity>
                 </con:ConsumptionJournal>`
                  }
            });
            //<con:Shortcut_Dimension_1_Code>` + 1040 + `</con:Shortcut_Dimension_1_Code>
            xml += `</con:ConsumptionJournal_List>
           </con:CreateMultiple>
        </soapenv:Body>
     </soapenv:Envelope>`

        let headerText = this.generateHeader('CreateMultiple', xml.length);

        options.body = xml;
        options.headers = headerText;

        console.log("XML: ", xml);

        return new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    parser.parseString(body, (err, result) => {
                        let resultList = result.Envelope.Body.CreateMultiple_Result.ConsumptionJournal_List.ConsumptionJournal;
                        let lineKeys = [];
                        //resolve(true);
                        if (resultList.length == 1 || (!resultList.length && resultList.Key)) {
                            lineKeys.push(resultList.Key);
                        }
                        else {
                            resultList.forEach(element => {
                                lineKeys.push(element.Key);
                            })
                        }
                        this.postNAVUpdate(lineKeys).then((response) => {
                            this.updateQuantity(prodOrderDetail);
                            this.logger.info(username + " has successfully updated NAV Consumption: " + xml, {label: contextName + this.updateNAVConsumption.name})
                            resolve(true);
                        }).catch((error) => {
                            lineKeys.forEach(key => {
                                this.deleteConsumptionLines(key);
                            })
                            reject(error);
                        });
                    });
                }
                // Handle SOAP request error
                else if (response.statusCode != 200) {
                    parser.parseString(body, (err, result) => {
                        if (result) {
                            faultcode =  result.Envelope.Body.Fault.faultstring._;
                            reject(faultcode);
                        }
                        else {
                            reject(err);
                        }  
                    });
                }
                this.logger.info(username + ' prodOrder updateNAVConsumption E: ' + " " + response.statusCode + " " + response.statusMessage, {label: contextName + this.updateNAVConsumption.name});
            });
        });
    }


    async updateNAVOutput(prodOrderDetail: ProdOrderUpdateDTO[]) {
        username = this.request.user['username'];
        prodOrderDetail = await this.checkedRows(prodOrderDetail, 'output');
        if (!process.env.NAV_DOMAIN) { return this.applyLocally(prodOrderDetail); }

        let xml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:out="urn:microsoft-dynamics-schemas/page/outputjournal">
        <soapenv:Header/>
        <soapenv:Body>
           <out:CreateMultiple>
              <out:CurrentJnlBatchName>` + process.env.NAV_OUTPUT_JOURNAL + `</out:CurrentJnlBatchName>
              <out:OutputJournal_List>`

              prodOrderDetail.forEach(element => {
                if(element.qty >= 1) {
              xml +=
                 `<out:OutputJournal>
                    <out:Order_No>` + element.doc_no + `</out:Order_No>
                    <out:Item_No>` + element.item_no + `</out:Item_No>
                    <out:Order_Line_No>` + element.parent_ref + `</out:Order_Line_No>
                    <out:Variant_Code>` + element.variant + `</out:Variant_Code>
                    <out:Shortcut_Dimension_1_Code>` + 1040 + `</out:Shortcut_Dimension_1_Code>
                    <out:Shortcut_Dimension_2_Code>` + element.project + `</out:Shortcut_Dimension_2_Code>
                    <out:Location_Code>` + element.location + `</out:Location_Code>
                    <out:Output_Quantity>` + element.qty + `</out:Output_Quantity>
                    <out:Unit_of_Measure_Code>PCS</out:Unit_of_Measure_Code>
                    <out:External_Document_No>SHP-TEST</out:External_Document_No>
                 </out:OutputJournal>`
                }
            });

            xml += `</out:OutputJournal_List>
           </out:CreateMultiple>
        </soapenv:Body>
     </soapenv:Envelope>`

        console.log(xml);

        let headerText = this.generateHeader('CreateMultiple', xml.length, "outputjournal");

        options.body = xml;
        options.headers = headerText;

        console.log("opt: ", headerText);

        return new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    parser.parseString(body, (err, result) => {
                        //resolve(true);
                        let resultList = result.Envelope.Body.CreateMultiple_Result.OutputJournal_List.OutputJournal;
                        let lineKeys = [];
                        if (resultList.length == 1 || (!resultList.length && resultList.Key)) {
                            lineKeys.push(resultList.Key);
                        }
                        else {
                            resultList.forEach(element => {
                                lineKeys.push(element.Key);
                            })
                        }
                        //postNAVupdate for outputjournal does not work in TEST env because of a bug where Document No is not automatically generated in output journal
                        this.postNAVUpdate(lineKeys, "outputjournal").then((response) => {
                            this.updateQuantity(prodOrderDetail);
                            this.logger.info(username + " has successfully updated NAV Output: " + xml, {label: contextName + this.updateNAVOutput.name})
                            resolve(true);
                        }).catch((error) => {
                            lineKeys.forEach(key => {
                                this.deleteConsumptionLines(key);
                            })
                            reject(error);
                        });
                    });
                }
                // Handle SOAP request error
                else if (response.statusCode != 200) {
                    parser.parseString(body, (err, result) => {
                        if (result) {
                            faultcode =  result.Envelope.Body.Fault.faultstring._;
                            reject(faultcode);
                        }
                        else {
                            reject(err);
                        }  
                    });
                }
                this.logger.info(username + 'prodOrder updateNAVOutput E: ' + " " + response.statusCode + " " + response.statusMessage, {label: contextName + this.updateNAVOutput.name});
            });
        });
    }


    postNAVUpdate(keys, service = "consumptionjournal") {
        let xml = 
`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="urn:microsoft-dynamics-schemas/page/` + service + `>
<soapenv:Header/>
<soapenv:Body>
   <con:PostLine>`
   keys.forEach(element => {
    xml +=
      `<con:line>`+ element +`</con:line>`
   })
   xml += `</con:PostLine>
</soapenv:Body>
</soapenv:Envelope>`


        let headerText = this.generateHeader('PostLine', xml.length, service);
        options.body = xml;
        options.headers = headerText;

        console.log(xml);
        console.log(headerText);

        return new Promise((resolve, reject) =>
            request(options, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    parser.parseString(body, (err, result) => {
                        resolve(true);
                    });
                }
                // Handle SOAP request error
                else if (response.statusCode != 200) {
                    parser.parseString(body, (err, result) => {
                        this.logger.log('info',body);
                        var faultcode =  result.Envelope.Body.Fault.faultstring._;
                        // if (faultcode == 'a:Microsoft.Dynamics.Nav.Service.WebMetadata.ServiceBrokerException') {
                        //     this.logger.info("Failed to post");
                        // }
                        reject(faultcode);
                    });
                }
                this.logger.info(username + ' postNAVUpdate E ' + response.statusCode + " " + response.statusMessage, {label: contextName + this.postNAVUpdate.name});  
            })
        );
    }

    deleteConsumptionLines(key) {
        let xml = 
`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="urn:microsoft-dynamics-schemas/page/consumptionjournal">
<soapenv:Header/>
<soapenv:Body>
   <con:Delete>
      <con:CurrentJnlBatchName>` + process.env.NAV_CONSUMPTION_JOURNAL + `</con:CurrentJnlBatchName>
      <con:Key>` + key +`</con:Key>
   </con:Delete>
</soapenv:Body>
</soapenv:Envelope>`

        let headerText = this.generateHeader('Delete', xml.length);
        options.body = xml;
        options.headers = headerText;

        let callback = (error, response, body) => {
            if (!error && response.statusCode == 200) {
                this.logger.info("Consumption journal line deleted");
            }
            // Handle SOAP request error
            else if (response.statusCode != 200) {
                parser.parseString(body, (err, result) => {
                    var faultcode =  result.Envelope.Body.Fault.faultstring._;
                    this.logger.info("Consumption journal line deletion unsuccessful: " + faultcode);
                });
            }
            this.logger.info(username + ' deleteConsumptionLines E ' + response.statusCode + " " + response.statusMessage, {label: contextName + this.deleteConsumptionLines.name});  
        };
        
        request(options, callback);
        //return success;
    }

    generateHeader(page, length, service = "consumptionjournal") {
        let user = process.env.NAV_USER_PREFIX + username;
        let auth = this.request.user['web_token'];
        let token = 'Basic ' + Buffer.from(user + ':' + auth).toString('base64');
        console.log("Service:" + service);
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

        if (service == "outputjournal") {
            options.url = 'http://' + process.env.NAV_DOMAIN + '/' + process.env.NAV_ENV + '_WS/WS/' + process.env.NAV_COMPANY + '/Page/OutputJournal';
        }

        return text;
    }


}
