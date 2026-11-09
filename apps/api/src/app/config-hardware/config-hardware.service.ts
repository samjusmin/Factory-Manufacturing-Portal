import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Model, isValidObjectId } from 'mongoose';
import { STOCK_PROJECT, checklistProgress, cleanProjectCode, cleanSerial, locationProjects } from '@webproject/data';
import { ConfigCatalogueService, cleanName } from '../config-catalogue/config-catalogue.service';
import { ConfigLocationService } from '../config-location/config-location.service';
import { HardwareTypeService } from '../hardware-type/hardware-type.service';
import { PcImageService } from '../pc-image/pc-image.service';
import { isAdminUser, userLocationNames } from '../role/location-scope.guard';
import { ConfigHardwareDocument } from './config-hardware.schema';
import { applyChanges, resolveModel, resolveParts, serialMatcher } from './config-unit-rules';

const text = (value: any): string | null => (value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim());

// The configurable hardware units (PCs, switches, UNIT-W1 sets...) at each location. A unit is identified by its serial
// no. (unique across all of Config) and is allocated to a project, or to STOCK.
@Injectable()
export class ConfigHardwareService {

    constructor(
        @InjectModel('config_hardware') private readonly units: Model<ConfigHardwareDocument>,
        @InjectModel('users') private readonly users: Model<any>,
        @Inject(REQUEST) private readonly request: Request,
        private readonly catalogue: ConfigCatalogueService,
        private readonly locations: ConfigLocationService,
        private readonly hardwareTypes: HardwareTypeService,
        private readonly images: PcImageService,
    ){}

    // Admins reach every location, everyone else only their own.
    private assertLocation(location: string) {
        const user: any = this.request.user;
        if (!isAdminUser(user) && !userLocationNames(user).includes(location)) {
            throw new ForbiddenException('You do not have access to that location.');
        }
    }

    // The name to stamp on an answer: the person's name, or their username when they have none.
    private async whoAmI(): Promise<string> {
        const username = (this.request.user as any).username;
        const user: any = await this.users.findOne({ username }).lean().exec();
        return (user && user.name) || username;
    }

    // The units of one type at a location, without their checklists.
    async findUnits(location: string, category: string, type: string) {
        return this.units
            .find({ location, hardware_category: category, hardware_type: type }, { checklist: 0 })
            .sort({ serial_no: 1 })
            .lean()
            .exec();
    }

    // One unit with its checklist.
    async findUnit(id: string) {
        const unit: any = isValidObjectId(id) ? await this.units.findById(id).lean().exec() : null;
        if (!unit) {
            throw new NotFoundException('That unit does not exist.');
        }
        this.assertLocation(unit.location);
        return unit;
    }

    // The values a unit is allowed to have, checked against the catalogue and what the location has been given.
    private async resolveDetails(location: any, category: any, type: string, input: any, existing: any, excludeId?: string) {
        const serial = cleanSerial(input.serial_no);
        if (!serial) {
            throw new BadRequestException('Enter the serial no.');
        }
        const clash: any = await this.units
            .findOne({ serial_no: serialMatcher(serial), ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
            .lean()
            .exec();
        if (clash) {
            const where = isAdminUser(this.request.user) || clash.location === location.location ? `at ${clash.location}` : 'at another location';
            throw new ConflictException(`Serial no. ${serial} is already used by a ${clash.hardware_type} ${where}.`);
        }

        const project = cleanProjectCode(input.project) || STOCK_PROJECT;
        if (!locationProjects(location.projects).includes(project)) {
            throw new BadRequestException(`${project} is not a project at ${location.location}.`);
        }

        const models: any[] = await this.hardwareTypes.getAccessibleByCategory(location.hardware_access, category.name);
        const model = resolveModel(models.map((m) => m.name), input.model, existing && existing.model, category.name, location.location);

        let image: string | null = null;
        if (category.uses_image) {
            image = text(input.pc_image);
            if (image && image !== (existing && existing.pc_image)) {
                const available: any[] = await this.images.getImageByIds(location.image_access, type);
                if (!available.some((i) => i.name === image)) {
                    throw new BadRequestException(`"${image}" is not a PC image available for ${type} at ${location.location}.`);
                }
            }
        }

        return {
            serial_no: serial,
            device_name: text(input.device_name),
            model,
            pc_image: image,
            project,
            parts: resolveParts(category.parts, input.parts, serial),
        };
    }

    // Adds a unit. Its checklist starts from the type's checklist, with any answers already given applied.
    async create(payload: any) {
        const location = cleanName(payload && payload.location);
        const categoryName = cleanName(payload && payload.hardware_category);
        const type = cleanName(payload && payload.hardware_type);
        this.assertLocation(location);

        const place = await this.locations.getLocation(location);
        if (!place) {
            throw new NotFoundException(`There is no location called "${location}".`);
        }
        const category = await this.catalogue.getCategory(categoryName);
        const template = await this.catalogue.getType(type);
        if (template.category !== categoryName) {
            throw new BadRequestException(`"${type}" is not a ${categoryName} hardware type.`);
        }
        const allowed = place.item_access.some((a) => a.hardware_category === categoryName && a.hardware_type.includes(type));
        if (!allowed) {
            throw new BadRequestException(`${location} is not set up to configure ${type}.`);
        }

        const details = await this.resolveDetails(place, category, type, payload, null);
        const blank = template.checklist.map((row: any) => ({ ...row, status: null, checked_by: null, date_checked: null, comment: null }));
        const checklist = applyChanges(blank, payload.changes, await this.whoAmI(), new Date().toISOString());

        const doc = await this.units.create({
            location, hardware_category: categoryName, hardware_type: type, ...details,
            checklist, progress: checklistProgress(checklist), version: 0,
        });
        return doc.toObject();
    }

    // Saves a unit: its details and the checklist answers that changed. The save is refused when someone else saved the
    // unit after this copy was loaded (`version`), so nobody overwrites another person's work unseen.
    async update(payload: any) {
        const unit = await this.findUnit(payload && payload.id);
        const expected = payload.version === undefined || payload.version === null || isNaN(Number(payload.version)) ? null : Number(payload.version);
        const conflict = new ConflictException('This unit was changed by someone else.');
        if (expected !== null && (unit.version || 0) !== expected) {
            throw conflict;
        }

        const place = await this.locations.getLocation(unit.location);
        if (!place) {
            throw new NotFoundException(`There is no location called "${unit.location}".`);
        }
        const category = await this.catalogue.getCategory(unit.hardware_category);
        const pick = (key: string) => (payload[key] !== undefined ? payload[key] : unit[key]);
        const details = await this.resolveDetails(
            place, category, unit.hardware_type,
            { serial_no: pick('serial_no'), device_name: pick('device_name'), model: pick('model'), pc_image: pick('pc_image'), project: pick('project'), parts: pick('parts') },
            unit, String(unit._id),
        );
        const checklist = applyChanges(unit.checklist, payload.changes, await this.whoAmI(), new Date().toISOString());

        const filter: any = { _id: unit._id };
        if (expected !== null) {
            filter.version = expected === 0 ? { $in: [0, null] } : expected;
        }
        const saved: any = await this.units.findOneAndUpdate(
            filter,
            { $set: { ...details, checklist, progress: checklistProgress(checklist) }, $inc: { version: 1 } },
            { new: true },
        ).lean().exec();
        if (!saved) {
            throw conflict;
        }
        return saved;
    }
}
