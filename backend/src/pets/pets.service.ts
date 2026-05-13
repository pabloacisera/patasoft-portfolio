import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocalRagService } from '../ai-proxy/local-rag.service';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class PetsService {
  private readonly logger = new Logger(PetsService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private rag: LocalRagService,
  ) {}

  async findAll(companyId: string, pagination: { page?: number; limit?: number; search?: string; species?: string } = {}) {
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 20;
    const search = pagination.search;
    const species = pagination.species;
    const skip = (page - 1) * limit;

    const where = {
      companyId,
      isDeleted: false,
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

    const ownerName = pet.client?.name || 'N/A';
    let ageText = 'N/A';
    if (pet.birthDate) {
      const ageMs = Date.now() - pet.birthDate.getTime();
      ageText = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000)) + ' años';
    }
    this.rag.upsertEmbedding(companyId,
      `Mascota ${pet.name} | especie ${pet.species} | raza ${pet.breed || 'ND'} | peso ${pet.weight || 'ND'}kg | edad ${ageText} | dueño ${ownerName} | notas ${pet.notes || 'sin notas'}`,
      { source: 'pet', petId: pet.id, name: pet.name }
    );

    this.logger.log(`Mascota creada: ${pet.name} (${pet.id})`);
    return pet;
  }

  async update(id: string, companyId: string, dto: UpdatePetDto) {
    await this.findOne(id, companyId);

    const pet = await this.prisma.pet.update({
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

    const ownerName = pet.client?.name || 'N/A';
    let ageText = 'N/A';
    if (pet.birthDate) {
      const ageMs = Date.now() - pet.birthDate.getTime();
      ageText = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000)) + ' años';
    }
    this.rag.upsertEmbedding(companyId,
      `Mascota ${pet.name} | especie ${pet.species} | raza ${pet.breed || 'ND'} | peso ${pet.weight || 'ND'}kg | edad ${ageText} | dueño ${ownerName} | notas ${pet.notes || 'sin notas'}`,
      { source: 'pet', petId: pet.id, name: pet.name }
    );

    return pet;
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);

    await this.prisma.pet.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    this.rag.deleteEmbedding(companyId, { source: 'pet', petId: id });
    this.logger.log(`Mascota eliminada (soft delete): ${id}`);
  }

  async uploadPhoto(petId: string, companyId: string, fileBuffer: Buffer, mimeType: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, companyId },
      include: { client: true, company: { select: { slug: true } } },
    });
    if (!pet) throw new NotFoundException('Mascota no encontrada');

    const photosCount = await this.prisma.petPhoto.count({ where: { petId } });
    if (photosCount >= 5) throw new BadRequestException('Máximo 5 fotos por mascota');

    const clientFolder = pet.client
      ? pet.client.name.replace(/\s+/g, '_').toLowerCase()
      : 'sin_dueno';
    const folder = `patasoft/${pet.company.slug}/${clientFolder}`;

    const base64 = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    const result = await this.cloudinary.getClient().uploader.upload(base64, {
      folder,
      resource_type: 'image',
    });

    const isPrimary = photosCount === 0;
    const photo = await this.prisma.petPhoto.create({
      data: {
        petId,
        cloudinaryUrl: result.secure_url,
        cloudinaryId: result.public_id,
        isPrimary,
      },
    });

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