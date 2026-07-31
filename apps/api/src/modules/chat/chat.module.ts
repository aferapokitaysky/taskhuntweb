import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatController, ChatInboxController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatEventsListener } from './listeners/chat-events.listener';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ChatController, ChatInboxController],
  providers: [ChatService, ChatGateway, ChatEventsListener],
  exports: [ChatService],
})
export class ChatModule {}
