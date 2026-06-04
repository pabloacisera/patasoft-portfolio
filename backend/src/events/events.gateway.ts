import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : [process.env.FRONTEND_URL || 'http://localhost:5173'],
    credentials: true,
  },
  namespace: '/',
})
@Injectable()
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);
  private userSockets: Map<string, string[]> = new Map();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      this.logger.warn(`Client ${client.id} without token, disconnecting`);
      client.disconnect();
      return;
    }

    try {
      const payload = await this.validateToken(token);
      if (!payload) {
        client.disconnect();
        return;
      }

      client.data.userId = payload.userId;
      client.data.companyId = payload.companyId;

      const existing = this.userSockets.get(payload.userId) || [];
      existing.push(client.id);
      this.userSockets.set(payload.userId, existing);

      client.join(`company:${payload.companyId}`);
      client.join(`user:${payload.userId}`);

      this.logger.log(`Client ${client.id} connected as user ${payload.userId}`);
    } catch (e) {
      this.logger.warn(`Invalid token from client ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const existing = this.userSockets.get(userId) || [];
      this.userSockets.set(userId, existing.filter((id) => id !== client.id));
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, payload: { room: string }) {
    if (payload.room) client.join(payload.room);
    return { event: 'joined', room: payload.room };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(client: Socket, payload: { room: string }) {
    if (payload.room) client.leave(payload.room);
    return { event: 'left', room: payload.room };
  }

  private async validateToken(token: string): Promise<{ userId: string; companyId: string } | null> {
    try {
      const jwtService = new JwtService({
        secret: this.config.get('JWT_SECRET'),
      });
      const payload = jwtService.verify(token);
      return { userId: payload.sub || payload.userId, companyId: payload.companyId };
    } catch {
      return null;
    }
  }

  emitToCompany(companyId: string, event: string, data: any) {
    this.server.to(`company:${companyId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }
}