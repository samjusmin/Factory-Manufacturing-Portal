import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { FATProjectDocument } from './fat-project.schema';
import { FATProjectDTO } from './fat-project.update.dto';
import { FactoryAcceptanceTestService } from '../factory-acceptance-test/factory-acceptance-test.service';
import internal = require('stream');

var request = require('request');
var mongoose = require('mongoose');

@Injectable()
export class FatProjectService {

    constructor(
        @InjectModel('fat_project') private FATModel: Model<FATProjectDocument>,
        @Inject(REQUEST) private request: Request,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ){}

    // Every phase of every project (its id, name and project), for looking phases up by id.
    async phaseDirectory(): Promise<Array<{ id: string, name: string, project: string }>> {
        const docs = await this.FATModel.find({}, {project: 1, phase: 1, _id: 0}).lean().exec() as any[];
        const phases = [];
        docs.forEach(doc => (doc.phase || []).forEach(ph => phases.push({id: ph.id, name: ph.name, project: doc.project})));
        return phases;
    }

    async findProjects() {
        let company = this.request.user['company'].toLowerCase();
        console.log("FINDPROJECTS IS WORKING");
        if (company === "tenant-a") {
            return this.FATModel.find().exec();
        } 
        if (company === "tenant-b") {
            return this.FATModel.find({project: "23TNTB01"}).exec();
        } else {
            return await this.FATModel.aggregate(
                [
                    {
                        '$unwind': {
                        'path': '$checker_group', 
                        'preserveNullAndEmptyArrays': false
                        }
                    },{
                        '$match': {
                            'checker_group': company
                        }
                    }
                ]    
            );
        }
    }

    async findPhases(project) {
        console.log("FINDPROJECTS IS WORKING");
        console.log("THIS IS THE USERNAME: ", this.request.user['username']);
        console.log("THIS IS THE LOCATION: ", this.request.user['location']);
        console.log("THIS IS THE COMPANY: ", this.request.user['company']);
        console.log("THIS IS THE USER: ", this.request.user);
        let company = this.request.user['company'].toLowerCase();
        console.log("this is the company", company)

        if (company === "tenant-a") {
            let listOfPhases = await this.FATModel.find({project: project}, {phase: 1})
            console.log("ID TEST: ", listOfPhases);
            return listOfPhases[0].phase;
        } if (company === "tenant-b") {
            let listOfPhases = await this.FATModel.find({project: "23TNTB01"}, {phase: 1, _id: 0})
            return listOfPhases[0].phase;
        } else {
            // return this.FATModel.find({project: project}, {project:1, phase: 1, _id: 0})
            let listOfPhases = await this.FATModel.aggregate(
                [
                    {
                        '$match': {
                            'project': project
                        }
                    },{
                        '$unwind': {
                        'path': '$phase', 
                        'preserveNullAndEmptyArrays': false
                        }
                    },{
                        '$unwind': {
                        'path': '$phase.checkers', 
                        'preserveNullAndEmptyArrays': false
                        }
                    },{
                        '$match': {
                            'phase.checkers': company
                        }
                    },{
                        '$project': {
                            'phase': '$phase',
                            '_id': 0                            
                        }
                      }
                ]    
            );

            let flattenList = [];

            for (var each of listOfPhases) {
                console.log("HERE IS EACH OF THE PHASES", each)
                flattenList.push(each.phase);
            }
            console.log("HERE is the FLATTENLIST", flattenList)
            return flattenList;
        }
    }

    /////////////////////
    // FIND PHASE NAME // 
    /////////////////////
    
    async findPhaseById(findProject, findPhase) {
        return this.FATModel.aggregate(
            [
                {
                    '$match': {
                        'project': findProject
                    }
                },{
                    '$unwind': {
                        'path': '$phase', 
                        'preserveNullAndEmptyArrays': false
                    }
                },{
                    '$match': {
                        'phase.id': findPhase
                    }
                },{
                    '$project': {
                        'name': '$phase.name',
                        '_id': 0                            
                    }
                  }
            ]    
        );
      }

    async addProject(entry: FATProjectDTO) {
        console.log("FATADDPROJECT IS WORKING");
        console.log(entry);
        const code = (entry.project || '').trim();
        const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (await this.FATModel.findOne({ project: new RegExp('^' + escaped + '$', 'i') }).exec()) {
            throw new ConflictException('Project ' + code + ' already exists.');
        }
        let doc1 = {
            _id: null,
            description: entry.description,
            location: null,
            progress: entry.progress,
            project: entry.project.trim(),
            checker_group: [],
            phase: []
        }

        let doc = await this.FATModel.insertMany(doc1)

    }

    async addPhase(project: string, newphase: string, entries: any) {
        console.log("HERE IS THE PASSED DATA TO ADDPHASE");
        console.log("Proj: ", project);
        console.log("Newphase: ", newphase);
        console.log("HERE ARE THE ENTRIES", entries);
        let insertPhase = {
            progress: 0,
            numOfUnits: 0,
            name: newphase
        }

        let checkersOfPhase = []; 

        for (entry of entries) {
            if (!checkersOfPhase.includes(entry.checker)) {
                checkersOfPhase.push(entry.checker);
            }
        }

        let newId = new mongoose.Types.ObjectId().toString();

        let doc = await this.FATModel.updateOne(
            {"project": project},
            {$push: {"phase": {"id":newId, "progress": 0, "checkers": checkersOfPhase, "numOfUnits": 0, "name": newphase}}},
        )

        let listOfCheckers = await this.findCheckers(project);
        console.log("WHAT IS LISTOFCHECKERS", listOfCheckers);

        for (var entry of entries) {
            if (!listOfCheckers[0].checker_group.includes(entry.checker)) {
                listOfCheckers[0].checker_group.push(entry.checker);
            }
        }

        console.log("WHAT IS LISTOFCHECKERS", listOfCheckers[0].checker_group);

        let updateCheckers = await this.FATModel.updateOne(
            {"project": project},
            {"$set": {"checker_group": listOfCheckers[0].checker_group}},
        )

        return newId;
        // find the list of checker_group for project
        // check if checker exists in checker_group list
        // If checker doesn't exist in list, add to list
        // if already exists, do nothing
    }

    async findCheckers(project) {
        return this.FATModel.find({project: project}, {checker_group:1, _id: 0})
    }

    async findPhaseCheckers(project: string, phase: string) {
        return this.FATModel.aggregate([
            {
                '$match': {
                    'project': project
                }
            }, {
                '$unwind': {
                    'path': '$phase', 
                    'preserveNullAndEmptyArrays': false
                }
            }, {
                '$match': {
                    'phase.id': phase
                }
            }, {
                '$project': {
                    'checkers': '$phase.checkers', 
                    '_id': 0
                }
            }
        ])
    }

    async updateProgress(findProject: string, findPhase: string, phaseProgress: number) {
        await this.updatePhaseProgress(findProject, findPhase, phaseProgress);
        await this.updateProjectProgress(findProject);
    }

    async updatePhaseCheckers(findProject: string, findPhase: string, checkers: any) {

        // UPDATE 'checker_group' OF THE PROJECT
        let listOfCheckers = await this.findCheckers(findProject);
        console.log("WHAT IS LISTOFCHECKERS", listOfCheckers);

        for (var checker of checkers) {
            if (!listOfCheckers[0].checker_group.includes(checker.checker)) {
                listOfCheckers[0].checker_group.push(checker.checker);
            }
        }

        let updateCheckers = await this.FATModel.updateOne(
            {"project": findProject},
            {"$set": {"checker_group": listOfCheckers[0].checker_group}},
        )

        // UPDATE 'checkers' OF THE PHASE
        let listOfPhaseCheckers = await this.findPhaseCheckers(findProject, findPhase);
        console.log("WHAT IS listOfPhaseCheckers", listOfPhaseCheckers);

        for (var checker of checkers) { //!Here's the issue
            if (!listOfPhaseCheckers[0].checkers.includes(checker.checker)) {
                listOfPhaseCheckers[0].checkers.push(checker.checker);
            }
        }

        return this.FATModel.updateOne(
            {
                'project': findProject,
            }, {
              "$set": {"phase.$[element].checkers": listOfPhaseCheckers[0].checkers}
            },
            {
              arrayFilters:[{"element.id": findPhase}]
            }
          )

    }

    async updatePhaseProgress(findProject: string, findPhase: string, phaseProgress: number) {
        console.log("THESE ARE THE UPDATEPHASEPROGRESS ARGUMENTS");
        console.log(findProject, findPhase, phaseProgress);
        return this.FATModel.updateOne(
            {
                'project': findProject
            }, {
              "$set": {"phase.$[element].progress": phaseProgress}
            },
            {
              arrayFilters:[{"element.id": findPhase}]
            }
        )
    }

    async updatePhaseName(findProject: string, findPhase: string, newName: string) {
        return this.FATModel.updateOne(
            {
                'project': findProject
            }, {
              "$set": {"phase.$[element].name": newName}
            },
            {
              arrayFilters:[{"element.id": findPhase}]
            }
        )
    }

    async updateProjectProgress(findProject: string) {
        let doc = await this.getProjectPhases(findProject);
        console.log("THIS IS THE DOC FROM FATPROJECT CALCULATEPROJECTPROGRESS");
        console.log(doc);

        let listOfPhases = doc[0].phase;

        let sumOfProgress = 0;

        listOfPhases.forEach(checkL => {
            sumOfProgress += checkL.progress;
        })
        
        let progressAverage = sumOfProgress / listOfPhases.length;
        console.log("This is the progressAverage", progressAverage); 

        if (isNaN(progressAverage)) {
            progressAverage = 0;
          }

        return this.FATModel.updateOne(
        
            {
                'project': findProject, 
            }, {
              "$set": {"progress": Math.round(progressAverage)}
            },
        )
    }

    async getProjectPhases(findProject: string) {
        return this.FATModel.find({project: findProject})
    }

    async getPhaseNumOfUnits(findProject: string, findPhase: string) {
        console.log("IN getPhaseNumOfUnits, here is the project and phase:", findProject, findPhase);
        // return this.FATModel.find({project: findProject, "phase.name": findPhase}, {"phase.numOfUnits":1, _id: 0})
        return this.FATModel.aggregate([
            {
                '$match': {
                    'project': findProject
                }
            }, {
                '$unwind': {
                    'path': '$phase', 
                    'preserveNullAndEmptyArrays': false
                }
            }, {
                '$match': {
                    'phase.id': findPhase
                }
            }, {
                '$project': {
                    'numOfUnits': '$phase.numOfUnits', 
                    '_id': 0
                }
            }
        ])
    }   
    
    async getPrefix(findProject: string, findPhase: string) {
        console.log("IN getPrefix, here is the project and phase:", findProject, findPhase);
        // return this.FATModel.find({project: findProject, "phase.name": findPhase}, {"phase.numOfUnits":1, _id: 0})
        return this.FATModel.aggregate([
            {
                '$match': {
                    'project': findProject
                }
            }, {
                '$unwind': {
                    'path': '$phase', 
                    'preserveNullAndEmptyArrays': false
                }
            }, {
                '$match': {
                    'phase.id': findPhase
                }
            }, {
                '$project': {
                    'prefix': '$phase.prefix', 
                    '_id': 0
                }
            }
        ])
    }

    async updateProjectUnits(findProject: string, findPhase: string, update: number) {
        console.log("UPDATE PROJECT UNITS: ", findProject, findPhase, update);
        // return this.FATModel.findOneAndUpdate({project: findProject}, {$inc:{"numOfUnits":update}})
        return this.FATModel.updateOne(
            {
                'project': findProject,
            }, {
              "$set": {"phase.$[element].numOfUnits": update}
            },
            {
              arrayFilters:[{"element.id": findPhase}]
            }
          )
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

}
