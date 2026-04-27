import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PrismaService, JwtService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
