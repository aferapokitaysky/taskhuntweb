import { NotificationsService } from '../notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      notificationPreference: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const gateway = { emitToUser: jest.fn() } as any;
    service = new NotificationsService(prisma, gateway);
  });

  describe('getPreferences', () => {
    it('возвращает все 5 каналов со статусом true по умолчанию для пользователя без явных настроек', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);

      const res = await service.getPreferences('user-1');

      expect(res).toHaveLength(5);
      expect(res).toEqual([
        { channel: 'PUSH', enabled: true },
        { channel: 'EMAIL', enabled: true },
        { channel: 'TELEGRAM', enabled: true },
        { channel: 'IN_APP', enabled: true },
        { channel: 'SMS', enabled: true },
      ]);
    });

    it('учитывает сохранённые настройки пользователя', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([
        { channel: 'EMAIL', enabled: false },
      ]);

      const res = await service.getPreferences('user-1');

      const emailPref = res.find((p) => p.channel === 'EMAIL');
      const pushPref = res.find((p) => p.channel === 'PUSH');

      expect(emailPref?.enabled).toBe(false);
      expect(pushPref?.enabled).toBe(true);
    });
  });

  describe('setPreference', () => {
    it('выполняет upsert для выбранного канала', async () => {
      prisma.notificationPreference.upsert.mockResolvedValue({
        userId: 'user-1',
        channel: 'EMAIL',
        enabled: false,
      });

      const res = await service.setPreference('user-1', 'EMAIL', false);

      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId_channel: { userId: 'user-1', channel: 'EMAIL' } },
        create: { userId: 'user-1', channel: 'EMAIL', enabled: false },
        update: { enabled: false },
      });
      expect(res.enabled).toBe(false);
    });
  });
});
