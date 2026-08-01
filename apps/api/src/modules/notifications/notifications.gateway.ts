import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { getAllowedOrigins } from '../../common/config/allowed-origins';

interface AuthenticatedSocket extends Socket {
  data: { userId: string };
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

/**
 * Личный канал уведомлений — колокольчик раньше узнавал о новых событиях
 * только через polling раз в 30с (NotificationBell), из-за чего "отправил
 * отклик — уведомление не пришло" читалось как баг, хотя оно просто ещё
 * не долетело по таймеру. Один сокет-подключение на пользователя (не на
 * заказ, как ChatGateway) — уведомления приходят с любой страницы сайта,
 * не только с открытого чата конкретной сделки.
 */
@WebSocketGateway({ namespace: '/notifications', cors: { origin: getAllowedOrigins(), credentials: true } })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token = socket.handshake.auth?.token as string;
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
      socket.data.userId = payload.sub;
      socket.join(userRoom(payload.sub));
    } catch {
      socket.disconnect();
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(userRoom(userId)).emit(event, payload);
  }
}
