import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IConfigCatalogue, IConfigCategory, IConfigCheck } from '@webproject/data';
import { ConfigCategoryDocument, ConfigTypeDocument } from './config-catalogue.schema';

// A name typed by an admin: no leading/trailing spaces, single spaces inside.
export function cleanName(name: any): string {
  return String(name == null ? '' : name).trim().replace(/\s+/g, ' ');
}

// A checklist as it is stored: only the wording of each check (answers belong to units, not to the template), and
// no empty rows.
export function cleanChecklist(rows: any): IConfigCheck[] {
  if (!Array.isArray(rows)) {
    throw new BadRequestException('The checklist must be a list of checks.');
  }
  return rows
    .filter((row) => row && String(row.description || '').trim() !== '')
    .map((row) => ({
      description: String(row.description).trim(),
      reference: row.reference == null || String(row.reference).trim() === '' ? null : String(row.reference).trim(),
      status: null,
      checked_by: null,
      date_checked: null,
      comment: null,
    }));
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// The hardware catalogue: the categories, the types in each, and each type's checklist. Everything that used to be a
// fixed list in the code (what hardware exists, which categories use images, what a new unit's checklist is) is here.
@Injectable()
export class ConfigCatalogueService {
  constructor(
    @InjectModel('config_category') private readonly categories: Model<ConfigCategoryDocument>,
    @InjectModel('config_type') private readonly types: Model<ConfigTypeDocument>,
    @InjectModel('config_hardware') private readonly units: Model<any>,
    @InjectModel('config_location') private readonly locations: Model<any>,
    @InjectModel('hardware_type') private readonly models: Model<any>,
    @InjectModel('pc_image') private readonly images: Model<any>,
  ) {}

  async catalogue(): Promise<IConfigCatalogue> {
    const [categories, types] = await Promise.all([
      this.categories.find().sort({ _id: 1 }).lean().exec() as Promise<any[]>,
      this.types.find({}, { category: 1, name: 1 }).sort({ _id: 1 }).lean().exec() as Promise<any[]>,
    ]);
    return {
      categories: categories.map((c) => ({
        name: c.name,
        icon: c.icon || 'box-open',
        uses_image: !!c.uses_image,
        parts: c.parts || [],
        types: types.filter((t) => t.category === c.name).map((t) => t.name),
      })),
    };
  }

  async findCategory(name: string): Promise<IConfigCategory | null> {
    const doc: any = await this.categories.findOne({ name }).lean().exec();
    return doc ? { name: doc.name, icon: doc.icon || 'box-open', uses_image: !!doc.uses_image, parts: doc.parts || [] } : null;
  }

  async getCategory(name: string): Promise<IConfigCategory> {
    const category = await this.findCategory(name);
    if (!category) {
      throw new NotFoundException(`There is no category called "${name}".`);
    }
    return category;
  }

  // The checklist a new unit of this type starts from.
  async getType(name: string) {
    const doc: any = await this.types.findOne({ name }).lean().exec();
    if (!doc) {
      throw new NotFoundException(`There is no hardware type called "${name}".`);
    }
    return { category: doc.category, name: doc.name, checklist: doc.checklist || [] };
  }

  async typeExists(category: string, name: string): Promise<boolean> {
    return (await this.types.countDocuments({ category, name })) > 0;
  }

  // Names of the hardware types in categories that have a PC image (the types an image can be made for).
  async imageTypes(): Promise<string[]> {
    const withImages: any[] = await this.categories.find({ uses_image: true }, { name: 1 }).lean().exec();
    const types: any[] = await this.types.find({ category: { $in: withImages.map((c) => c.name) } }, { name: 1 }).sort({ _id: 1 }).lean().exec();
    return types.map((t) => t.name);
  }

  // ---------- categories ----------

  private cleanParts(parts: any): string[] {
    if (parts == null) {
      return [];
    }
    if (!Array.isArray(parts)) {
      throw new BadRequestException('The parts must be a list of names.');
    }
    const names = parts.map(cleanName).filter((name) => name);
    return names.filter((name, i) => names.findIndex((n) => sameName(n, name)) === i);
  }

  async createCategory(dto: any) {
    const name = cleanName(dto && dto.name);
    if (!name) {
      throw new BadRequestException('Give the category a name.');
    }
    const existing: any[] = await this.categories.find({}, { name: 1 }).lean().exec();
    if (existing.some((c) => sameName(c.name, name))) {
      throw new ConflictException(`There is already a category called "${name}".`);
    }
    await this.categories.create({
      name,
      icon: cleanName(dto.icon) || 'box-open',
      uses_image: !!dto.uses_image,
      parts: this.cleanParts(dto.parts),
    });
    return this.catalogue();
  }

  async updateCategory(name: string, dto: any) {
    await this.getCategory(name);
    const set: any = {};
    if (dto && dto.icon !== undefined) {
      set.icon = cleanName(dto.icon) || 'box-open';
    }
    if (dto && dto.uses_image !== undefined) {
      set.uses_image = !!dto.uses_image;
    }
    if (dto && dto.parts !== undefined) {
      set.parts = this.cleanParts(dto.parts);
    }
    await this.categories.updateOne({ name }, { $set: set });
    return this.catalogue();
  }

  async deleteCategory(name: string) {
    await this.getCategory(name);
    if ((await this.types.countDocuments({ category: name })) > 0) {
      throw new ConflictException(`"${name}" still has hardware types. Delete them first.`);
    }
    if ((await this.models.countDocuments({ config_type: name })) > 0) {
      throw new ConflictException(`"${name}" is still used by hardware models in the Hardware List.`);
    }
    if ((await this.units.countDocuments({ hardware_category: name })) > 0) {
      throw new ConflictException(`"${name}" still has units.`);
    }
    await this.categories.deleteOne({ name });
    return this.catalogue();
  }

  // ---------- types ----------

  async createType(dto: any) {
    const name = cleanName(dto && dto.name);
    const category = cleanName(dto && dto.category);
    if (!name) {
      throw new BadRequestException('Give the hardware type a name.');
    }
    await this.getCategory(category);
    const existing: any[] = await this.types.find({}, { name: 1 }).lean().exec();
    if (existing.some((t) => sameName(t.name, name))) {
      throw new ConflictException(`There is already a hardware type called "${name}".`);
    }
    await this.types.create({ category, name, checklist: dto.checklist === undefined ? [] : cleanChecklist(dto.checklist) });
    return this.catalogue();
  }

  async deleteType(name: string) {
    await this.getType(name);
    const used = await this.units.countDocuments({ hardware_type: name });
    if (used > 0) {
      throw new ConflictException(`"${name}" has ${used} unit${used === 1 ? '' : 's'}, so it cannot be deleted.`);
    }
    if ((await this.locations.countDocuments({ 'item_access.hardware_type': name })) > 0) {
      throw new ConflictException(`"${name}" is still available to a location. Remove it in Edit Locations first.`);
    }
    if ((await this.images.countDocuments({ pc_type: name })) > 0) {
      throw new ConflictException(`"${name}" still has PC images in the Image List.`);
    }
    await this.types.deleteOne({ name });
    return this.catalogue();
  }

  async saveChecklist(name: string, rows: any) {
    await this.getType(name);
    const checklist = cleanChecklist(rows);
    await this.types.updateOne({ name }, { $set: { checklist } });
    return { name, rows: checklist.length };
  }
}
