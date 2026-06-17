import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { HashIdService } from '../services/hash-id.service';

@Injectable()
export class ParseHashIdPipe implements PipeTransform<string, number> {
  private readonly hashIdService = new HashIdService();

  transform(value: string): number {
    const decoded = this.hashIdService.decode(value);
    if (decoded !== null) return decoded;

    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;

    throw new BadRequestException(`Invalid ID: "${value}"`);
  }
}
