import { Model } from 'mongoose';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Stockkeeping, StockkeepingDocument } from './stockkeeping.schema';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { isEmpty } from 'rxjs/operators';

var request = require('request');
var xml2js = require('xml2js');
var strip = require('xml2js').processors.stripPrefix;
var parser = new xml2js.Parser({explicitArray: false, trim: true, tagNameProcessors: [strip]});
var faultcode;
var username = '';
var contextName = 'StockkeeppingService: ';

var options = {
    url: '',
    method: 'POST',
    body: 'none',
    headers: {}
};

@Injectable()
export class StockkeepingService {
    constructor(
        @InjectModel('stockkeepings') private StockkeepingModel: Model<StockkeepingDocument>,
        @Inject(REQUEST) private request: Request,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        var url = 'http://' + process.env.NAV_DOMAIN + '/' + process.env.NAV_ENV + '_WS/WS/' + process.env.NAV_COMPANY + '/Page/ItemLedger';
        options.url = url;
    }

    async findAll(): Promise<Stockkeeping[]> {
        let loc = this.request.user['location'];
        let locExp = [];
        locExp = loc[0].code.split(/(?:\|)+/);
        this.logger.info("Username: " + username + ", Location: " + locExp, {label: contextName + this.findAll.name});
        if (loc != "WH-SYD-A1") {
            return this.StockkeepingModel.find({ "location" : {'$in': locExp }}).exec();
        }
        else {
            return this.StockkeepingModel.find().exec();
        }
    }

    async updateQuantity(newInv) {
        await this.StockkeepingModel.bulkWrite(
            newInv.map(({ no, vari, loc, qty }) => 
              ({
                "updateOne": {
                  "filter": { "no": no, "variant":vari, "location": loc },
                  "update": {
                    "$set": { "inventory": qty },
                  },
                  "upsert": false
                }
              })
            )
          )
          .catch((error) => {
              console.error(error);
              throw error;
          });
          this.logger.info(username + " has successfully updated Stockkeepping: " + JSON.stringify(newInv), {label: contextName + this.updateQuantity.name})
    }

    async refreshInventory(items) {
        // Demo mode: no ERP configured, so there is nothing to refresh from.
        if (!process.env.NAV_DOMAIN) { return true; }
        console.log("Refresh");
        username = this.request.user['username'];
        type UpdType = {no: string, variant: string, location: string, inventory: number};
        let updInv: Array<UpdType> = [];

        try {

            // for await (const contents of items.map(item => this.getNAVInventory(item))) {
            //     updInv.push(contents);
            // }

            await Promise.all(items.map(async item => {
                const update: UpdType = await this.getNAVInventory(item) as UpdType;
                updInv.push(update);
                item.stock[0].inventory = update.inventory;
            }));

            //console.log("Result: ", updInv);
            // items.forEach(async element => {
            //     const inv = await this.getNAVInventory(element);
            // });
            //const invupdate = await this.getNAVInventory(items);
            await this.updateQuantity(updInv);
            return true;
        } catch(e) {
            console.log(e);
            throw e;
        }
    }

    async getNAVInventory(item) {

        let variant = item.items.revision == ' ' ? "''" : item.items.revision;

        let newInv = {
            no: item.items.item_no, 
            variant: item.items.revision, 
            location: item.location, 
            inventory: 0
        };

        if (item.stock.length == 0) {
            item.stock[0] = newInv;
        }

        let xml = 
        `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:item="urn:microsoft-dynamics-schemas/page/itemledger">
        <soapenv:Header/>
        <soapenv:Body>
            <item:ReadMultiple>
                <item:filter>
                    <item:Field>Item_No</item:Field>
                    <item:Criteria>` + item.items.item_no + `</item:Criteria>
                </item:filter>
                <item:filter>
                    <item:Field>Variant_Code</item:Field>
                    <item:Criteria>` + variant + `</item:Criteria>
                </item:filter>
                <item:filter>
                    <item:Field>Location_Code</item:Field>
                    <item:Criteria>` + item.location + `</item:Criteria>
                </item:filter>
                <item:filter>
                    <item:Field>Remaining_Quantity</item:Field>
                    <item:Criteria>&gt;0</item:Criteria>
                </item:filter>
                <item:bookmarkKey></item:bookmarkKey>
                <item:setSize></item:setSize>
            </item:ReadMultiple>
        </soapenv:Body>
        </soapenv:Envelope>`
  
        console.log("xml: ", xml);
        let headerText = this.generateHeader('ReadMultiple', xml.length);
        options.body = xml;
        options.headers = headerText;

        //Need to catch server not responding error, eg: if server url has changed
        return new Promise((resolve, reject) =>
            request(options, (error, response, body) => {
                
                if (!error && response.statusCode == 200) {
                    parser.parseString(body, (err, result) => {
                        let resultList = result.Envelope.Body.ReadMultiple_Result.ReadMultiple_Result.ItemLedger;
                        console.log(resultList);
                        let remaining_qty = 0;

                        if (resultList) {
                            if (resultList.length > 1) {
                                resultList.forEach(res => {
                                    remaining_qty += parseInt(res.Remaining_Quantity);
                                });
                            }
                            else {
                                remaining_qty = parseInt(resultList.Remaining_Quantity);
                            }
                        }

                        newInv.inventory = remaining_qty;

                        resolve(newInv);
                    });
                }
                // Handle SOAP request error
                else if (response?.statusCode != 200) {
                    console.log(response);
                    parser.parseString(body, (err, result) => {
                        console.log(body);
                        var faultcode = result.Envelope.Body.Fault.faultstring._;
                        if (faultcode == 'a:Microsoft.Dynamics.Nav.Service.WebMetadata.ServiceBrokerException') {
                            console.log("Failed to post");
                        }
                        reject(faultcode);
                    });
                }
                //console.log('E', response.statusCode, response.statusMessage);  
            })
        );
    }

    // async getNAVInventory(items) {
    //     console.log("Refreshing inventory");
    //     let itemList = [];
    //     let itemString = '';

    //     let location = items[0].items.location;
  
    //     items.forEach(element => {
    //         itemList.push(element.items.item_no);
    //     });
    //     itemString = itemList.join('|');
  
    //     //need to take variant into account. Need to send separate NAV request for each items...
    //     let xml = 
    //     `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:item="urn:microsoft-dynamics-schemas/page/itemledger">
    //     <soapenv:Header/>
    //     <soapenv:Body>
    //         <item:ReadMultiple>
    //             <item:filter>
    //                 <item:Field>Item_No</item:Field>
    //                 <item:Criteria>` + itemString + `</item:Criteria>
    //             </item:filter>
    //             <item:filter>
    //                 <item:Field>Location_Code</item:Field>
    //                 <item:Criteria>` + location + `</item:Criteria>
    //             </item:filter>
    //             <item:filter>
    //                 <item:Field>Remaining_Quantity</item:Field>
    //                 <item:Criteria>&gt;0</item:Criteria>
    //             </item:filter>
    //             <item:bookmarkKey></item:bookmarkKey>
    //             <item:setSize></item:setSize>
    //         </item:ReadMultiple>
    //     </soapenv:Body>
    //     </soapenv:Envelope>`
  
    //     let headerText = this.generateHeader('ReadMultiple', xml.length);
    //     options.body = xml;
    //     options.headers = headerText;

    //     //Need to catch server not responding error, eg: if server url has changed
    //     return new Promise((resolve, reject) =>
    //         request(options, (error, response, body) => {
                
    //             if (!error && response.statusCode == 200) {
    //                 parser.parseString(body, (err, result) => {
    //                     let resultList = result.Envelope.Body.ReadMultiple_Result.ReadMultiple_Result.ItemList;
    //                     //console.log("Result", resultList);
    //                     let newInv: Array<{no: string, loc: string, qty: number}> = [];
  
    //                     resultList.forEach(element => {
    //                         newInv.push({
    //                             no: element.No,
    //                             loc: location,
    //                             qty: element.Inventory
    //                         });
    //                     });

    //                     resolve(newInv);
    //                 });
    //             }
    //             // Handle SOAP request error
    //             else if (response?.statusCode != 200) {
    //                 parser.parseString(body, (err, result) => {
    //                     console.log(body);
    //                     var faultcode = result.Envelope.Body.Fault.faultstring._;
    //                     if (faultcode == 'a:Microsoft.Dynamics.Nav.Service.WebMetadata.ServiceBrokerException') {
    //                         console.log("Failed to post");
    //                     }
    //                     reject(faultcode);
    //                 });
    //             }
    //             console.log('E', response.statusCode, response.statusMessage);  
    //         })
    //     );
    // }

    generateHeader(page, length) {
        
        let user = process.env.NAV_USER_PREFIX + username;
        let auth = this.request.user['web_token'];
        let token = 'Basic ' + Buffer.from(user + ':' + auth).toString('base64');
        let text = {
            'Content-Type':'text/xml;charset=utf-8',
            'Accept-Encoding': 'gzip,deflate',
            'Content-Length': length,
            'SOAPAction': "urn:microsoft-dynamics-schemas/page/itemledger:" + page,
            'Host': process.env.NAV_DOMAIN,
            'Connection': 'Keep-Alive',
            'User-Agent': 'Apache-HttpClient/4.5.5 (Java/12.0.1)',
            'Authorization': token
        }
        return text;
    }

}
