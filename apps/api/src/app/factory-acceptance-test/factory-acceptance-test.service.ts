import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId, Model } from 'mongoose';
import { FAT, FATDocument } from './factory-acceptance-test.schema';
import { newFATDTO, FATcategory, FATchecklist } from './factory-acceptance-test.update.dto';
import { CheckList, ISerialSearchFilters, ISerialSearchResult, fatCheckCounts, parseSerialSearchQuery, summariseFatChecks } from '@webproject/data';
import { SORT_COLLATION, countPipeline, pagePipeline } from './serial-search';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { map } from 'rxjs/operators';
import { execPath } from 'process';
import { FatProjectService } from '../fat-project/fat-project.service';
import { error } from 'console';
import { loadTemplate, saveTemplateOverride } from './checklist-templates';
import { newUnitNumbers, stampChecks } from './fat-check-rules';

var username = '';
var request = require('request');
var mongoose = require('mongoose');

@Injectable()
export class FactoryAcceptanceTestService {

    constructor(
        @InjectModel('fat_checklist') private FATModel: Model<FATDocument>,
        @Inject(REQUEST) private request: Request,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly fatProjectService: FatProjectService,
        @InjectModel('users') private readonly users: Model<any>,
    ){}

    // Narrows a search to the units this user may see: the tenant's own staff see every unit, anyone else only the
    // units they are the checker of.
    private visible(filter: any) {
      const company = this.request.user['company'].toLowerCase();
      return company === "tenant-a" || company === "tenant-b" ? filter : {...filter, checker: company};
    }

    // The name to stamp on an answer: the person's name, or their username when they have none.
    private async whoAmI(): Promise<string> {
      const name = this.request.user['username'];
      const user: any = await this.users.findOne({username: name}).lean().exec();
      return (user && user.name) || name;
    }

    //////////////////////////////////////////////
    // FINDS ALL UNITS IN A GIVEN PROJECT PHASE // 
    //////////////////////////////////////////////
    
    async findUnits(findProject, findPhase) {
      //const ObjectId = require('mongodb').ObjectId;
      let company = this.request.user['company'].toLowerCase();
      console.log(findProject);
      console.log(findPhase);
     
      if (company === "tenant-a" || company === "tenant-b") {
        return this.FATModel.find({phase: findPhase}, {doc_no: 1, unit_no: 1, location: 1, unit_type: 1, progress: 1, _id: 0});
      } else {
        return this.FATModel.find({project: findProject, phase: findPhase, checker: company}, {doc_no: 1, unit_no: 1, location: 1, unit_type: 1, progress: 1, _id: 0});
      }
    }

    ////////////////////////////////////////////////////////////////////
    // COUNTS THE OUTSTANDING (FAILED OR UNANSWERED) CHECKS OF EACH UNIT //
    // IN A PHASE. Same visibility as findUnits.                          //
    ////////////////////////////////////////////////////////////////////

    async phaseOutstanding(findProject, findPhase) {
      let company = this.request.user['company'].toLowerCase();
      const filter = (company === "tenant-a" || company === "tenant-b")
        ? {phase: findPhase}
        : {project: findProject, phase: findPhase, checker: company};
      const units = await this.FATModel.find(filter, {doc_no: 1, category: 1, _id: 0}).lean().exec() as any[];
      return units.map(unit => ({doc_no: unit.doc_no, ...fatCheckCounts(summariseFatChecks(unit.category))}));
    }

    // The same for one unit, with the list of checks still to do.
    async unitOutstanding(findProject, findPhase, findUnit) {
      const docs = await this.findCat(findProject, findPhase, findUnit);
      if (!docs || docs.length === 0) {
        throw new NotFoundException('Unit not found');
      }
      return summariseFatChecks(docs[0].category);
    }

    /////////////////////////////////////
    // FINDS A SPECIFIC UNIT BY DOC NO //
    /////////////////////////////////////
    
    async findUnitByDocNo(findDoc) {
      let company = this.request.user['company'].toLowerCase();
      if (company === "tenant-a" || company === "tenant-b") {
        return this.FATModel.find({doc_no: findDoc}, {unit_no: 1, location: 1, project: 1, phase: 1, unit_type: 1, progress: 1, _id: 0});
      } else {
        return this.FATModel.find({doc_no: findDoc, checker: company}, {unit_no: 1, location: 1, project: 1, phase: 1, unit_type: 1, progress: 1, _id: 0});
      }
    }

    ////////////////////////////////////
    // FINDS MULTIPLE UNITS BY DOC NO // 
    ////////////////////////////////////
    
    async findMultipleUnitsByDocNo(docArray) {
      let company = this.request.user['company'].toLowerCase();
      if (company === "tenant-a" || company === "tenant-b") {
        return this.FATModel.find({doc_no: { $in: docArray }});
      } else {
        return this.FATModel.find({doc_no: { $in: docArray }, checker: company});
      }
    }

    /////////////////////////////////////////////////////
    // FINDS ALL CHECKLIST CATEGORIES FOR A GIVEN UNIT // 
    /////////////////////////////////////////////////////

    async findCat(findProject, findPhase, findUnit) {
      let company = this.request.user['company'].toLowerCase();
      if (company === "tenant-a" || company == "tenant-b") {
        return this.FATModel.find({project: findProject, phase: findPhase, doc_no: findUnit}, {category: 1, _id: 0});
      } else {
        return this.FATModel.find({project: findProject, phase: findPhase, doc_no: findUnit, checker: company}, {category: 1, _id: 0});
      }
    }

    ///////////////////////////////////////////////////////////////
    // FINDS ALL CHECKLISTS IN A GIVEN CATEGORY FOR A GIVEN UNIT // 
    ///////////////////////////////////////////////////////////////

    async findCheck(findProject, findPhase, findUnit, findCat) {
      let company = this.request.user['company'].toLowerCase();
      if (company === "tenant-a" || company === "tenant-b") {
        return this.FATModel.aggregate(
          [
            {
                '$match': {
                    'project': findProject, 
                    'phase': findPhase, 
                    'doc_no': findUnit
                }
            }, {
                '$unwind': {
                    'path': '$category', 
                    'preserveNullAndEmptyArrays': false
                }
            }, {
                '$match': {
                    'category.name': findCat
                }
            }, {
              '$project': {
                  'checklist': '$category.checklists',
                  'version': '$category.version'
              }
          }
        ]    
        );
      } else {
        return this.FATModel.aggregate(
          [
            {
                '$match': {
                    'project': findProject, 
                    'phase': findPhase, 
                    'doc_no': findUnit,
                    'checker': company
                }
            }, {
                '$unwind': {
                    'path': '$category', 
                    'preserveNullAndEmptyArrays': false
                }
            }, {
                '$match': {
                    'category.name': findCat
                }
            }, {
              '$project': {
                  'checklist': '$category.checklists',
                  'version': '$category.version'
              }
          }
        ]    
        );
      }
    }


    //////////////////////////////////////////////
    // CREATES THE CHECKLISTS FOR A GIVEN PHASE // 
    //////////////////////////////////////////////

    // Refuses unit numbers that already exist, or that the form repeats. A unit number identifies one unit, and a second
    // one with the same number could never be opened or saved on its own.
    async assertNewUnitNumbers(entries: any[]) {
      const numbers = newUnitNumbers(entries);
      const repeated = numbers.filter((number, i) => numbers.indexOf(number) !== i);
      const existing: any[] = await this.FATModel.find({doc_no: {$in: numbers}}, {doc_no: 1, _id: 0}).lean().exec();
      const clashes = Array.from(new Set([...repeated, ...existing.map(unit => unit.doc_no)]));
      if (clashes.length > 0) {
        throw new ConflictException('These unit numbers already exist: ' + clashes.join(', ') + '. Change the prefix or starting number.');
      }
    }

    async create(FATDetail: newFATDTO) {
      console.log("HERE IS THE FATDETAIL", FATDetail);
      console.log("HERE IS THE FATDETAIL ENTRIES", FATDetail[0].entries);
      await this.assertNewUnitNumbers(FATDetail[0].entries);

      let newFATCollection: Array<newFATDTO> = [];
      //let checklist: CheckList[];

     // let existingUnits = await this.fatProjectService.getPhaseNumOfUnits(FATDetail[0].project, FATDetail[0].phase);
     // console.log("HERE ARE THE EXISTING UNITS FROM CREATE", existingUnits, existingUnits[0]);
     // let lastUnitNum = existingUnits[0].numOfUnits;
      //need to check that starting number is greater than lastUnitNum? Or check duplicate doc_no.
      let newUnits = 0;
      let unitNum = 0;
      //let thePrefix = await this.fatProjectService.getPrefix(FATDetail[0].project, FATDetail[0].phase);
     

      // Generating checklists for each Machine Type
      FATDetail[0].entries.forEach(async entry => {
        newUnits = 0;

        // Generate checklists for each unit of machine
        for (let j=0; j<entry.number; j++) {
          unitNum = entry.start + newUnits;
          newUnits += 1;
          let newFATChecklist = new newFATDTO;

          newFATChecklist.doc_no = entry.prefix + unitNum.toString();
          newFATChecklist.unit_no = '';
          newFATChecklist.project = FATDetail[0].project;
          newFATChecklist.phase = FATDetail[0].phase;
          newFATChecklist.prefix = entry.prefix;
          newFATChecklist.location = entry.location;
          newFATChecklist.checker = entry.checker;
          newFATChecklist.unit_type = entry.unit_type;
          newFATChecklist.variant = '';
          newFATChecklist.opt_printer = entry.printers;
          newFATChecklist.opt_honeywell = entry.honeywell;
          newFATChecklist.options = entry.options;
          newFATChecklist.category = [];
          newFATChecklist.comment = '';
          newFATChecklist.progress = 0;

          //check doc_no duplicate
          //let testDupe = await this.findUnitByDocNo(newFATChecklist.doc_no);

          //console.log("IS THERE A DUPE?", testDupe);
          // if (await this.findUnitByDocNo(newFATChecklist.doc_no)) {
          //   throw new error("Unable to create unit. Serial number " + newFATChecklist.doc_no + " already exists.");
          // }
          // else {
          // Generate the Unit Name Category
          if (entry.unit_type == "unit-y-standard" || entry.unit_type == "unit-y-hybrid-rotate" || entry.unit_type == "unit-y-air" || entry.unit_type == "unit-y-hybrid-fixed") {
            let unitName = <FATcategory> {
              name: "MCP Name",
              progress: 0,
              checklists: []
            }
            let unitNameChecklist = loadTemplate('mcp-name-checklist.json');
            unitNameChecklist.map(data => unitName.checklists.push(data));
            newFATChecklist.category.push(unitName);
          }
          else {
            let unitName = <FATcategory> {
              name: "Unit Name",
              progress: 0,
              checklists: []
            }
            let unitNameChecklist = loadTemplate('unit-name-checklist.json');
            unitNameChecklist.map(data => unitName.checklists.push(data));
            newFATChecklist.category.push(unitName);
          }

          // Generate the Kiosk common category
          if (entry.unit_type == "unit-z" || entry.unit_type == "unit-z-plus" || entry.unit_type == "unit-z-compact") {
            let kisokCommon = <FATcategory> {
              name: "Kiosk Common",
              progress: 0,
              checklists: []
            }
            let kioskCommonChecklist = loadTemplate('kiosk-common-checklist.json');
            kioskCommonChecklist.map(data => kisokCommon.checklists.push(data));
            newFATChecklist.category.push(kisokCommon);
          }

          // Generate the Unit X1 common category
          if (entry.unit_type == "unit-x1" || entry.unit_type == "unit-v1") {
            let unitX1Common = <FATcategory> {
              name: "Unit X1 Common",
              progress: 0,
              checklists: []
            }
            let unitX1CommonChecklist = loadTemplate('unit-x1-common-checklist.json');
            unitX1CommonChecklist.map(data => unitX1Common.checklists.push(data));
            newFATChecklist.category.push(unitX1Common);
          }

          // Generate the kiosk-b common category
          if (entry.unit_type == "kiosk-b") {
            let kioskBCommon = <FATcategory> {
              name: "Kiosk B Common",
              progress: 0,
              checklists: []
            }
            let kioskBCommonChecklist = loadTemplate('kiosk-b-common-checklist.json');
            kioskBCommonChecklist.map(data => kioskBCommon.checklists.push(data));
            newFATChecklist.category.push(kioskBCommon);
          }

          // Generate the KioskA common category
          if (entry.unit_type == "unit-v2" || entry.unit_type == "unit-w2") {
            let kioskACommon = <FATcategory> {
              name: "KioskA Common",
              progress: 0,
              checklists: []
            }
            let kioskACommonChecklist = loadTemplate('kiosk-a-common-checklist.json');
            kioskACommonChecklist.map(data => kioskACommon.checklists.push(data));
            newFATChecklist.category.push(kioskACommon);
          }

          // Generate the checklists of each honeywell scanner
          for (let j=0; j<entry.honeywell; j++) {
            let honeywell = <FATcategory> {
              name: "Honeywell Scanner" + '-' + (j+1).toString(),
              progress: 0,
              checklists: []
            }
            let hwellpChecklist = loadTemplate('options/boarding-pass-scanner-checklist.json');
            hwellpChecklist.map(data => honeywell.checklists.push(data));
            newFATChecklist.category.push(honeywell);
          }

          // Generate the checklsits of each printer
          for (let j=0; j<entry.printers; j++) {
            let printer = <FATcategory> {
              name: "Printer" + '-' + (j+1).toString(),
              progress: 0,
              checklists: []
            }
            let printerChecklist = loadTemplate('options/printers-checklist.json');
            printerChecklist.map(data => printer.checklists.push(data));
            newFATChecklist.category.push(printer);
          }

          // Generate the checklists of each selected option
          if (entry.options.includes('FATaccess')) {
            let access = <FATcategory> {
              name: "Access BP",
              progress: 0,
              checklists: []
            }
            let accessChecklist = loadTemplate('options/access-bp-scanner-checklist.json');
            accessChecklist.map(data => access.checklists.push(data));
            newFATChecklist.category.push(access);
          }
          if (entry.options.includes('FATdocreader')) {
            let docReader = <FATcategory> {
              name: "Document Reader",
              progress: 0,
              checklists: []
            }
            let docReaderChecklist = loadTemplate('options/passport-reader-checklist.json');
            docReaderChecklist.map(data => docReader.checklists.push(data));
            newFATChecklist.category.push(docReader);
          }
          if (entry.options.includes('FAThandheld')) {
            let handheld = <FATcategory> {
              name: "Handheld Scanner",
              progress: 0,
              checklists: []
            }
            let handheldChecklist = loadTemplate('options/handheld-scanner-checklist.json');
            handheldChecklist.map(data => handheld.checklists.push(data));
            newFATChecklist.category.push(handheld);
          }
          if (entry.options.includes('FATnfc')) {
            let nfc = <FATcategory> {
              name: "NFC",
              progress: 0,
              checklists: []
            }
            let nfcChecklist = loadTemplate('options/nfc-card-reader-checklist.json');
            nfcChecklist.map(data => nfc.checklists.push(data));
            newFATChecklist.category.push(nfc);
          }
          if (entry.options.includes('FATmagnetic')) {
            let magnetic = <FATcategory> {
              name: "Magnetic Card",
              progress: 0,
              checklists: []
            }
            let magneticChecklist = loadTemplate('options/magnetic-card-reader-checklist.json');
            magneticChecklist.map(data => magnetic.checklists.push(data));
            newFATChecklist.category.push(magnetic);
          }

          if (entry.options.includes('FATbio')) {
            let bio = <FATcategory> {
              name: "Bio Module",
              progress: 0,
              checklists: []
            }
            let bioChecklist = loadTemplate('options/bio-module-checklist.json');
            bioChecklist.map(data => bio.checklists.push(data));
            newFATChecklist.category.push(bio);
          }
          if (entry.options.includes('FATpayment')) {
            let payment = <FATcategory> {
              name: "Payment Terminal",
              progress: 0,
              checklists: []
            }
            let paymentChecklist = loadTemplate('options/payment-terminal-checklist.json');
            paymentChecklist.map(data => payment.checklists.push(data));
            newFATChecklist.category.push(payment);
          }
          if (entry.options.includes('FATdisability')) {
            let optObject = <FATcategory> {
              name: "Disability Pad",
              progress: 0,
              checklists: []
            }
            let checklist = loadTemplate('options/disability-pad-checklist.json');
            checklist.map(data => optObject.checklists.push(data));
            newFATChecklist.category.push(optObject);
          }
          if (entry.options.includes('FATmic')) {
            let optObject = <FATcategory> {
              name: "Microphone",
              progress: 0,
              checklists: []
            }
            let checklist = loadTemplate('options/microphone-checklist.json');
            checklist.map(data => optObject.checklists.push(data));
            newFATChecklist.category.push(optObject);
          }
          if (entry.options.includes('FATled')) {
            let optObject = <FATcategory> {
              name: "LED",
              progress: 0,
              checklists: []
            }
            let checklist = loadTemplate('options/led-checklist.json');
            checklist.map(data => optObject.checklists.push(data));
            newFATChecklist.category.push(optObject);
          }
          if (entry.options.includes('FATasi')) {
            let optObject = <FATcategory> {
              name: "ASI",
              progress: 0,
              checklists: []
            }
            let checklist = loadTemplate('options/asi-checklist.json');
            checklist.map(data => optObject.checklists.push(data));
            newFATChecklist.category.push(optObject);
          }
          if (entry.options.includes('FATswitch')) {
            let optObject = <FATcategory> {
              name: "Switch",
              progress: 0,
              checklists: []
            }
            let checklist = loadTemplate('options/switch-checklist.json');
            checklist.map(data => optObject.checklists.push(data));
            newFATChecklist.category.push(optObject);
          }
          if (entry.options.includes('FATshutter')) {
            let access = <FATcategory> {
              name: "Roller Shutter",
              progress: 0,
              checklists: []
            }
            let accessChecklist = loadTemplate('options/unit-y-roller-shutter-checklist.json');
            accessChecklist.map(data => access.checklists.push(data));
            newFATChecklist.category.push(access);
          }

          if (entry.unit_type != "unit-y-standard" && entry.unit_type != "unit-y-hybrid-rotate" && entry.unit_type != "unit-y-air" && entry.unit_type != "unit-y-hybrid-fixed") {
            // Generate the bios category
            let bios = <FATcategory> {
              name: "Bios",
              progress: 0,
              checklists: []
            }
          
            let biosChecklist = loadTemplate('bios-checklist.json');
            biosChecklist.map(data => bios.checklists.push(data));
            newFATChecklist.category.push(bios);
          }
          // Generate the Unit Z Hardware category
          if (entry.unit_type == "unit-z") {
            let unitZHardware = <FATcategory> {
              name: "Unit Z Hardware",
              progress: 0,
              checklists: []
            }
            let unitZHardwareChecklist = loadTemplate('hardware/unit-z-hardware-checklist.json');
            unitZHardwareChecklist.map(data => unitZHardware.checklists.push(data));
            newFATChecklist.category.push(unitZHardware);
          }

          // Generate the Unit Z Plus Hardware category
          if (entry.unit_type == "unit-z-plus") {
            let unitZHardware = <FATcategory> {
              name: "Unit Z Plus Hardware",
              progress: 0,
              checklists: []
            }
            let unitZHardwareChecklist = loadTemplate('hardware/unit-z-p-hardware-checklist.json');
            unitZHardwareChecklist.map(data => unitZHardware.checklists.push(data));
            newFATChecklist.category.push(unitZHardware);
          }

          // Generate the Unit Z Compact Hardware category
          if (entry.unit_type == "unit-z-compact") {
            let unitZHardware = <FATcategory> {
              name: "Unit Z Compact Hardware",
              progress: 0,
              checklists: []
            }
            let unitZHardwareChecklist = loadTemplate('hardware/unit-z-c-hardware-checklist.json');
            unitZHardwareChecklist.map(data => unitZHardware.checklists.push(data));
            newFATChecklist.category.push(unitZHardware);
          }

          // Generate the Unit Y Hardware category
          if (entry.unit_type == "unit-y-standard") {
            let unitYHardware = <FATcategory> {
              name: "Centre Module",
              progress: 0,
              checklists: []
            }
            let unitYHardwareChecklist = loadTemplate('hardware/unit-y-centre-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Front Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-front-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Roof Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-roof-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "MCP Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-mcp-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Rear Extension Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-rear-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Unit Y Electrical",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-electrical-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Roof Middle Panel Assembly",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-roofmiddle-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);
          }


          // Generate the Unit Y Hybrid Fixed Desk Hardware category
          if (entry.unit_type == "unit-y-hybrid-fixed") {            
            let unitYHardware = <FATcategory> {
              name: "Front Module",
              progress: 0,
              checklists: []
            }
            let unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-front-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Centre Glass Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-centreglass-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);


            unitYHardware = <FATcategory> {
              name: "Side Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-side-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Side Electrical",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-electrical-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Centre Back Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-centreback-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Roof Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-roof-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Rear Extension Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-rear-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);
          }

          // Generate the Unit Y Hybrid Rotating Desk Hardware category
          if (entry.unit_type == "unit-y-hybrid-rotate") {            
            let unitYHardware = <FATcategory> {
              name: "Front Module",
              progress: 0,
              checklists: []
            }
            let unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-front-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Centre Glass Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-centreglass-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Agent Support and Corner Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hr-corner-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Side Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hr-side-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Side Electrical",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hr-electrical-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Roof Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hr-roof-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Centre Back Module",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hd-centreback-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);

            unitYHardware = <FATcategory> {
              name: "Agent Desk",
              progress: 0,
              checklists: []
            }
            unitYHardwareChecklist = loadTemplate('hardware/unit-y-hr-agent-checklist.json');
            unitYHardwareChecklist.map(data => unitYHardware.checklists.push(data));
            newFATChecklist.category.push(unitYHardware);
          }
          

          // Generate the Unit W2 Hardware category
          if (entry.unit_type == "unit-w2") {
            let unitZHardware = <FATcategory> {
              name: "Unit W2 Hardware",
              progress: 0,
              checklists: []
            }
            let unitZHardwareChecklist = loadTemplate('hardware/unit-w2-hardware-checklist.json');
            unitZHardwareChecklist.map(data => unitZHardware.checklists.push(data));
            newFATChecklist.category.push(unitZHardware);
          }

          // Generate the Unit X1 Hardware category
          if (entry.unit_type == "unit-x1" || entry.unit_type == "unit-v1") {
            let unitX1Hardware = <FATcategory> {
              name: "Unit X1 Hardware",
              progress: 0,
              checklists: []
            }
            let unitX1HardwareChecklist = loadTemplate('hardware/unit-x1-hardware-checklist.json');
            unitX1HardwareChecklist.map(data => unitX1Hardware.checklists.push(data));
            newFATChecklist.category.push(unitX1Hardware);
          }

          if (entry.unit_type == "unit-x1" || entry.unit_type == "unit-v1") {
            // Generate the serial numbers category 
            let serialNum = <FATcategory> {
              name: "Unit X1 Serial Numbers",
              progress: 0,
              checklists: []
            }
            let serialNumChecklist = loadTemplate('unit-x1-serial-numbers.json');
            serialNumChecklist.map(data => serialNum.checklists.push(data));
            newFATChecklist.category.push(serialNum);
          }
          else {
            if (entry.unit_type != "unit-y-standard" && entry.unit_type != "unit-y-hybrid-rotate" && entry.unit_type != "unit-y-air" && entry.unit_type != "unit-y-hybrid-fixed") {
              // Generate the serial numbers category 
              let serialNum = <FATcategory> {
                name: "Serial Numbers",
                progress: 0,
                checklists: []
              }
              let serialNumChecklist = loadTemplate('serial-numbers.json');
              serialNumChecklist.map(data => serialNum.checklists.push(data));
              newFATChecklist.category.push(serialNum);
          }
        }

          newFATCollection.push(newFATChecklist);
        }
     // }

      })

      for (let j=0; j<newFATCollection.length; j++) {
        let doc = await this.FATModel.insertMany(
          [newFATCollection[j]]
        )
      }

      await this.refreshUnitCount(FATDetail[0].project, FATDetail[0].phase);
    }

    // Stores how many units a phase really holds. (It used to be set to the last unit number, which is not a count.)
    async refreshUnitCount(project: string, phase: string) {
      const count = await this.FATModel.countDocuments({project: project, phase: phase});
      return this.fatProjectService.updateProjectUnits(project, phase, count);
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // ============================================================================================================================ //
    // UPDATES A CHECKLIST                                                                                                          //
    // ============================================================================================================================ //
    // Accounts for:                                                                                                                //
    //   - 'Unit Name' Checklist                                                                                                    //
    //   - 'Serial Numbers' Checklist                                                                                               //
    //   -  Regular Checklists                                                                                                      //
    // ============================================================================================================================ //
    // Unit Name Checklist                                                                                                          // 
    //   - Checks the submitted unit name to see if it already exists                                                               //
    //   - If unit name already exists, throw error                                                                                 //
    //   - If unit name is unique, update checklist as well as the unit name of the unit                                            //
    // ============================================================================================================================ //
    // Serial Numbers Checklist                                                                                                     //
    //   - Checks the submitted serial numbers to see if any of them already exist or if there are duplicates in the submitted form //
    //   - If a serial number already exists, throw error                                                                           //
    //   - If there are serial number duplicates in the current form, throw error                                                   //
    //   - If serial numbers are all unique, update checklist                                                                       //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async updateChecklist(update: any) {
      // These go straight into database searches, so anything but plain text is refused
      if (![update.project, update.phase, update.unit, update.category].every(value => typeof value === 'string') || !Array.isArray(update.checklist)) {
        throw new BadRequestException('That checklist update is not valid.');
      }

      // Refuse early if the user cannot see this unit, or someone else has saved this checklist since the user opened it
      const current = await this.assertChecklistVersion(update);

      // Unit names and serial numbers are compared and stored in capitals
      const identifies = update.category === "Unit Name" || update.category === "Serial Numbers";
      const incoming = identifies
        ? update.checklist.map(row => ({...row, comment: row && row.comment != null ? String(row.comment).trim().toUpperCase() : row && row.comment}))
        : update.checklist;
      const checklist = stampChecks(current.checklists || [], incoming, await this.whoAmI(), new Date().toISOString());

      // If the 'Unit Name' Checklist is being updated
      if (update.category === "Unit Name" && checklist.length > 0) {
        const name = checklist[0].comment || '';
        await this.assertUnitName(update, name, checklist[0].status);
        // The unit only takes the name once the checklist has saved, so a refused save changes nothing
        const saved = await this.saveChecklist(update, checklist);
        await this.updateUnitName(update, name);
        return saved;
      }

      // If the 'Serial Numbers' Checklist is being updated
      else if (update.category === "Serial Numbers") {
        const duplicates = await this.serialNumberCheck(checklist, update.project, update.phase, update.unit);

        // A duplicate refuses the whole save: nothing is written, so no row is lost and the version does not move.
        // The user keeps what they typed and is told which rows to correct.
        if (duplicates.length > 0) {
          throw this.refusedRows('These serial numbers are already used: ' + duplicates.map(d => d.serial).join(', '), duplicates);
        }
      }

      return this.saveChecklist(update, checklist);
    }

    // A refusal that names the rows to correct; the page shows the reason beside each one.
    private refusedRows(message: string, duplicates: Array<{ index: number, serial: string, reason: string }>) {
      return new BadRequestException({statusCode: 400, error: 'Bad Request', message, duplicates});
    }

    // A unit's name must not be another unit's, and the check cannot be Complete with no name. Taking the name away
    // while the check is unanswered is fine: the unit simply has no name yet.
    private async assertUnitName(update: any, name: string, status: string | null) {
      if (!name) {
        if (status === 'Complete') {
          throw this.refusedRows('Enter the unit name before marking this check Complete.', [{index: 0, serial: '', reason: 'blank'}]);
        }
        return;
      }
      const sameName: any[] = await this.unitNameCheck(name);
      const another = sameName.some(unit => unit.project !== update.project || unit.phase !== update.phase || unit.doc_no !== update.unit);
      if (another) {
        throw this.refusedRows('This unit name is already used: ' + name, [{index: 0, serial: name, reason: 'existing'}]);
      }
    }

    ////////////////////////////////////////////////////////////////////////////////
    // CONCURRENT EDITS: every checklist category carries a version number that    //
    // goes up on each save. A save made from an older version is refused, so one  //
    // operator can never silently overwrite what another has just saved.         //
    // A category with no version yet (older data) counts as version 0.           //
    ////////////////////////////////////////////////////////////////////////////////

    // The version a client says it loaded, or null when it did not say (such saves are not checked).
    private expectedVersion(update: any): number | null {
      return update.version === undefined || update.version === null || isNaN(Number(update.version)) ? null : Number(update.version);
    }

    // Returns the category as stored. A unit the user may not see counts as not found, so nothing is given away.
    async assertChecklistVersion(update: any) {
      const expected = this.expectedVersion(update);
      const docs = await this.FATModel.find(
        this.visible({project: update.project, phase: update.phase, doc_no: update.unit}),
        {category: 1, _id: 0}
      ).lean().exec() as any[];
      const category = docs[0] && (docs[0].category || []).find(c => c.name === update.category);
      if (!category) {
        throw new NotFoundException("Checklist not found");
      }
      if (expected !== null && (category.version || 0) !== expected) {
        throw new ConflictException("This checklist was changed by someone else.");
      }
      return category;
    }

    // Writes a category's checklist and bumps its version. When the client named a version, the write only happens
    // if the category is still at that version (checked in the same atomic update, so a save that slips in between
    // is caught too).
    async saveChecklist(update: any, checklist: any) {
      const expected = this.expectedVersion(update);
      const elementFilter: any = {"element.name": update.category};
      if (expected !== null) {
        elementFilter["element.version"] = expected === 0 ? {$in: [0, null]} : expected;
      }
      const result: any = await this.FATModel.updateOne(
        {
          'project': update.project,
          'phase': update.phase,
          'doc_no': update.unit,
        }, {
          "$set": {"category.$[element].checklists": checklist},
          "$inc": {"category.$[element].version": 1}
        },
        {
          arrayFilters: [elementFilter]
        }
      );
      if (expected !== null && result && result.nModified === 0) {
        throw new ConflictException("This checklist was changed by someone else.");
      }
      return result;
    }

    //////////////////////////////////////
    // UPDATE THE UNIT NAME OF THE UNIT //
    //////////////////////////////////////

    async updateUnitName(update: any, name: string) {
      return this.FATModel.updateOne(

        {
            'project': update.project,
            'phase': update.phase,
            'doc_no': update.unit,
        }, {
          "$set": {'unit_no': name}
        }
      )
    }

    ///////////////////////////////////////////////
    // CHECKS IF THE UNIT NAME ENTERED IS UNIQUE //
    ///////////////////////////////////////////////

    async unitNameCheck(check: any) {
      return this.FATModel.find(
        {
          'unit_no': check.toUpperCase() 
        }
      ) 
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // ================================================================================================= //
    // CHECKS THE SERIAL NUMBERS TO SEE IF THEY ARE ALL UNIQUE                                           //
    // ================================================================================================= //
    //  - Returns each row whose serial number is repeated in this form or already used elsewhere        //
    //  - Only reads: the rows are left as the user typed them                                           //
    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    async serialNumberCheck(check: any, project: string, phase: string, unit: string): Promise<Array<{ index: number, serial: string, reason: 'form' | 'existing' }>> {
      const found: Array<{ index: number, serial: string, reason: 'form' | 'existing' }> = [];
      const inThisForm = new Set<string>();

      for (let index = 0; index < check.length; index++) {
        const row = check[index];
        const serial = String(row.comment == null ? '' : row.comment).trim();
        // A row with no serial number yet has nothing to clash with
        if (!serial) {
          continue;
        }
        const key = serial.toUpperCase();
        if (inThisForm.has(key)) {
          found.push({ index, serial, reason: 'form' });
        } else if ((await this.checkSN(row, project, phase, unit)).length > 0) {
          found.push({ index, serial, reason: 'existing' });
        }
        inThisForm.add(key);
      }
      return found;
    }

    ///////////////////////////////////////////////////
    // CHECKS A SERIAL NUMBER TO SEE IF IT IS UNIQUE //
    ///////////////////////////////////////////////////

    async checkSN(checklist: any, project: string, phase: string, unit: string): Promise<Array<any>> {
      return this.FATModel.aggregate(
        [
          {
            '$unwind': {
                'path': '$category', 
                'preserveNullAndEmptyArrays': false
            }
          },{
              '$match': {
                  'category.name': "Serial Numbers"
              }
          }, {
              '$unwind': {
                  'path': '$category.checklists',
                  'preserveNullAndEmptyArrays': false
              }
          }, {
              '$match': {
                  'category.checklists.comment': checklist.comment.toUpperCase()
              }
          }, {
            '$match': { 
              $or:[
                {'project': {$ne: project}},
                {'phase': {$ne: phase}},
                {'doc_no': {$ne: unit}},
                {'category.checklists.description': {$ne: checklist.description}},
              ]
            }
        },
        ]    
      );
    }

    /////////////////////////////////////////////////////////////////////
    // UPDATE THE PROGRESS OF CHECKLIST CATEGORY, UNIT, PHASE, PROJECT //
    /////////////////////////////////////////////////////////////////////

    async updateProgress(findProject, findPhase, findUnit, findCat) {
      // Ensure category exists
      if (findCat != null) {
        // Update Category Progress
        await this.calculateCategoryProgress(findProject, findPhase, findUnit, findCat);
      }
      // Ensure unit exists
      if (findUnit != null) {
        // Update Unit Progress
        await this.calculateUnitProgress(findProject, findPhase, findUnit);
      }
      // Update Phase Progress
      let phaseProgress = await this.calculatePhaseProgress(findProject,findPhase);
      // Update Project Progress
      let doc = await this.fatProjectService.updateProgress(findProject, findPhase, Math.round(phaseProgress));
    }

    ////////////////////////////////////////////////
    // UPDATES THE PROGRESS OF CHECKLIST CATEGORY //
    ////////////////////////////////////////////////

    async calculateCategoryProgress(findProject, findPhase, findUnit, findCat) {
      // Gets all the categories for the specified unit
      let doc = await this.getCategoryDocs(findProject, findPhase, findUnit, findCat);
      // If categories are found
      if (doc[0] != null) {
        // Section headings are not checks, so they never count towards (or against) the progress
        let listOfChecklists = doc[0].category.checklists.filter(checkL => checkL.reference !== 'Heading');
        let sumOfProgress = 0;

        // Updates the progress of each category
        listOfChecklists.forEach(checkL => {
          if (checkL.status !== null) {
            // If checklist is 'Complete' or 'N/A', the checklist is marked as done
            if (checkL.status === "Complete" || checkL.status === "N/A") {
              // Adds to the sum of progress
              sumOfProgress += 100;
            }
          }
        })
        // Calculates the average of the progress
        let progressAverage = sumOfProgress / listOfChecklists.length;

        // If there are no checklists, mark as complete
        if (isNaN(progressAverage)) {
          progressAverage = 100;
        }

        // Update Checklist Category with new progress
        return this.FATModel.updateOne(
          {
              'project': findProject, 
              'phase': findPhase, 
              'doc_no': findUnit,
              'category.name': findCat
          }, {
            "$set": {"category.$[element].progress": Math.round(progressAverage)}
          },
          {
            arrayFilters:[{"element.name": findCat}]
          }
        )
        
      }
    }

    ////////////////////////////////////////////////////////////////////////
    // GETS ALL CATEGORY DOCS AND UNWINDS ALL CATEGORIES TO SEPARATE DOCS //
    ////////////////////////////////////////////////////////////////////////

    async getCategoryDocs(findProject, findPhase, findUnit, findCat) {
      return this.FATModel.aggregate(
        [
          {
              '$match': {
                  'project': findProject, 
                  'phase': findPhase, 
                  'doc_no': findUnit
              }
          }, {
              '$unwind': {
                  'path': '$category', 
                  'preserveNullAndEmptyArrays': false
              }
          }, {
              '$match': {
                  'category.name': findCat
              }
          }, 
          {
            '$project': {
                'category': '$category'
            }
          }
      ]    
      );
    }

    //////////////////////////////////
    // CALCULATES THE UNIT PROGRESS //
    //////////////////////////////////

    async calculateUnitProgress(findProject, findPhase, findUnit) {
      // Finds the categories for this unit. Progress is the same for everyone, so this is not limited to what the
      // current user can see.
      let doc = await this.FATModel.find({project: findProject, phase: findPhase, doc_no: findUnit}, {category: 1, _id: 0});

      if (!doc[0]) {
        return;
      }

      let listOfChecklists = doc[0].category;
      let sumOfProgress = 0;

      // Sums up the progress of each category
      listOfChecklists.forEach(checkL => {
        sumOfProgress += checkL.progress;
      })

      // Calculates the average progress of the unit
      let progressAverage = sumOfProgress / listOfChecklists.length;

      // If there are no category checklists mark unit as completed
      if (isNaN(progressAverage)) {
        progressAverage = 100;
      }

      // Update the progress of the unit
      return this.FATModel.updateOne(
        {
            'project': findProject, 
            'phase': findPhase, 
            'doc_no': findUnit,
        }, {
          "$set": {"progress": Math.round(progressAverage)}
        }
      )
    }

    ///////////////////////////////////
    // CALCULATES THE PHASE PROGRESS //
    ///////////////////////////////////

    async calculatePhaseProgress(findProject, findPhase) {
      // Find all the units in the specified phase, including any the current user cannot see: a phase's progress is the
      // same for everyone, so a partner's save must not work it out from their own units alone.
      console.log("CALCULATE : ", findPhase);
      let doc = await this.FATModel.find({project: findProject, phase: findPhase}, {progress: 1, _id: 0});

      let listOfChecklists = doc;
      let sumOfProgress = 0;

      // Sums up the progress of each unit
      listOfChecklists.forEach(checkL => {
        sumOfProgress += checkL.progress;
      })

      // Calculates the average progress of the phase
      let progressAverage = sumOfProgress / listOfChecklists.length;

      // A phase with no units has nothing finished yet (moving the last unit out must not turn it "Complete")
      if (isNaN(progressAverage)) {
        progressAverage = 0;
      }
      return progressAverage;
    }

    /////////////////////////////////////////////////////////////////
    // =========================================================== //
    // REMOVES A CATEGORY AND ITS CHECKLISTS FROM A SPECIFIED UNIT //
    // =========================================================== //
    // Manager Only Function                                       //
    /////////////////////////////////////////////////////////////////

    async removeCategory(element: any) {
      if (await this.checkIfUserIsAdmin()) {
        let doc = await this.FATModel.updateOne(
          {"project": element.project, "phase": element.phase, "doc_no": element.unit},
          {"$pull": {"category": {"name" : element.category}}},            
        )
      }
    }

    ////////////////////////////////////////////////////////
    // ================================================= //
    // MOVES UNITS BETWEEN PHASES IN A SPECIFIED PROJECT //
    // ================================================= //
    // Manager Only Function                             //
    ///////////////////////////////////////////////////////

    async moveUnits(data: any) {
      if (await this.checkIfUserIsAdmin()) {
        // Wait for every move, so the answer (and the progress worked out after it) reflects the finished move.
        await Promise.all(data.units.map(unit => this.changePhase(data.project, data.fromPhase, data.toPhase, unit)));
        await this.refreshUnitCount(data.project, data.fromPhase);
        await this.refreshUnitCount(data.project, data.toPhase);
      }
    }

    ////////////////////////////////////////////////////////
    // ================================================== //
    // MOVES A UNIT BETWEEN PHASES IN A SPECIFIED PROJECT //
    // ================================================== //
    // Manager Only Function                              //
    ////////////////////////////////////////////////////////

    async changePhase(project: string, fromPhase: string, toPhase: string, unit: string) {
      return this.FATModel.updateOne(
        {
          'project': project,
          'phase': fromPhase,
          'doc_no': unit,
        }, 
        {
          "$set": {"phase": toPhase}
        }
      )
    }

    ////////////////////////////////////////////////////////////////
    // ========================================================== //
    // UNWINDS ALL DOCUMENTS SEPERATED BY CATEGORY AND CHECKLISTS //
    // ========================================================== //
    // Manager Only Function                                      //
    ////////////////////////////////////////////////////////////////

    // Deep Search: one page of the serial numbers and unit names that match the filters and the search text. Sorting,
    // filtering and paging all happen in the database, so only one page is ever sent back (see serial-search.ts).
    async searchSerials(raw: any): Promise<ISerialSearchResult> {
      const query = parseSerialSearchQuery(raw);
      const phases = await this.fatProjectService.phaseDirectory();
      const [rows, count] = await Promise.all([
        this.FATModel.aggregate(pagePipeline(query, phases)).collation(SORT_COLLATION).allowDiskUse(true).exec(),
        this.FATModel.aggregate(countPipeline(query, phases)).allowDiskUse(true).exec(),
      ]);
      return { rows: rows as any, total: count.length ? count[0].total : 0, page: query.page, pageSize: query.pageSize };
    }

    // The choices the Deep Search filters offer.
    async serialSearchFilters(): Promise<ISerialSearchFilters> {
      const [projects, unitTypes, locations, phases] = await Promise.all([
        this.FATModel.distinct('project').exec(),
        this.FATModel.distinct('unit_type').exec(),
        this.FATModel.distinct('location').exec(),
        this.fatProjectService.phaseDirectory(),
      ]);
      const sorted = (list: any[]) => list.filter(v => v).map(String).sort((x, y) => x.localeCompare(y, 'en', { numeric: true, sensitivity: 'base' }));
      return { projects: sorted(projects), phases, unit_types: sorted(unitTypes), locations: sorted(locations) };
    }

  ///////////////////////////////////////////////
  // GETS THE CHEKLISTS FOR A CERTAIN CATEGORY //
  ///////////////////////////////////////////////

  async getChecklist(category: string) {

    if (category === "Kiosk Common") {
      let checklist = loadTemplate('kiosk-common-checklist.json');
      return checklist;
    }

    if (category === "Unit X1 Common") {
      let checklist = loadTemplate('unit-x1-common-checklist.json');
      return checklist;
    }

    if (category === "KioskA Common") {
      let checklist = loadTemplate('kiosk-a-common-checklist.json');
      return checklist;
    }

    if (category === "Honeywell Scanner") {
      let checklist = loadTemplate('options/boarding-pass-scanner-checklist.json');
      return checklist;
    }

    if (category === "Printer") {
      let checklist = loadTemplate('options/printers-checklist.json');
      return checklist;
    }

    if (category === "Access BP") {
      let checklist = loadTemplate('options/access-bp-scanner-checklist.json');
      return checklist;
    }

    if (category === "Document Reader") {
      let checklist = loadTemplate('options/passport-reader-checklist.json');
      return checklist;
    }

    if (category === "Handheld Scanner") {
      let checklist = loadTemplate('options/handheld-scanner-checklist.json');
      return checklist;
    }

    if (category === "NFC") {
      let checklist = loadTemplate('options/nfc-card-reader-checklist.json');
      return checklist;
    }

    if (category === "Magnetic Card") {
      let checklist = loadTemplate('options/magnetic-card-reader-checklist.json');
      return checklist;
    }

    if (category === "Bio Module") {
      let checklist = loadTemplate('options/bio-module-checklist.json');
      return checklist;
    }

    if (category === "Payment Terminal") {
      let checklist = loadTemplate('options/payment-terminal-checklist.json');
      return checklist;
    }

    if (category === "Disability Pad") {
      let checklist = loadTemplate('options/disability-pad-checklist.json');
      return checklist;
    }

    if (category === "Microphone") {
      let checklist = loadTemplate('options/microphone-checklist.json');
      return checklist;
    }

    if (category === "LED") {
      let checklist = loadTemplate('options/led-checklist.json');
      return checklist;
    }

    if (category === "ASI") {
      let checklist = loadTemplate('options/asi-checklist.json');
      return checklist;
    }

    if (category === "Switch") {
      let checklist = loadTemplate('options/switch-checklist.json');
      return checklist;
    }

    if (category === "Bios") {
      let checklist = loadTemplate('bios-checklist.json');
      return checklist;
    }

    if (category === "Unit Z Hardware") {
      let checklist = loadTemplate('hardware/unit-z-hardware-checklist.json');
      return checklist;
    }

    if (category === "Unit Z Plus Hardware") {
      let checklist = loadTemplate('hardware/unit-z-p-hardware-checklist.json');
      return checklist;
    }

    if (category === "Unit Z Compact Hardware") {
      let checklist = loadTemplate('hardware/unit-z-c-hardware-checklist.json');
      return checklist;
    }

    if (category === "Unit W2 Hardware") {
      let checklist = loadTemplate('hardware/unit-w2-hardware-checklist.json');
      return checklist;
    }

    if (category === "Centre Module") {
      let checklist = loadTemplate('hardware/unit-y-centre-checklist.json');
      return checklist;
    }

    if (category === "Front Module") {
      let checklist = loadTemplate('hardware/unit-y-front-checklist.json');
      return checklist;
    }

    if (category === "Roof Module") {
      let checklist = loadTemplate('hardware/unit-y-roof-checklist.json');
      return checklist;
    }

    if (category === "MCP Module") {
      let checklist = loadTemplate('hardware/unit-y-mcp-checklist.json');
      return checklist;
    }

    if (category === "Rear Extension Module") {
      let checklist = loadTemplate('hardware/unit-y-rear-checklist.json');
      return checklist;
    }

    if (category === "Unit Y Electrical") {
      let checklist = loadTemplate('hardware/unit-y-electrical-checklist.json');
      return checklist;
    }

    if (category === "Roof Middle Panel Assembly") {
      let checklist = loadTemplate('hardware/unit-y-roofmiddle-checklist.json');
      return checklist
    }

    if (category === "Serial Numbers") {
      let checklist = loadTemplate('serial-numbers.json');
      return checklist;
    }

    if (category === "Unit X1 Serial Numbers") {
      let checklist = loadTemplate('unit-x1-serial-numbers.json');
      return checklist;
    }

  }

  //////////////////////////////////////////////////
  // ============================================ //
  // EDITS THE CHECKLISTS OF A SPECIFIED CATEGORY //
  // ============================================ //
  // Manager Only Function                        //
  //////////////////////////////////////////////////

  async editChecklist(edit: any) {
    if (await this.checkIfUserIsAdmin()) {
      let category = edit.category;
      let newChecklists = edit.checklists;
      let checklist = "";

      if (category === "Kiosk Common") {
        checklist = 'kiosk-common-checklist.json';

      }

      if (category === "Unit X1 Common") {
        checklist = 'unit-x1-common-checklist.json';

      }

      if (category === "KioskA Common") {
        checklist = 'kiosk-a-common-checklist.json';

      }

      if (category === "Honeywell Scanner") {
        checklist = 'options/boarding-pass-scanner-checklist.json';
      }

      if (category === "Printer") {
        checklist = 'options/printers-checklist.json';
      }

      if (category === "Access BP") {
        checklist = 'options/access-bp-scanner-checklist.json';

      }

      if (category === "Document Reader") {
        checklist = 'options/passport-reader-checklist.json';
        
      }

      if (category === "Handheld Scanner") {
        checklist = 'options/handheld-scanner-checklist.json';
      }

      if (category === "NFC") {
        checklist = 'options/nfc-card-reader-checklist.json';
      }

      if (category === "Magnetic Card") {
        checklist = 'options/magnetic-card-reader-checklist.json';
      }

      if (category === "Livestream") {
        checklist = 'options/livestream-camera-checklist.json';
      }

      if (category === "Bio Module") {
        checklist = 'options/bio-module-checklist.json';
      }

      if (category === "Payment Terminal") {
        checklist = 'options/payment-terminal-checklist.json';
      }

      if (category === "Disability Pad") {
        checklist = 'options/disability-pad-checklist.json';
      }

      if (category === "Microphone") {
        checklist = 'options/microphone-checklist.json';
      }

      if (category === "Speaker") {
        checklist = 'options/speaker-checklist.json';
      }

      if (category === "LED") {
        checklist = 'options/led-checklist.json';
      }

      if (category === "ASI") {
        checklist = 'options/asi-checklist.json';
      }

      if (category === "Switch") {
        checklist = 'options/switch-checklist.json';
      }

      if (category === "Bios") {
        checklist = 'bios-checklist.json';
      }

      if (category === "Unit Z Hardware") {
        checklist = 'hardware/unit-z-hardware-checklist.json';
      }

      if (category === "Unit Z Plus Hardware") {
        checklist = 'hardware/unit-z-p-hardware-checklist.json';
      }

      if (category === "Unit Z Compact Hardware") {
        checklist = 'hardware/unit-z-c-hardware-checklist.json';
      }

      if (category === "Unit W2 Hardware") {
        checklist = 'hardware/unit-w2-hardware-checklist.json';
      }

      if (category === "Centre Module") {
        checklist = 'hardware/unit-y-centre-checklist.json';
      }

      if (category === "Front Module") {
        checklist = 'hardware/unit-y-front-checklist.json';
      }

      if (category === "Roof Module") {
        checklist = 'hardware/unit-y-roof-checklist.json';
      }

      if (category === "MCP Module") {
        checklist = 'hardware/unit-y-mcp-checklist.json';
      }

      if (category === "Rear Extension Module") {
        checklist = 'hardware/unit-y-rear-checklist.json';
      }

      if (category === "Unit Y Electrical") {
        checklist = 'hardware/unit-y-electrical-checklist.json';
      }

      if (category === "Roof Middle Panel Assembly") {
        checklist = 'hardware/unit-y-roofmiddle-checklist.json';
      }

      if (category === "Serial Numbers") {
        checklist = 'serial-numbers.json';
      }

      if (category === "Unit X1 Serial Numbers") {
        checklist = 'unit-x1-serial-numbers.json';
      }

      if (checklist !== '') {
        saveTemplateOverride(checklist, newChecklists);
      }
    }
  }

  ///////////////////////////////////////////////////////
  // FINDS ALL THE TYPES OF UNITS IN A SPECIFIED PHASE //
  ///////////////////////////////////////////////////////

  async findTypesinPhase(project: string, phase: string) {
    return this.FATModel.aggregate(
      [
        {
            '$match': this.visible({
                'project': project,
                'phase': phase
            })
        }, {
            '$group': {
                '_id': '$unit_type'
            }
        }
    ]    
    );
  }

  ////////////////////////////////////////////////////////////////
  // FINDS ALL THE UNITS OF A CERTAIN TYPE IN A SPECIFIED PHASE //
  ////////////////////////////////////////////////////////////////

  async findTypeUnits(project: string, phase: string, type: string) {
    return this.FATModel.find(this.visible({project: project, phase: phase, unit_type: type}), {doc_no: 1, unit_no: 1, _id: 0});
  }

  ////////////////////////////////////////////////////////////////
  // FINDS ALL THE UNITS OF A CERTAIN TYPE IN A SPECIFIED PHASE //
  ////////////////////////////////////////////////////////////////

  async findAllTypeUnits(project: string, phase: string, type: string) {
    return this.FATModel.find({project: project, phase: phase, unit_type: type});
  }

  ////////////////////////////////////////////////////////////////
  // ========================================================== //
  // ADDS CHECKLISTS TO ALL UNITS OF A SPECIFIED TYPE AND PHASE //
  // ========================================================== //
  // Manager Only Function                                      //
  ////////////////////////////////////////////////////////////////

  async addChecklists(data: any) {
    // FIND ALL THE UNITS OF A CERTAIN TYPE
    let units = await this.findAllTypeUnits(data.project, data.phase, data.type);

    // ADD NEW CHECKLISTS TO EACH UNIT, waiting for all of them so what comes after sees the finished result
    await Promise.all(units.map(async unit => {
      // UPDATE THE CATEGORY CHECKLIST ARRAY
      let newChecklists = await this.createAdditionalChecklists(unit, data)

      // UPDATE THE OPTIONS ARRAY
      let newOptions = unit.options;
      if (data.options !== null) {
        if (data.options.length !== 0) {
          data.options.forEach(option => {
            newOptions.push(option);
          })
        }
      }
      
      // UPDATE THE UNIT WITH NEW CHECKLISTS, OPTIONS, PRINTERS AND HONEYWELLS
      await this.FATModel.updateMany(
        {
          'project': unit.project, 
          'phase': unit.phase,
          'doc_no': unit.doc_no,
        }, {
          "$set": {
            'category': newChecklists,
            'options': newOptions, 
            'opt_honeywell': (unit.opt_honeywell + data.honeywell), 
            'opt_printer': (unit.opt_printer + data.printers),
          }
        },

      )

    }))
    let unitsAfter = await this.findAllTypeUnits(data.project, data.phase, data.type);
    return unitsAfter;
  }

  ///////////////////////////////////////////////////////////////////////////////
  // ========================================================================= //
  // CREATE CHECKLISTS OF NEW OPTIONS AND ADDS THEM TO THE EXISTING CHECKLISTS //
  // ========================================================================= //
  // Manager Only Function                                                     //
  ///////////////////////////////////////////////////////////////////////////////

  async createAdditionalChecklists(existingChecklists: any, newChecklist: any) {
    let checklistsToBeAdded = existingChecklists.category;

    // Generate the checklists of each honeywell scanner
    for (let j=existingChecklists.opt_honeywell; j<(existingChecklists.opt_honeywell+newChecklist.honeywell); j++) {
      let honeywell = <FATcategory> {
        name: "Honeywell Scanner" + '-' + (j+1).toString(),
        progress: 0,
        checklists: []
      }
      let hwellpChecklist = loadTemplate('options/boarding-pass-scanner-checklist.json');
      hwellpChecklist.map(data => honeywell.checklists.push(data));
      checklistsToBeAdded.push(honeywell);
    }

    // Generate the checklsits of each printer
    for (let j=existingChecklists.opt_printer; j<(existingChecklists.opt_printer+newChecklist.printers); j++) {
      let printer = <FATcategory> {
        name: "Printer" + '-' + (j+1).toString(),
        progress: 0,
        checklists: []
      }
      let printerChecklist = loadTemplate('options/printers-checklist.json');
      printerChecklist.map(data => printer.checklists.push(data));
      checklistsToBeAdded.push(printer);
    }

    // Generate the checklists of each selected option
    if (newChecklist.options !== null) {
      if (newChecklist.options.includes('FATaccess') && !existingChecklists.options.includes('FATaccess')) {
        let access = <FATcategory> {
          name: "Access BP",
          progress: 0,
          checklists: []
        }
        let accessChecklist = loadTemplate('options/access-bp-scanner-checklist.json');
        accessChecklist.map(data => access.checklists.push(data));
        checklistsToBeAdded.push(access);
      }
      if (newChecklist.options.includes('FATdocreader') && !existingChecklists.options.includes('FATdocreader')) {
        let docReader = <FATcategory> {
          name: "Document Reader",
          progress: 0,
          checklists: []
        }
        let docReaderChecklist = loadTemplate('options/passport-reader-checklist.json');
        docReaderChecklist.map(data => docReader.checklists.push(data));
        checklistsToBeAdded.push(docReader);
      }
      if (newChecklist.options.includes('FAThandheld') && !existingChecklists.options.includes('FAThandheld')) {
        let handheld = <FATcategory> {
          name: "Handheld Scanner",
          progress: 0,
          checklists: []
        }
        let handheldChecklist = loadTemplate('options/handheld-scanner-checklist.json');
        handheldChecklist.map(data => handheld.checklists.push(data));
        checklistsToBeAdded.push(handheld);
      }
      if (newChecklist.options.includes('FATnfc') && !existingChecklists.options.includes('FATnfc')) {
        let nfc = <FATcategory> {
          name: "NFC",
          progress: 0,
          checklists: []
        }
        let nfcChecklist = loadTemplate('options/nfc-card-reader-checklist.json');
        nfcChecklist.map(data => nfc.checklists.push(data));
        checklistsToBeAdded.push(nfc);
      }
      if (newChecklist.options.includes('FATmagnetic') && !existingChecklists.options.includes('FATmagnetic')) {
        let magnetic = <FATcategory> {
          name: "Magnetic Card",
          progress: 0,
          checklists: []
        }
        let magneticChecklist = loadTemplate('options/magnetic-card-reader-checklist.json');
        magneticChecklist.map(data => magnetic.checklists.push(data));
        checklistsToBeAdded.push(magnetic);
      }
    
      if (newChecklist.options.includes('FATbio') && !existingChecklists.options.includes('FATbio')) {
        let bio = <FATcategory> {
          name: "Bio Module",
          progress: 0,
          checklists: []
        }
        let bioChecklist = loadTemplate('options/bio-module-checklist.json');
        bioChecklist.map(data => bio.checklists.push(data));
        checklistsToBeAdded.push(bio);
      }
      if (newChecklist.options.includes('FATpayment') && !existingChecklists.options.includes('FATpayment')) {
        let payment = <FATcategory> {
          name: "Payment Terminal",
          progress: 0,
          checklists: []
        }
        let paymentChecklist = loadTemplate('options/payment-terminal-checklist.json');
        paymentChecklist.map(data => payment.checklists.push(data));
        checklistsToBeAdded.push(payment);
      }
      if (newChecklist.options.includes('FATdisability') && !existingChecklists.options.includes('FATdisability')) {
        let optObject = <FATcategory> {
          name: "Disability Pad",
          progress: 0,
          checklists: []
        }
        let checklist = loadTemplate('options/disability-pad-checklist.json');
        checklist.map(data => optObject.checklists.push(data));
        checklistsToBeAdded.push(optObject);
      }
      if (newChecklist.options.includes('FATmic') && !existingChecklists.options.includes('FATmic')) {
        let optObject = <FATcategory> {
          name: "Microphone",
          progress: 0,
          checklists: []
        }
        let checklist = loadTemplate('options/microphone-checklist.json');
        checklist.map(data => optObject.checklists.push(data));
        checklistsToBeAdded.push(optObject);
      }
      
      if (newChecklist.options.includes('FATled') && !existingChecklists.options.includes('FATled')) {
        let optObject = <FATcategory> {
          name: "LED",
          progress: 0,
          checklists: []
        }
        let checklist = loadTemplate('options/led-checklist.json');
        checklist.map(data => optObject.checklists.push(data));
        checklistsToBeAdded.push(optObject);
      }
      if (newChecklist.options.includes('FATasi') && !existingChecklists.options.includes('FATasi')) {
        let optObject = <FATcategory> {
          name: "ASI",
          progress: 0,
          checklists: []
        }
        let checklist = loadTemplate('options/asi-checklist.json');
        checklist.map(data => optObject.checklists.push(data));
        checklistsToBeAdded.push(optObject);
      }
      if (newChecklist.options.includes('FATswitch') && !existingChecklists.options.includes('FATswitch')) {
        let optObject = <FATcategory> {
          name: "Switch",
          progress: 0,
          checklists: []
        }
        let checklist = loadTemplate('options/switch-checklist.json');
        checklist.map(data => optObject.checklists.push(data));
        checklistsToBeAdded.push(optObject);
      }
      if (newChecklist.options.includes('FATshutter') && !existingChecklists.options.includes('FATshutter')) {
        let optObject = <FATcategory> {
          name: "Roller Shutter",
          progress: 0,
          checklists: []
        }
        let checklist = loadTemplate('options/unit-y-roller-shutter-checklist.json');
        checklist.map(data => optObject.checklists.push(data));
        checklistsToBeAdded.push(optObject);
      }
    }
    return checklistsToBeAdded;
  }

  async findCompanyPhases(project: string, company: string) {
    return this.FATModel.find({project: project, checker: company}, {project:1, phase: 1, _id: 0})
  }

  async checkIfUserIsAdmin() {
    let userRoles = this.request.user['roles'];
    console.log("THE USER ROLES", userRoles);
    const result = userRoles.findIndex( item =>  "admin" === item.toLowerCase());
    console.log("WHAT IS RESULT", result);
    if (result !== -1) {
        return true;
    } else {
        return false;
    }
  }

  async findUnitComment(project: string, phase: string, unit: string) {
    return this.FATModel.find(this.visible({project: project, phase: phase, doc_no: unit}), {comment:1, _id: 0})
  }

  async updateUnitComment(update: any) {
    if (![update.project, update.phase, update.unit].every(value => typeof value === 'string')) {
      throw new BadRequestException('That note is not valid.');
    }
    const result: any = await this.FATModel.updateOne(
      this.visible({
          'project': update.project,
          'phase': update.phase,
          'doc_no': update.unit,
      }), {
        "$set": {"comment": update.comment}
      }
    );
    if (result && result.n === 0) {
      throw new NotFoundException('Unit not found');
    }
    return result;
  }

  //////////////////////////////////////////////
  // FINDS ALL UNITS IN A GIVEN PROJECT PHASE // 
  //////////////////////////////////////////////
  
  async findPhaseUnitComments(findProject, findPhase) {
    return this.FATModel.find(this.visible({project: findProject, phase: findPhase}), {doc_no: 1, unit_no: 1, comment: 1, _id: 0});
  }

  async findPhaseUnits(findProject, findPhase) {
    return this.FATModel.find({project: findProject, phase: findPhase});
  }

}
