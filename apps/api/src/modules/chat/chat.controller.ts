import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Get('messages')
  listMessages(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.chatService.listMessages(orderId, user.id);
  }

  @Post('messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendTextMessage(orderId, user.id, dto.body);
  }

  @Post('messages/file')
  sendFileMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: SendFileMessageDto,
  ) {
    return this.chatService.sendFileMessage(orderId, user.id, dto.fileId, dto.body);
  }

  @Delete('messages/:messageId')
  deleteMessage(@CurrentUser() user: AuthenticatedUser, @Param('messageId') messageId: string) {
    return this.chatService.softDeleteMessage(messageId, user.id);
  }
}
