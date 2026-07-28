import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferralsService } from '../referrals.service';
import { Prisma } from '@prisma/client';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let prisma: any;
  let ledgerService: { applyTransaction: jest.Mock };
  let walletService: { getSystemWalletId: jest.Mock };

  beforeEach(() => {
    prisma = {
      referralCode: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      referralUse: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      commissionRule: {
        findUnique: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
      },
      ledgerEntry: {
        findMany: jest.fn(),
      },
    };

    ledgerService = {
      applyTransaction: jest.fn().mockResolvedValue({ id: 'reward-tx-123' }),
    };

    walletService = {
      getSystemWalletId: jest.fn().mockResolvedValue('system-wallet-id'),
    };

    service = new ReferralsService(prisma, ledgerService as any, walletService as any);
  });

  describe('redeem', () => {
    it('бросает NotFoundException, если реферальный код не найден', async () => {
      prisma.referralCode.findUnique.mockResolvedValue(null);

      await expect(service.redeem('user-1', 'INVALID_CODE')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.referralCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'INVALID_CODE' },
      });
    });

    it('бросает BadRequestException, если пользователь активирует свой же код', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        ownerId: 'user-1',
        code: 'MYCODE12',
      });

      await expect(service.redeem('user-1', 'MYCODE12')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('бросает BadRequestException, если у пользователя уже есть ReferralUse (повторная активация)', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        ownerId: 'owner-user',
        code: 'FRIEND12',
      });
      prisma.referralUse.findUnique.mockResolvedValue({
        id: 'use-1',
        referredUserId: 'user-1',
      });

      await expect(service.redeem('user-1', 'FRIEND12')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('успешно создаёт ReferralUse для нового пользователя', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        ownerId: 'owner-user',
        code: 'FRIEND12',
      });
      prisma.referralUse.findUnique.mockResolvedValue(null);
      prisma.referralUse.create.mockResolvedValue({
        id: 'use-new',
        referralCodeId: 'code-1',
        referredUserId: 'user-1',
      });

      const res = await service.redeem('user-1', 'friend12');

      expect(res).toEqual({ success: true, referralUseId: 'use-new' });
      expect(prisma.referralUse.create).toHaveBeenCalledWith({
        data: {
          referralCodeId: 'code-1',
          referredUserId: 'user-1',
        },
      });
    });
  });

  describe('processReferralReward', () => {
    it('ничего не делает, если плательщика нет в ReferralUse', async () => {
      prisma.referralUse.findUnique.mockResolvedValue(null);

      await service.processReferralReward('payer-1', 100);

      expect(ledgerService.applyTransaction).not.toHaveBeenCalled();
    });

    it('ничего не делает повторно, если rewardLedgerTxId уже не null (идемпотентность)', async () => {
      prisma.referralUse.findUnique.mockResolvedValue({
        id: 'use-1',
        referredUserId: 'payer-1',
        rewardLedgerTxId: 'already-paid-tx-id',
        referralCode: { ownerId: 'owner-1' },
      });

      await service.processReferralReward('payer-1', 100);

      expect(ledgerService.applyTransaction).not.toHaveBeenCalled();
    });

    it('считает вознаграждение по дефолтному % (5%) и проводит сбалансированную транзакцию DEBIT system / CREDIT referrer', async () => {
      prisma.referralUse.findUnique.mockResolvedValue({
        id: 'use-1',
        referredUserId: 'payer-1',
        rewardLedgerTxId: null,
        referralCode: { ownerId: 'owner-1' },
      });
      prisma.commissionRule.findUnique.mockResolvedValue(null); // берётся 5% дефолт
      prisma.wallet.findUnique.mockResolvedValue({ id: 'referrer-wallet-id' });

      await service.processReferralReward('payer-1', 200);

      expect(walletService.getSystemWalletId).toHaveBeenCalled();
      expect(ledgerService.applyTransaction).toHaveBeenCalledWith({
        type: 'REFERRAL',
        referenceType: 'REFERRAL_USE',
        referenceId: 'use-1',
        description: 'Referral reward (5%) for referred user payer-1',
        entries: [
          {
            walletId: 'system-wallet-id',
            balanceType: 'MAIN',
            direction: 'DEBIT',
            amount: 10, // 5% от 200
          },
          {
            walletId: 'referrer-wallet-id',
            balanceType: 'MAIN',
            direction: 'CREDIT',
            amount: 10,
          },
        ],
      });

      expect(prisma.referralUse.update).toHaveBeenCalledWith({
        where: { id: 'use-1' },
        data: { rewardLedgerTxId: 'reward-tx-123' },
      });
    });

    it('использует % из CommissionRule, если правило есть в БД', async () => {
      prisma.referralUse.findUnique.mockResolvedValue({
        id: 'use-1',
        referredUserId: 'payer-1',
        rewardLedgerTxId: null,
        referralCode: { ownerId: 'owner-1' },
      });
      prisma.commissionRule.findUnique.mockResolvedValue({
        active: true,
        percentage: new Prisma.Decimal(10),
      });
      prisma.wallet.findUnique.mockResolvedValue({ id: 'referrer-wallet-id' });

      await service.processReferralReward('payer-1', 150);

      expect(ledgerService.applyTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [
            {
              walletId: 'system-wallet-id',
              balanceType: 'MAIN',
              direction: 'DEBIT',
              amount: 15, // 10% от 150
            },
            {
              walletId: 'referrer-wallet-id',
              balanceType: 'MAIN',
              direction: 'CREDIT',
              amount: 15,
            },
          ],
        }),
      );
    });
  });

  describe('getMyReferralInfo', () => {
    it('генерирует код при первом вызове, если код ещё не создан', async () => {
      prisma.referralCode.findUnique.mockResolvedValue(null);
      prisma.referralCode.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'new-code-id', ownerId: data.ownerId, code: data.code }),
      );
      prisma.referralUse.findMany.mockResolvedValue([]);

      const info = await service.getMyReferralInfo('user-1');

      expect(prisma.referralCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerId: 'user-1' }),
        }),
      );
      expect(info.code).toBeDefined();
      expect(info.totalReferred).toBe(0);
      expect(info.totalEarned).toBe('0.00');
    });

    it('переиспользует существующий код при повторном вызове', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({
        id: 'existing-code-id',
        ownerId: 'user-1',
        code: 'EXIST123',
      });
      prisma.referralUse.findMany.mockResolvedValue([]);

      const info = await service.getMyReferralInfo('user-1');

      expect(prisma.referralCode.create).not.toHaveBeenCalled();
      expect(info.code).toBe('EXIST123');
    });
  });
});
