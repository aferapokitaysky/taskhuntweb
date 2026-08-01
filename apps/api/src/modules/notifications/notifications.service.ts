import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, unreadOnly?: boolean) {
    const where = {
      userId,
      ...(unreadOnly ? { read: false } : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return { notifications, unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async createForUser(data: { userId: string; title: string; message: string; eventName: string; metadata?: Prisma.InputJsonValue }) {
    return this.prisma.notification.create({ data });
  }

  async getPreferences(userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const byChannel = new Map(rows.map((r) => [r.channel, r.enabled]));
    const CHANNELS = ['PUSH', 'EMAIL', 'TELEGRAM', 'IN_APP', 'SMS'] as const;
    return CHANNELS.map((channel) => ({ channel, enabled: byChannel.get(channel as any) ?? true }));
  }

  async setPreference(userId: string, channel: string, enabled: boolean) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_channel: { userId, channel: channel as any } },
      create: { userId, channel: channel as any, enabled },
      update: { enabled },
    });
  }

  async setDigestFrequency(userId: string, frequency: 'NONE' | 'DAILY' | 'WEEKLY') {
    return this.prisma.user.update({
      where: { id: userId },
      data: { digestFrequency: frequency as any },
    });
  }
}
