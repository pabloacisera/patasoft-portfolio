import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { EventsModule } from '../events/events.module';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    PrismaModule,
    CloudinaryModule,
    EventsModule,
    AiProxyModule,
  ],
  controllers: [SuppliesController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}