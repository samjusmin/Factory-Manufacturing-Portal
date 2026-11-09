import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IConfigHardware, IConfigLocation, STOCK_PROJECT, locationProjects } from '@webproject/data';
import { ConfigCatalogueService, cleanName } from '../config-catalogue/config-catalogue.service';
import { ConfigLocationUpdateDTO } from './config-location.update.dto';
import { ConfigLocationDocument } from './config-location.schema';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The locations and what each may configure: its hardware types, PC images, hardware models and projects.
@Injectable()
export class ConfigLocationService {
    constructor(
        @InjectModel('config_location') private readonly model: Model<ConfigLocationDocument>,
        @InjectModel('config_hardware') private readonly units: Model<any>,
        private readonly catalogue: ConfigCatalogueService,
    ) {}

    private normalise(doc: any): IConfigLocation & { projects: string[] } {
        return {
            location: doc.location,
            item_access: doc.item_access || [],
            image_access: doc.image_access || [],
            hardware_access: doc.hardware_access || [],
            projects: (doc.projects || []).filter((code) => code !== STOCK_PROJECT),
        };
    }

    async findAll() {
        const docs: any[] = await this.model.find({}).lean().exec();
        return docs.map((doc) => this.normalise(doc));
    }

    async findByNames(names: string[]) {
        const docs: any[] = await this.model.find({ location: { $in: names } }).lean().exec();
        return docs.map((doc) => this.normalise(doc));
    }

    async getLocation(name: string) {
        const doc = await this.model.findOne({ location: name }).lean().exec();
        return doc ? this.normalise(doc) : null;
    }

    // The project codes a unit at this location can be allocated to: STOCK first, then the admin's codes.
    async getProjects(name: string): Promise<string[]> {
        const location = await this.getLocation(name);
        if (!location) {
            throw new NotFoundException(`There is no location called "${name}".`);
        }
        return locationProjects(location.projects);
    }

    async getAccessibleHardwareIDs(name: string): Promise<string[]> {
        const location = await this.getLocation(name);
        return (location && location.hardware_access) || [];
    }

    async getImageAccess(name: string): Promise<string[]> {
        const location = await this.getLocation(name);
        return (location && location.image_access) || [];
    }

    async addEntry(dto: ConfigLocationUpdateDTO) {
        const name = cleanName(dto && dto.location);
        if (!name) {
            throw new BadRequestException('Enter a location name.');
        }
        const existing: any[] = await this.model.find({}, { location: 1 }).lean().exec();
        if (existing.some((l) => l.location.toLowerCase() === name.toLowerCase())) {
            throw new ConflictException(`There is already a location called "${name}".`);
        }
        const doc = await this.model.create({ location: name, item_access: [], image_access: [], hardware_access: [], projects: [] });
        return this.normalise(doc.toObject());
    }

    // The hardware a location may configure: every category and type must exist, and a type cannot be taken away
    // while the location still has units of it.
    private async cleanAccess(location: string, access: any, current: IConfigHardware[]): Promise<IConfigHardware[]> {
        if (!Array.isArray(access)) {
            throw new BadRequestException('The hardware access must be a list.');
        }
        const cleaned: IConfigHardware[] = [];
        for (const entry of access) {
            const category = cleanName(entry && entry.hardware_category);
            await this.catalogue.getCategory(category);
            const types = Array.from(new Set((Array.isArray(entry.hardware_type) ? entry.hardware_type : []).map(cleanName))) as string[];
            for (const type of types) {
                if (!(await this.catalogue.typeExists(category, type))) {
                    throw new BadRequestException(`"${type}" is not a ${category} hardware type.`);
                }
            }
            if (types.length) {
                cleaned.push({ hardware_category: category, hardware_type: types });
            }
        }
        for (const entry of current) {
            for (const type of entry.hardware_type) {
                const kept = cleaned.some((c) => c.hardware_category === entry.hardware_category && c.hardware_type.includes(type));
                const used = kept ? 0 : await this.units.countDocuments({ location, hardware_category: entry.hardware_category, hardware_type: type });
                if (used > 0) {
                    throw new ConflictException(`${location} still has ${plural(used, 'unit')} of "${type}", so it cannot be removed.`);
                }
            }
        }
        return cleaned;
    }

    // The location's project codes, tidied; a code still used by a unit cannot be removed.
    private async cleanProjects(location: string, projects: any, current: string[]): Promise<string[]> {
        if (!Array.isArray(projects)) {
            throw new BadRequestException('The projects must be a list of codes.');
        }
        const cleaned = locationProjects(projects).slice(1);
        for (const code of current) {
            if (!cleaned.includes(code)) {
                const used = await this.units.countDocuments({ location, project: code });
                if (used > 0) {
                    throw new ConflictException(`${code} is used by ${plural(used, 'unit')} at ${location}. Move ${used === 1 ? 'it' : 'them'} to another project or to ${STOCK_PROJECT} first.`);
                }
            }
        }
        return cleaned;
    }

    async updateEntry(dto: ConfigLocationUpdateDTO) {
        const location = await this.getLocation(dto && dto.location);
        if (!location) {
            throw new NotFoundException(`There is no location called "${dto && dto.location}".`);
        }
        const set: any = {};
        if (dto.item_access !== undefined) {
            set.item_access = await this.cleanAccess(location.location, dto.item_access, location.item_access);
        }
        if (dto.image_access !== undefined) {
            set.image_access = (Array.isArray(dto.image_access) ? dto.image_access : []).map(String);
        }
        if (dto.hardware_access !== undefined) {
            set.hardware_access = (Array.isArray(dto.hardware_access) ? dto.hardware_access : []).map(String);
        }
        if (dto.projects !== undefined) {
            set.projects = await this.cleanProjects(location.location, dto.projects, location.projects);
        }
        const doc = await this.model.findOneAndUpdate({ location: location.location }, { $set: set }, { new: true }).lean().exec();
        return this.normalise(doc);
    }
}
