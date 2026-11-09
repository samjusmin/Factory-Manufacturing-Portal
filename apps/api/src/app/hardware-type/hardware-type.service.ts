import { Model, Types } from 'mongoose';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HardwareTypeDocument } from './hardware-type.schema';
import { ConfigCatalogueService, cleanName } from '../config-catalogue/config-catalogue.service';

// The hardware models (Config > Hardware List): what a location can pick for a unit's model. Each belongs to one
// category from the catalogue.
@Injectable()
export class HardwareTypeService {
    constructor(
        @InjectModel('hardware_type') private HardwareTypeModel: Model<HardwareTypeDocument>,
        private readonly catalogue: ConfigCatalogueService,
    ) {}

    async findAll() {
        return this.HardwareTypeModel.find({});
    }

    // The models a location may use for one category, by name.
    async getAccessibleByCategory(ids: string[], category: string) {
        return this.HardwareTypeModel.find(
            { _id: { $in: ids || [] }, config_type: category },
            { name: 1, _id: 0 }
        )
        .sort({ name: 1 })
        .lean();
    }

    async getHardwareList() {
        return this.HardwareTypeModel.find(
            {},
            {
                _id: 1,
                name: 1,
                config_type: 1
            }
        )
        .sort({ name: 1 })
        .lean();
    }

    // Adds a model, or changes an existing one (when `_id` is given). Its category must exist in the catalogue and its
    // name must not repeat another model's. The saved model is returned.
    async updateHardwareType(data: any) {
        const name = cleanName(data && data.name);
        const category = cleanName(Array.isArray(data && data.config_type) ? data.config_type[0] : data && data.config_type);
        if (!name) {
            throw new BadRequestException('Enter a name for the hardware.');
        }
        if (!category) {
            throw new BadRequestException('Choose which kind of hardware it is.');
        }
        await this.catalogue.getCategory(category);

        const id = data._id ? String(data._id) : null;
        const same: any[] = await this.HardwareTypeModel.find({}, { name: 1 }).lean();
        if (same.some((m) => m.name.toLowerCase() === name.toLowerCase() && String(m._id) !== id)) {
            throw new ConflictException(`There is already hardware called "${name}".`);
        }

        if (id) {
            const doc = await this.HardwareTypeModel.findOneAndUpdate(
                { _id: id },
                { $set: { name, config_type: [category] } },
                { new: true, runValidators: true },
            ).lean();
            if (!doc) {
                throw new NotFoundException('That hardware no longer exists.');
            }
            return doc;
        }
        // Ids are strings (that is how a location's hardware access refers to them).
        const created = await this.HardwareTypeModel.create({ _id: new Types.ObjectId().toHexString(), name, config_type: [category] });
        return created.toObject();
    }
}
