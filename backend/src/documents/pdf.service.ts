import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private prisma: PrismaService) {}

  async generatePetCard(petId: string, companyId: string): Promise<Buffer> {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, companyId },
      include: {
        client: true,
        photos: { where: { isPrimary: true } },
        medicalRecords: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { procedures: true, prescriptions: true },
        },
      },
    });

    if (!pet) throw new NotFoundException('Mascota no encontrada');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, address: true, phone: true },
    });

    const templatePath = path.join(__dirname, 'templates', 'pet-card.hbs');
    const template = fs.readFileSync(templatePath, 'utf-8');
    const compiled = Handlebars.compile(template);

    const age = pet.birthDate ? this.calculateAge(pet.birthDate) : 'Desconocida';

    const html = compiled({
      petName: pet.name,
      species: pet.species,
      breed: pet.breed || '-',
      gender: pet.gender || '-',
      age,
      weight: pet.weight || '-',
      isNeutered: pet.isNeutered,
      notes: pet.notes,
      photoUrl: pet.photos[0]?.cloudinaryUrl,
      clientName: pet.client?.name || '-',
      clientLastName: pet.client?.lastName || '',
      clientPhone: pet.client?.phone || '-',
      clientEmail: pet.client?.email || '-',
      companyName: company?.name,
      companyAddress: company?.address,
      records: pet.medicalRecords.map(r => ({
        date: r.date.toLocaleDateString('es-AR'),
        visitReason: r.visitReason,
        diagnosis: r.diagnosis,
      })),
      generatedAt: new Date().toLocaleString('es-AR'),
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });

    await browser.close();
    return Buffer.from(pdf);
  }

  async generateReceipt(paymentId: string, companyId: string): Promise<Buffer> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId },
      include: {
        client: true,
        items: true,
      },
    });

    if (!payment) throw new NotFoundException('Pago no encontrado');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, address: true, phone: true },
    });

    const templatePath = path.join(__dirname, 'templates', 'receipt.hbs');
    const template = fs.readFileSync(templatePath, 'utf-8');
    const compiled = Handlebars.compile(template);

    const html = compiled({
      companyName: company?.name,
      companyAddress: company?.address,
      companyPhone: company?.phone,
      receiptNumber: payment.id.slice(-8).toUpperCase(),
      date: payment.createdAt.toLocaleDateString('es-AR'),
      clientName: `${payment.client?.name || ''} ${payment.client?.lastName || ''}`.trim() || 'Consumidor Final',
      items: payment.items.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toFixed(2),
        totalPrice: i.totalPrice.toFixed(2),
      })),
      totalAmount: payment.totalAmount.toFixed(2),
      method: payment.method,
      status: payment.status,
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });

    await browser.close();
    return Buffer.from(pdf);
  }

  private calculateAge(birthDate: Date): string {
    const now = new Date();
    const years = now.getFullYear() - birthDate.getFullYear();
    const months = now.getMonth() - birthDate.getMonth();
    
    if (years < 1) {
      const totalMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + months;
      return `${totalMonths} mes${totalMonths > 1 ? 'es' : ''}`;
    }
    return `${years} año${years > 1 ? 's' : ''}`;
  }

   async generateMedicalHistory(petId: string, companyId: string): Promise<Buffer> {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, companyId } as any,
      include: {
        client: true,
        photos: true,
        medicalRecords: {
          orderBy: { date: 'desc' },
          include: {
            procedures: true,
            prescriptions: { include: { supply: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    }) as any;

    if (!pet) throw new NotFoundException('Mascota no encontrada');
    if (pet.isDeleted) throw new NotFoundException('Mascota eliminada');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, address: true, phone: true },
    });

    const templatePath = path.join(__dirname, 'templates', 'medical-history.hbs');
    
    if (!fs.existsSync(templatePath)) {
      await this.createMedicalHistoryTemplate();
    }

    const template = fs.readFileSync(templatePath, 'utf-8');
    const compiled = Handlebars.compile(template);

    const html = compiled({
      petName: pet.name,
      species: pet.species,
      breed: pet.breed || '-',
      gender: pet.gender || '-',
      age: pet.birthDate ? this.calculateAge(pet.birthDate) : 'Desconocida',
      weight: pet.weight || '-',
      color: pet.color || '-',
      microchip: pet.microchipId || '-',
      isNeutered: pet.isNeutered,
      notes: pet.notes,
      clientName: pet.client?.name || '-',
      clientLastName: pet.client?.lastName || '',
      clientPhone: pet.client?.phone || '-',
      clientEmail: pet.client?.email || '-',
      companyName: company?.name,
      companyAddress: company?.address,
      companyPhone: company?.phone,
      records: pet.medicalRecords.map(r => ({
        date: r.date.toLocaleDateString('es-AR'),
        visitReason: r.visitReason,
        diagnosis: r.diagnosis || '-',
        treatment: r.treatment || '-',
        procedures: r.procedures.map(p => ({
          name: p.name,
          price: p.customPrice || '-',
        })),
        prescriptions: r.prescriptions.map(p => ({
          medicineName: p.medicineName,
          dose: p.dose || '-',
          duration: p.duration || '-',
        })),
      })),
       payments: (pet.payments || []).filter((p: any) => !p.isDeleted).map(p => ({
        date: p.createdAt.toLocaleDateString('es-AR'),
        amountValue: p.totalAmount.toFixed(2),
        status: p.status,
        method: p.method || '-',
      })),
       debts: (pet.payments || []).filter((p: any) => p.debt && !p.debt.isDeleted).map(p => ({
        amountValue: p.debt.amount.toFixed(2),
        status: p.debt.status,
        dueDate: p.debt.dueDate.toLocaleDateString('es-AR'),
      })),
      generatedAt: new Date().toLocaleString('es-AR'),
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });

    await browser.close();
    return Buffer.from(pdf);
  }

  private async createMedicalHistoryTemplate() {
    // Template is now in external file: src/documents/templates/medical-history.hbs
    // This method is kept for compatibility but no longer creates the template
    return;
  }
}