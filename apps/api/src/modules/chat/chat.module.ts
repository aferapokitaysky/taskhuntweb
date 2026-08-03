import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatController, ChatInboxController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatEventsListener } from './listeners/chat-events.listener';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [ChatController, ChatInboxController],
  providers: [ChatService, ChatGateway, ChatEventsListener],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
