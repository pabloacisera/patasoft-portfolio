import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class PetsService {
  private readonly logger = new Logger(PetsService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async findAll(companyId: string, pagination: { page?: number; limit?: number; search?: string; species?: string } = {}) {
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 20;
    const search = pagination.search;
    const species = pagination.species;
    const skip = (page - 1) * limit;

    const where = {
      companyId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { breed: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(species && { species }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.pet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { id: true, name: true } }, photos: true },
      }),
      this.prisma.pet.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, companyId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        photos: true,
        medicalRecords: { orderBy: { date: 'desc' }, take: 20 },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!pet) throw new NotFoundException('Mascota no encontrada');
    return pet;
  }

  async create(companyId: string, dto: CreatePetDto) {
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, companyId },
      });
      if (!client) throw new BadRequestException('Cliente no encontrado');
    }

    const pet = await this.prisma.pet.create({
      data: {
        companyId,
        clientId: dto.clientId,
        name: dto.name,
        species: dto.species,
        breed: dto.breed,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        weight: dto.weight,
        color: dto.color,
        microchipId: dto.microchipId,
        isNeutered: dto.isNeutered ?? false,
        notes: dto.notes,
      },
      include: { client: true, photos: true },
    });

    this.logger.log(`Mascota creada: ${pet.name} (${pet.id})`);
    return pet;
  }

  async update(id: string, companyId: string, dto: UpdatePetDto) {
    await this.findOne(id, companyId);

    return this.prisma.pet.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.clientId !== undefined && { clientId: dto.clientId }),
        ...(dto.species && { species: dto.species }),
        ...(dto.breed && { breed: dto.breed }),
        ...(dto.gender && { gender: dto.gender }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
        ...(dto.weight && { weight: dto.weight }),
        ...(dto.color && { color: dto.color }),
        ...(dto.microchipId && { microchipId: dto.microchipId }),
        ...(dto.isNeutered !== undefined && { isNeutered: dto.isNeutered }),
        ...(dto.notes && { notes: dto.notes }),
      },
      include: { client: true, photos: true },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);

    const photos = await this.prisma.petPhoto.findMany({ where: { petId: id } });
    for (const photo of photos) {
      try {
        await this.cloudinary.deleteImage(photo.cloudinaryId);
      } catch (e) {
        this.logger.warn(`Error deleting photo: ${e.message}`);
      }
    }

    await this.prisma.pet.delete({ where: { id } });
    this.logger.log(`Mascota eliminada: ${id}`);
  }

  async uploadPhoto(id: string, companyId: string, file: string, folder: string) {
    const pet = await this.findOne(id, companyId);
    const isPrimary = pet.photos.length === 0;

    const result = await this.cloudinary.uploadImage(file, folder, {
      publicId: `${folder}/${pet.id}-${Date.now()}`,
    });

    const photo = await this.prisma.petPhoto.create({
      data: {
        petId: id,
        cloudinaryUrl: result.url,
        cloudinaryId: result.publicId,
        isPrimary,
      },
    });

    if (isPrimary) {
      await this.prisma.pet.update({
        where: { id },
        data: { photos: { connect: { id: photo.id } } },
      });
    }

    return photo;
  }

  async deletePhoto(petId: string, photoId: string, companyId: string) {
    await this.findOne(petId, companyId);

    const photo = await this.prisma.petPhoto.findFirst({
      where: { id: photoId, petId },
    });

    if (!photo) throw new NotFoundException('Foto no encontrada');

    try {
      await this.cloudinary.deleteImage(photo.cloudinaryId);
    } catch (e) {
      this.logger.warn(`Error deleting from Cloudinary: ${e.message}`);
    }

    await this.prisma.petPhoto.delete({ where: { id: photoId } });
  }

  async getMedicalRecords(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.medicalRecord.findMany({
      where: { petId: id } as any,
      orderBy: { date: 'desc' },
      include: { procedures: true, prescriptions: true },
    }).then((records: any) => records.filter(r => !r.isDeleted));
  }
}