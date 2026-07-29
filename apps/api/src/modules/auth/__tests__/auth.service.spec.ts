import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';

/**
 * Токены верификации/сброса пароля — единственная линия защиты от
 * захвата чужого email/аккаунта. Проверяем: истёкшие и несуществующие
 * токены отклоняются, а не "почти проходят"; после успешного
 * использования токен инвалидируется (одноразовость).
 */
describe('AuthService — verification & password reset', () => {
  let prisma: any;
  let eventBus: { publish: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(prisma, {} as any, eventBus as any);
  });

  describe('sendVerificationEmail', () => {
    it('сохраняет токен с TTL и публикует EmailVerificationRequested со ссылкой', async () => {
      await service.sendVerificationEmail('user-1', 'a@b.com');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            emailVerificationToken: expect.any(String),
            emailVerificationExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        'EmailVerificationRequested',
        expect.objectContaining({ userId: 'user-1', email: 'a@b.com' }),
      );
    });
  });

  describe('verifyEmail', () => {
    it('отклоняет несуществующий токен', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('отклоняет истёкший токен', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: 'PENDING_VERIFICATION',
        emailVerificationExpiresAt: new Date(Date.now() - 1000), // уже в прошлом
      });
      await expect(service.verifyEmail('expired-token')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('активирует PENDING_VERIFICATION-аккаунт и очищает токен при валидной ссылке', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: 'PENDING_VERIFICATION',
        emailVerificationExpiresAt: new Date(Date.now() + 1000 * 60),
      });

      await service.verifyEmail('valid-token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'ACTIVE', emailVerificationToken: null, emailVerificationExpiresAt: null },
      });
    });

    it('не понижает и не трогает статус, если аккаунт уже не PENDING_VERIFICATION (например SUSPENDED)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: 'SUSPENDED',
        emailVerificationExpiresAt: new Date(Date.now() + 1000 * 60),
      });

      await service.verifyEmail('valid-token');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SUSPENDED' }) }),
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('молча ничего не делает, если email не найден (защита от enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await service.requestPasswordReset('nobody@example.com');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('молча ничего не делает для OAuth-аккаунта без пароля', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash: null });
      await service.requestPasswordReset('a@b.com');
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('генерирует токен и публикует PasswordResetRequested для обычного аккаунта', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash: 'hash' });
      await service.requestPasswordReset('a@b.com');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        'PasswordResetRequested',
        expect.objectContaining({ userId: 'user-1', email: 'a@b.com' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('отклоняет несуществующий или истёкший токен', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('bad-token', 'newpassword123')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('хэширует новый пароль и инвалидирует токен (одноразовость)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordResetExpiresAt: new Date(Date.now() + 1000 * 60),
      });

      await service.resetPassword('valid-token', 'newpassword123');

      const call = prisma.user.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'user-1' });
      expect(call.data.passwordHash).toEqual(expect.any(String));
      expect(call.data.passwordHash).not.toBe('newpassword123'); // точно хэш, не голый пароль
      expect(call.data.passwordResetToken).toBeNull();
      expect(call.data.passwordResetExpiresAt).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('бросает BadRequestException, если у аккаунта нет пароля (вход через OAuth)', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash: null });
      await expect(service.changePassword('user-1', 'whatever', 'newpassword123')).rejects.toThrow(BadRequestException);
    });

    it('бросает BadRequestException при неверном текущем пароле', async () => {
      const realHash = await bcrypt.hash('correct-password', 4);
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash: realHash });

      await expect(service.changePassword('user-1', 'wrong-password', 'newpassword123')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('меняет пароль на новый валидный хэш при верном текущем пароле', async () => {
      const realHash = await bcrypt.hash('correct-password', 4);
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash: realHash });

      const result = await service.changePassword('user-1', 'correct-password', 'brand-new-password');

      expect(result).toEqual({ changed: true });
      const call = prisma.user.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'user-1' });
      // Реально валидный bcrypt-хэш нового пароля, а не заглушка.
      const newHashIsValid = await bcrypt.compare('brand-new-password', call.data.passwordHash);
      expect(newHashIsValid).toBe(true);
    });
  });
});
