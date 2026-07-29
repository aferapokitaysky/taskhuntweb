import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let matching: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      subscription: {
        findFirst: jest.fn(),
      },
    };
    matching = {};

    service = new UsersService(prisma, matching);
  });

  describe('getMe', () => {
    it('бросает NotFoundException если пользователь не найден', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('user-999')).rejects.toThrow(NotFoundException);
    });

    it('рассчитывает profileCompleteness и missingSteps для пользователя со слабым профилем', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: 'PENDING',
        profile: null,
      });

      const res = await service.getMe('user-1');

      expect(res.profileCompleteness).toBe(0);
      expect(res.missingSteps).toHaveLength(7);
      expect(res.missingSteps[0]).toEqual({ label: 'Пройдите верификацию Email', points: 20 });
    });

    it('рассчитывает profileCompleteness = 100 для полностью заполненного профиля c PRO подпиской', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        profile: {
          avatarUrl: 'https://example.com/avatar.jpg',
          bio: 'Fullstack Dev',
          skills: [{ skill: { name: 'Node.js' } }],
          githubUrl: 'https://github.com/user',
          country: 'Germany',
          city: 'Berlin',
        },
        subscription: {
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 86400000),
          tier: { name: 'PRO' },
        },
      });

      const res = await service.getMe('user-1');

      expect(res.profileCompleteness).toBe(100);
      expect(res.missingSteps).toHaveLength(0);
    });
  });
});
