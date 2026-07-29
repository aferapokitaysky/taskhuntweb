import { ConflictException, NotFoundException } from '@nestjs/common';
import { PayoutAddressesService } from '../payout-addresses.service';

describe('PayoutAddressesService', () => {
  let service: PayoutAddressesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      savedPayoutAddress: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    service = new PayoutAddressesService(prisma);
  });

  describe('create', () => {
    it('сохраняет первый адрес с isDefault: true', async () => {
      prisma.savedPayoutAddress.findUnique.mockResolvedValue(null);
      prisma.savedPayoutAddress.count.mockResolvedValue(0);
      prisma.savedPayoutAddress.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'addr-1', ...data }),
      );

      const res = await service.create('user-1', {
        label: 'My Wallet',
        network: 'TRC20',
        address: 'T123456789',
      });

      expect(res.isDefault).toBe(true);
      expect(prisma.savedPayoutAddress.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          label: 'My Wallet',
          network: 'TRC20',
          address: 'T123456789',
          isDefault: true,
        },
      });
    });

    it('бросает ConflictException при попытке сохранить дубликат адреса', async () => {
      prisma.savedPayoutAddress.findUnique.mockResolvedValue({ id: 'existing-addr' });

      await expect(
        service.create('user-1', {
          label: 'My Wallet',
          network: 'TRC20',
          address: 'T123456789',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('бросает NotFoundException если адрес не принадлежит пользователю', async () => {
      prisma.savedPayoutAddress.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'addr-999', { label: 'New Label' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('при смене isDefault: true сбрасывает isDefault у остальных адресов в транзакции', async () => {
      prisma.savedPayoutAddress.findFirst.mockResolvedValue({ id: 'addr-2', userId: 'user-1' });
      prisma.savedPayoutAddress.update.mockResolvedValue({ id: 'addr-2', isDefault: true });

      const res = await service.update('user-1', 'addr-2', { isDefault: true });

      expect(prisma.savedPayoutAddress.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isDefault: false },
      });
      expect(res.isDefault).toBe(true);
    });
  });

  describe('delete', () => {
    it('при удалении дефолтного адреса делает дефолтным следующий доступный адрес', async () => {
      prisma.savedPayoutAddress.findFirst
        .mockResolvedValueOnce({ id: 'addr-1', userId: 'user-1', isDefault: true })
        .mockResolvedValueOnce({ id: 'addr-2', userId: 'user-1', isDefault: false });

      await service.delete('user-1', 'addr-1');

      expect(prisma.savedPayoutAddress.delete).toHaveBeenCalledWith({ where: { id: 'addr-1' } });
      expect(prisma.savedPayoutAddress.update).toHaveBeenCalledWith({
        where: { id: 'addr-2' },
        data: { isDefault: true },
      });
    });
  });
});
