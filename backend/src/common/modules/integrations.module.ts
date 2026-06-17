import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
import { MercadopagoModule } from '../../mercadopago/mercadopago.module';
import { MailModule } from '../../mail/mail.module';
import { ConnectionsModule } from '../../connections/connections.module';
import { AiProxyModule } from '../../ai-proxy/ai-proxy.module';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [
    CloudinaryModule,
    MercadopagoModule,
    MailModule,
    ConnectionsModule,
    AiProxyModule,
    EventsModule,
  ],
  exports: [
    CloudinaryModule,
    MercadopagoModule,
    MailModule,
    ConnectionsModule,
    AiProxyModule,
    EventsModule,
  ],
})
export class IntegrationsModule {}
