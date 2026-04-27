import { Module } from '@nestjs/common';
import { AiProxyService } from './ai-proxy.service';
import { AiProxyController } from './ai-proxy.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [AiProxyController],
  providers: [AiProxyService, PrismaService, JwtService],
  exports: [AiProxyService],
})
export class AiProxyModule {}
