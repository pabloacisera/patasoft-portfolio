import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * NOTA: Estos DTOs están definidos y listos para usar, pero su conexión 
 * a los controllers (via @ApiResponse) está pendiente como deuda técnica (Tarea 8.1).
 */

export class CompanyResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() legalName?: string;
  @ApiProperty() address: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() logoUrl?: string;
  @ApiPropertyOptional() cloudinaryFolder?: string;
  @ApiProperty() isBlocked: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ClientResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() dni?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() address?: string;
  @ApiProperty() isCompany: boolean;
  @ApiPropertyOptional() companyName?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PetResponseDto {
  @ApiProperty() id: number;
  @ApiPropertyOptional() clientId?: number;
  @ApiProperty() name: string;
  @ApiProperty() species: string;
  @ApiPropertyOptional() breed?: string;
  @ApiPropertyOptional() gender?: string;
  @ApiPropertyOptional() birthDate?: Date;
  @ApiPropertyOptional() weight?: number;
  @ApiPropertyOptional() color?: string;
  @ApiPropertyOptional() microchipId?: string;
  @ApiProperty() isNeutered: boolean;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ProcedureResponseDto {
  @ApiProperty() id: number;
  @ApiPropertyOptional() priceItemId?: number;
  @ApiPropertyOptional() customPrice?: number;
  @ApiProperty() quantity: number;
}

export class PrescriptionResponseDto {
  @ApiProperty() id: number;
  @ApiPropertyOptional() supplyId?: number;
  @ApiProperty() medicineName: string;
  @ApiPropertyOptional() dose?: string;
  @ApiPropertyOptional() frequency?: string;
  @ApiPropertyOptional() duration?: string;
  @ApiProperty() soldInClinic: boolean;
  @ApiProperty() quantity: number;
  @ApiPropertyOptional() dispensingQuantity?: number;
  @ApiPropertyOptional() dispensingUnit?: string;
}

export class MedicalRecordResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() petId: number;
  @ApiPropertyOptional() veterinarianId?: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() procedures?: ProcedureResponseDto[];
  @ApiPropertyOptional() prescriptions?: PrescriptionResponseDto[];
}

export class PaymentItemResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() description: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() totalPrice: number;
  @ApiProperty() itemType: string;
}

export class PaymentResponseDto {
  @ApiProperty() id: number;
  @ApiPropertyOptional() clientId?: number;
  @ApiPropertyOptional() petId?: number;
  @ApiPropertyOptional() medicalRecordId?: number;
  @ApiProperty() totalAmount: number;
  @ApiProperty() paidAmount: number;
  @ApiProperty() status: string;
  @ApiPropertyOptional() method?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() dueDate?: Date;
  @ApiPropertyOptional() paidAt?: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() items?: PaymentItemResponseDto[];
}

export class SupplyResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiPropertyOptional() brand?: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional() unit?: string;
  @ApiProperty() quantity: number;
  @ApiPropertyOptional() minQuantity?: number;
  @ApiProperty() unitPrice: number;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() expiresAt?: Date;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional() salePrice?: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class DebtResponseDto {
  @ApiProperty() id: number;
  @ApiPropertyOptional() paymentId?: number;
  @ApiProperty() amount: number;
  @ApiProperty() status: string;
  @ApiProperty() dueDate: Date;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() paidAt?: Date;
  @ApiPropertyOptional() interestRate?: number;
  @ApiPropertyOptional() originalAmount?: number;
  @ApiProperty() createdAt: Date;
}

export class NotificationResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() type: string;
  @ApiProperty() title: string;
  @ApiProperty() message: string;
  @ApiProperty() isRead: boolean;
  @ApiProperty() createdAt: Date;
}
