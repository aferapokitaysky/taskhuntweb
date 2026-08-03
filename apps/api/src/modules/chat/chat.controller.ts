import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SendFileMessageDto, SendMessageDto } from './dto/send-message.dto';

/**
 * REST-фолбэк поверх WebSocket-гейтвея — для первичной загрузки истории и
 * как API без сокета. Раньше сообщения, отправленные через этот путь (а не
 * через socket.emit('sendMessage')), сохранялись в БД, но никогда не
 * долетали до комнаты собеседника вживую — только на следующей полной
 * перезагрузке страницы. Теперь после успешной отправки явно шлём то же
 * 'newMessage' в комнату, что и ChatGateway.sendMessage.
 */
@UseGuards(JwtAuthGuard)
@Controller('orders/:orderId/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /** Список тредов заказа: у клиента — по одному на каждого активного откликнувшегося, у фрилансера — свой. */
  @Get('threads')
  listThreads(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.chatService.listThreads(orderId, user.id);
  }

  @Get('messages')
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Query('freelancerId') freelancerId?: string,
  ) {
    return this.chatService.listMessages(orderId, freelancerId ?? user.id, user.id);
  }

  @Post('messages')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Query('freelancerId') freelancerId: string | undefined,
    @Body() dto: SendMessageDto,
  ) {
    const resolvedFreelancerId = freelancerId ?? user.id;
    const message = await this.chatService.sendTextMessage(orderId, resolvedFreelancerId, user.id, dto.body);
    this.chatGateway.broadcastToOrder(orderId, resolvedFreelancerId, 'newMessage', message);
    return message;
  }

  @Post('messages/file')
  async sendFileMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Query('freelancerId') freelancerId: string | undefined,
    @Body() dto: SendFileMessageDto,
  ) {
    const resolvedFreelancerId = freelancerId ?? user.id;
    const message = await this.chatService.sendFileMessage(orderId, resolvedFreelancerId, user.id, dto.fileId, dto.body);
    this.chatGateway.broadcastToOrder(orderId, resolvedFreelancerId, 'newMessage', message);
    return message;
  }

  @Post('read')
  markThreadRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Query('freelancerId') freelancerId: string | undefined,
  ) {
    return this.chatService.markThreadReadByOrder(orderId, freelancerId ?? user.id, user.id);
  }

  @Delete('messages/:messageId')
  deleteMessage(@CurrentUser() user: AuthenticatedUser, @Param('messageId') messageId: string) {
    return this.chatService.softDeleteMessage(messageId, user.id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatInboxController {
  constructor(private readonly chatService: ChatService) {}

  @Get('threads')
  listMyThreads(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.listMyThreads(user.id);
  }
}
