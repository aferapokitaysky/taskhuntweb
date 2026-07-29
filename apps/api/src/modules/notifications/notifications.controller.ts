import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { NotificationsService } from './notifications.service';
import { SetPreferenceDto } from './dto/set-preference.dto';
import { SetDigestDto } from './dto/set-digest.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  setPreference(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPreferenceDto) {
    return this.notificationsService.setPreference(user.id, dto.channel, dto.enabled);
  }

  @Patch('preferences/digest')
  setDigestPreference(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetDigestDto) {
    return this.notificationsService.setDigestFrequency(user.id, dto.frequency);
  }

  @Get('me')
  listMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.listForUser(user.id, unreadOnly === 'true');
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }
}
