import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { getAllowedOrigins } from '../../common/config/allowed-origins';

interface AuthenticatedSocket extends Socket {
  data: { userId: string };
}

function roomName(orderId: string, freelancerId: string) {
  return `order:${orderId}:freelancer:${freelancerId}`;
}

/**
 * WebSocket-чат по заказу. Комнаты именуются `order:<orderId>:freelancer:<freelancerId>`
 * — один тред на пару (заказ, фрилансер), не на заказ целиком, чтобы
 * переписка заказчика с разными откликнувшимися не пересекалась.
 * Live presence (online/typing/last seen) реализуется поверх этих же
 * комнат события `presence:*` — вынесено в Phase 2, тут заложен только гейтвей.
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: getAllowedOrigins(), credentials: true } })
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
  async joinOrder(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { orderId: string; freelancerId?: string },
  ) {
    const freelancerId = data.freelancerId ?? socket.data.userId;
    // list бросит ForbiddenException, если пользователь не участник этого треда — тем самым не даём подключиться к чужому
    await this.chatService.listMessages(data.orderId, freelancerId, socket.data.userId);
    socket.join(roomName(data.orderId, freelancerId));
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { orderId: string; freelancerId?: string; body: string },
  ) {
    const freelancerId = data.freelancerId ?? socket.data.userId;
    const message = await this.chatService.sendTextMessage(data.orderId, freelancerId, socket.data.userId, data.body);
    this.broadcastToOrder(data.orderId, freelancerId, 'newMessage', message);
    return message;
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { orderId: string; freelancerId?: string },
  ) {
    const freelancerId = data.freelancerId ?? socket.data.userId;
    socket.to(roomName(data.orderId, freelancerId)).emit('typing', { userId: socket.data.userId });
  }

  /**
   * Вызывается ChatEventsListener/ChatController, чтобы разослать сообщение
   * или обновление счёта в реальном времени. Раскладываем orderId/freelancerId
   * поверх payload — страница /chats держит один сокет для ВСЕХ тредов сразу
   * (не только открытого), и без этой пары полей клиент не может понять,
   * какому треду в списке слева относится входящее 'newMessage'.
   */
  broadcastToOrder(orderId: string, freelancerId: string, event: string, payload: object) {
    this.server.to(roomName(orderId, freelancerId)).emit(event, { ...payload, orderId, freelancerId });
  }
}
