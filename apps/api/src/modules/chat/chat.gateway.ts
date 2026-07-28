import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

interface AuthenticatedSocket extends Socket {
  data: { userId: string };
}

/**
 * WebSocket-чат по заказу. Комнаты именуются `order:<orderId>`.
 * Live presence (online/typing/last seen) реализуется поверх этих же
 * комнат события `presence:*` — вынесено в Phase 2, тут заложен только гейтвей.
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token = socket.handshake.auth?.token as string;
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
      socket.data.userId = payload.sub;
    } catch {
      socket.disconnect();
    }
  }

  @SubscribeMessage('joinOrder')
  async joinOrder(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() orderId: string) {
    // list бросит ForbiddenException, если пользователь не участник — тем самым не даём подключиться к чужому чату
    await this.chatService.listMessages(orderId, socket.data.userId);
    socket.join(`order:${orderId}`);
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { orderId: string; body: string },
  ) {
    const message = await this.chatService.sendTextMessage(data.orderId, socket.data.userId, data.body);
    this.server.to(`order:${data.orderId}`).emit('newMessage', message);
    return message;
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() orderId: string) {
    socket.to(`order:${orderId}`).emit('typing', { userId: socket.data.userId });
  }

  /** Вызывается ChatEventsListener, чтобы разослать invoice-карточку в реальном времени. */
  broadcastToOrder(orderId: string, event: string, payload: unknown) {
    this.server.to(`order:${orderId}`).emit(event, payload);
  }
}
