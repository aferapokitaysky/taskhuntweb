import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ChatService } from './chat.service';
import { SendFileMessageDto, SendMessageDto } from './dto/send-message.dto';

/** REST-фолбэк поверх WebSocket-гейтвея — для первичной загрузки истории и как API без сокета. */
@UseGuards(JwtAuthGuard)
@Controller('orders/:orderId/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Query('freelancerId') freelancerId: string | undefined,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendTextMessage(orderId, freelancerId ?? user.id, user.id, dto.body);
  }

  @Post('messages/file')
  sendFileMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Query('freelancerId') freelancerId: string | undefined,
    @Body() dto: SendFileMessageDto,
  ) {
    return this.chatService.sendFileMessage(orderId, freelancerId ?? user.id, user.id, dto.fileId, dto.body);
  }

  @Delete('messages/:messageId')
  deleteMessage(@CurrentUser() user: AuthenticatedUser, @Param('messageId') messageId: string) {
    return this.chatService.softDeleteMessage(messageId, user.id);
  }
}
