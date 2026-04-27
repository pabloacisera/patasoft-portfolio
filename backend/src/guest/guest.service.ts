import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { GuestDataDto } from './dto/guest.dto';

@Injectable()
export class GuestService {
  private readonly logger = new Logger(GuestService.name);
  private readonly TTL = 259200; // 72 horas en segundos

  constructor(private readonly redis: RedisService) {}

  async createSession(sessionId: string) {
    const key = `guest:${sessionId}:meta`;
    const meta = {
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      trialDay: 1,
    };

    await this.redis.set(key, JSON.stringify(meta), this.TTL);
    this.logger.log(`Sesión de invitado creada: ${sessionId}`);
    
    return { sessionId, meta };
  }

  async getSession(sessionId: string) {
    const keys = await this.redis.keys(`guest:${sessionId}:*`);
    if (keys.length === 0) {
      return null;
    }

    const sessionData: any = {};
    for (const key of keys) {
      const field = key.split(':')[2];
      const value = await this.redis.get(key);
      sessionData[field] = value ? JSON.parse(value) : null;
    }

    // Actualizar última actividad
    const metaKey = `guest:${sessionId}:meta`;
    if (sessionData.meta) {
      sessionData.meta.lastActivity = new Date().toISOString();
      await this.redis.set(metaKey, JSON.stringify(sessionData.meta), this.TTL);
    }

    return sessionData;
  }

  async addData(sessionId: string, dto: GuestDataDto) {
    const key = `guest:${sessionId}:${dto.type}`;
    
    if (dto.type === 'company') {
      await this.redis.set(key, JSON.stringify(dto.data), this.TTL);
    } else {
      const existingDataStr = await this.redis.get(key);
      const items = existingDataStr ? JSON.parse(existingDataStr) : [];
      
      // Asignar ID temporal si no tiene
      const newItem = {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...dto.data,
        createdAt: new Date().toISOString(),
      };
      
      items.push(newItem);
      await this.redis.set(key, JSON.stringify(items), this.TTL);
      return newItem;
    }

    return dto.data;
  }

  async deleteSession(sessionId: string) {
    const keys = await this.redis.keys(`guest:${sessionId}:*`);
    for (const key of keys) {
      await this.redis.del(key);
    }
    this.logger.log(`Sesión de invitado eliminada: ${sessionId}`);
    return { success: true };
  }

  async updateItem(sessionId: string, type: string, itemId: string, data: any) {
    const key = `guest:${sessionId}:${type}`;
    const existingDataStr = await this.redis.get(key);
    
    if (!existingDataStr) throw new BadRequestException('No hay datos para este tipo');
    
    let items = JSON.parse(existingDataStr);
    const index = items.findIndex((item: any) => item.id === itemId);
    
    if (index === -1) throw new BadRequestException('Item no encontrado');
    
    items[index] = { ...items[index], ...data, updatedAt: new Date().toISOString() };
    await this.redis.set(key, JSON.stringify(items), this.TTL);
    
    return items[index];
  }

  async deleteItem(sessionId: string, type: string, itemId: string) {
    const key = `guest:${sessionId}:${type}`;
    const existingDataStr = await this.redis.get(key);
    
    if (!existingDataStr) return { success: false };
    
    let items = JSON.parse(existingDataStr);
    items = items.filter((item: any) => item.id !== itemId);
    
    await this.redis.set(key, JSON.stringify(items), this.TTL);
    return { success: true };
  }
}
