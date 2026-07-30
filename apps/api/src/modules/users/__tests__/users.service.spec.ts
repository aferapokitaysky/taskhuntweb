import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';

function fakeFile(buffer: Buffer, overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    buffer,
    size: buffer.length,
    mimetype: 'image/png',
    originalname: 'avatar.png',
    fieldname: 'avatar',
    encoding: '7bit',
    ...overrides,
  } as Express.Multer.File;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

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
      profile: {
        update: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      portfolioItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      savedFreelancer: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
    matching = {};

    service = new UsersService(prisma, matching);
  });

  describe('uploadAvatar', () => {
    it('бросает BadRequestException если файл не передан', async () => {
      await expect(service.uploadAvatar('user-1', undefined)).rejects.toThrow(BadRequestException);
    });

    it('бросает BadRequestException для файла, замаскированного под изображение (несовпадающие magic bytes)', async () => {
      const fakeImage = fakeFile(Buffer.from('<script>alert(1)</script>'));
      await expect(service.uploadAvatar('user-1', fakeImage)).rejects.toThrow(BadRequestException);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('бросает BadRequestException для файла больше 2MB', async () => {
      const bigFile = fakeFile(PNG_MAGIC, { size: 3 * 1024 * 1024 });
      await expect(service.uploadAvatar('user-1', bigFile)).rejects.toThrow(BadRequestException);
    });

    it('сохраняет валидный PNG и возвращает стабильный avatarUrl', async () => {
      prisma.profile.update.mockResolvedValue({ avatarUrl: '/users/user-1/avatar' });

      const result = await service.uploadAvatar('user-1', fakeFile(PNG_MAGIC));

      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { avatarData: PNG_MAGIC, avatarMimeType: 'image/png', avatarUrl: '/users/user-1/avatar' },
      });
      expect(result).toEqual({ avatarUrl: '/users/user-1/avatar' });
    });
  });

  describe('getAvatar', () => {
    it('бросает NotFoundException если у профиля нет аватара', async () => {
      prisma.profile.findUnique.mockResolvedValue({ avatarData: null, avatarMimeType: null });
      await expect(service.getAvatar('user-1')).rejects.toThrow(NotFoundException);
    });

    it('возвращает байты и mime-type сохранённого аватара', async () => {
      prisma.profile.findUnique.mockResolvedValue({ avatarData: PNG_MAGIC, avatarMimeType: 'image/png' });
      const result = await service.getAvatar('user-1');
      expect(result).toEqual({ data: PNG_MAGIC, mimeType: 'image/png' });
    });
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
        roles: ['CLIENT'],
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
        roles: ['CLIENT'],
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

  describe('addPortfolioItem', () => {
    it('добавляет работу в портфолио фрилансера', async () => {
      prisma.profile.findUnique.mockResolvedValue({ id: 'prof-1', userId: 'user-1' });
      prisma.portfolioItem.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'item-1', ...data }),
      );

      const item = await service.addPortfolioItem('user-1', {
        title: 'E-commerce App',
        tags: ['Next.js', 'Stripe'],
      });

      expect(item.title).toBe('E-commerce App');
      expect(item.tags).toEqual(['Next.js', 'Stripe']);
    });
  });

  describe('deletePortfolioItem', () => {
    it('бросает NotFoundException если работа не принадлежит пользователю', async () => {
      prisma.portfolioItem.findFirst.mockResolvedValue(null);

      await expect(service.deletePortfolioItem('user-1', 'item-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordProfileView', () => {
    it('инкрементирует viewsCount если просмотрщик не является владельцем профиля', async () => {
      prisma.profile.findUnique.mockResolvedValue({ id: 'prof-1', userId: 'user-target' });

      await service.recordProfileView('user-target', 'user-viewer');

      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 'prof-1' },
        data: { viewsCount: { increment: 1 } },
      });
    });

    it('не инкрементирует viewsCount при просмотре собственного профиля', async () => {
      await service.recordProfileView('user-self', 'user-self');

      expect(prisma.profile.update).not.toHaveBeenCalled();
    });
  });

  describe('saveFreelancer / unsaveFreelancer', () => {
    it('бросает BadRequestException при попытке сохранить пользователя без роли FREELANCER', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-client', roles: ['CLIENT'] });

      await expect(service.saveFreelancer('user-1', 'user-client')).rejects.toThrow(BadRequestException);
    });

    it('идемпотентно сохраняет фрилансера через upsert', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-free', roles: ['FREELANCER'] });
      prisma.savedFreelancer.upsert.mockResolvedValue({ id: 'saved-1', userId: 'user-1', freelancerId: 'user-free' });

      const res = await service.saveFreelancer('user-1', 'user-free');

      expect(prisma.savedFreelancer.upsert).toHaveBeenCalledWith({
        where: { userId_freelancerId: { userId: 'user-1', freelancerId: 'user-free' } },
        create: { userId: 'user-1', freelancerId: 'user-free' },
        update: {},
      });
      expect(res.id).toBe('saved-1');
    });

    it('удаляет запись из избранного через deleteMany без ошибки при повторном вызове', async () => {
      prisma.savedFreelancer.deleteMany.mockResolvedValue({ count: 0 });

      const res = await service.unsaveFreelancer('user-1', 'user-free');

      expect(prisma.savedFreelancer.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', freelancerId: 'user-free' },
      });
      expect(res).toEqual({ success: true });
    });
  });

  describe('Round 13: Freelancer metrics calculation', () => {
    it('правильно рассчитывает successRate и completionRate', async () => {
      prisma.bid = {
        findMany: jest.fn().mockResolvedValue([
          { status: 'ACCEPTED', order: { status: 'COMPLETED', disputes: [] } },
          { status: 'ACCEPTED', order: { status: 'COMPLETED', disputes: [{ id: 'disp-1' }] } },
        ]),
      };
      prisma.profile.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      await service.recalculateSuccessMetrics('freelancer-1');

      expect(prisma.profile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'freelancer-1' },
        data: {
          successRate: 100,
          completionRate: 50,
        },
      });
    });

    it('рассчитывает avgResponseMins по последним бидам', async () => {
      const now = new Date();
      const orderDate1 = new Date(now.getTime() - 60 * 60 * 1000); // 60 min ago
      const orderDate2 = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

      prisma.bid = {
        findMany: jest.fn().mockResolvedValue([
          { createdAt: now, order: { createdAt: orderDate1 } }, // 60 mins
          { createdAt: now, order: { createdAt: orderDate2 } }, // 30 mins
        ]),
      };
      prisma.profile.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      await service.recalculateAvgResponseTime('freelancer-1');

      expect(prisma.profile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'freelancer-1' },
        data: { avgResponseMins: 45 },
      });
    });
  });
});
