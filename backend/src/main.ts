import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });
  
  app.useWebSocketAdapter(new IoAdapter(app));
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🐱 PataSoft Backend corriendo en http://localhost:${port}`);
  console.log(`🔗 FRONTEND_URL configurado: ${frontendUrl}`);
  console.log(`🔑 GOOGLE_CLIENT_ID presente: ${!!process.env.GOOGLE_CLIENT_ID}`);
  console.log(`🔑 GOOGLE_CALLBACK_URL: ${process.env.GOOGLE_CALLBACK_URL}`);
}

bootstrap();