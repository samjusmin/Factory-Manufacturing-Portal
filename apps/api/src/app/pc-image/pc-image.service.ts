import { isValidObjectId, Model, Types } from 'mongoose';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PcImageDocument } from './pc-image.schema';
import { ConfigCatalogueService, cleanName } from '../config-catalogue/config-catalogue.service';

// The PC images (Config > Image List): who built each, for which hardware type, and when.
@Injectable()
export class PcImageService {
    constructor(
        @InjectModel('pc_image') private PcImageModel: Model<PcImageDocument>,
        private readonly catalogue: ConfigCatalogueService,
    ) {}

    async findAll() {
        return this.PcImageModel.find({});
    }

    async findByType(type: string) {
        return this.PcImageModel.find(
            { pc_type: type },
            { name: 1, _id: 0 }
        );
    }

    // Images grouped by the hardware type they are for, as the location access tree lists them.
    async getImageTree() {
        return this.PcImageModel.aggregate([
            {
                $sort: {
                    pc_type: 1,
                    date_created: -1
                }
            },
            {
                $group: {
                    _id: "$pc_type",
                    children: {
                        $push: {
                            imageId: "$_id",
                            name: "$name"
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    children: 1
                }
            },
            {
                $sort: {
                    name: 1
                }
            }
        ]);
    }

    // The images among `ids` that are for this hardware type, by name.
    async getImageByIds(ids: string[], pcType: string) {
        const objectIds = (ids || []).filter((id) => isValidObjectId(id)).map((id) => new Types.ObjectId(id));
        return this.PcImageModel.find(
            { _id: { $in: objectIds }, pc_type: pcType },
            { name: 1, _id: 0 }
        );
    }

    // Adds an image, or changes an existing one (when `id` is given). The hardware type must be one that uses PC
    // images, and every detail is needed. The saved image is returned.
    async updateImage(data: any) {
        const { id, ...rest } = data || {};
        const fields: any = {
            name: cleanName(rest.name),
            description: cleanName(rest.description),
            added_by: cleanName(rest.added_by),
            responsible_person: cleanName(rest.responsible_person),
            pc_type: cleanName(rest.pc_type),
            date_created: cleanName(rest.date_created),
        };
        const missing = Object.keys(fields).filter((key) => !fields[key]);
        if (missing.length) {
            throw new BadRequestException(`Fill in every detail of the image (${missing.join(', ')}).`);
        }
        if (!(await this.catalogue.imageTypes()).includes(fields.pc_type)) {
            throw new BadRequestException(`"${fields.pc_type}" is not a hardware type that uses a PC image.`);
        }
        const same: any[] = await this.PcImageModel.find({ name: fields.name }, { _id: 1 }).lean();
        if (same.some((image) => String(image._id) !== String(id))) {
            throw new ConflictException(`There is already an image called "${fields.name}".`);
        }

        if (id) {
            const doc = isValidObjectId(id)
                ? await this.PcImageModel.findOneAndUpdate({ _id: new Types.ObjectId(id) }, { $set: fields }, { new: true, runValidators: true })
                : null;
            if (!doc) {
                throw new NotFoundException('That image no longer exists.');
            }
            return doc;
        }
        return this.PcImageModel.create(fields);
    }
}
