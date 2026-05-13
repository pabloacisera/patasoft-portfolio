import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    AiProxyModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}