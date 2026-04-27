import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PriceItemsController } from './price-items.controller';
import { PriceItemsService } from './price-items.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule,
    EventsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [PriceItemsController],
  providers: [PriceItemsService],
  exports: [PriceItemsService],
})
export class PriceItemsModule {}
