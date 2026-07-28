import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../wallet/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

const DEFAULT_REFERRAL_FEE_PERCENT = 5;

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Активировать реферальный код от другого пользователя
   */
  async redeem(userId: string, code: string) {
    const cleanCode = code.trim().toUpperCase();

    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code: cleanCode },
    });

    if (!referralCode) {
      throw new NotFoundException('Referral code not found');
    }

    if (referralCode.ownerId === userId) {
      throw new BadRequestException('Cannot activate your own referral code');
    }

    const existingUse = await this.prisma.referralUse.findUnique({
      where: { referredUserId: userId },
    });

    if (existingUse) {
      throw new BadRequestException('Already referred');
    }

    const referralUse = await this.prisma.referralUse.create({
      data: {
        referralCodeId: referralCode.id,
        referredUserId: userId,
      },
    });

    return { success: true, referralUseId: referralUse.id };
  }

  /**
   * Получить реферальную информацию текущего пользователя (генерация кода при необходимости)
   */
  async getMyReferralInfo(userId: string) {
    let referralCode = await this.prisma.referralCode.findUnique({
      where: { ownerId: userId },
    });

    if (!referralCode) {
      const generatedCode = this.generateUniqueCode();
      referralCode = await this.prisma.referralCode.create({
        data: {
          ownerId: userId,
          code: generatedCode,
        },
      });
    }

    const uses = await this.prisma.referralUse.findMany({
      where: { referralCodeId: referralCode.id },
      include: {
        referredUser: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rewardTxIds = uses
      .map((u) => u.rewardLedgerTxId)
      .filter((id): id is string => id !== null);

    let totalEarnedDecimal = new Prisma.Decimal(0);

    if (rewardTxIds.length > 0) {
      const entries = await this.prisma.ledgerEntry.findMany({
        where: {
          transactionId: { in: rewardTxIds },
          direction: 'CREDIT',
        },
      });

      for (const entry of entries) {
        totalEarnedDecimal = totalEarnedDecimal.plus(entry.amount);
      }
    }

    const referrals = uses.map((use) => ({
      userId: use.referredUser.id,
      displayName: use.referredUser.profile?.displayName || use.referredUser.email,
      joinedAt: use.createdAt.toISOString(),
      rewardPaid: use.rewardLedgerTxId !== null,
    }));

    return {
      code: referralCode.code,
      totalReferred: uses.length,
      totalEarned: totalEarnedDecimal.toFixed(2),
      referrals,
    };
  }

  /**
   * Начисление реферального вознаграждения при оплате первого инвойса
   */
  async processReferralReward(payerId: string, invoiceAmount: number) {
    const referralUse = await this.prisma.referralUse.findUnique({
      where: { referredUserId: payerId },
      include: {
        referralCode: true,
      },
    });

    if (!referralUse) {
      return; // Заказчик не был кем-либо приведён
    }

    if (referralUse.rewardLedgerTxId !== null) {
      return; // Вознаграждение за этого пользователя уже выдавалось (идемпотентность)
    }

    // Получаем процент комиссии для рефералов
    const rule = await this.prisma.commissionRule.findUnique({
      where: { type: 'REFERRAL_FEE' },
    });

    const feePercent =
      rule && rule.active && rule.percentage != null
        ? Number(rule.percentage)
        : DEFAULT_REFERRAL_FEE_PERCENT;

    const rewardAmount = round2(invoiceAmount * (feePercent / 100));

    if (rewardAmount <= 0) {
      return;
    }

    // Получаем кошелек реферера (владельца реферального кода)
    const referrerWallet = await this.prisma.wallet.findUnique({
      where: { userId: referralUse.referralCode.ownerId },
    });

    if (!referrerWallet) {
      return;
    }

    const systemWalletId = await this.walletService.getSystemWalletId();

    // Зачисляем реферальное вознаграждение через LedgerService
    const transaction = await this.ledgerService.applyTransaction({
      type: 'REFERRAL',
      referenceType: 'REFERRAL_USE',
      referenceId: referralUse.id,
      description: `Referral reward (${feePercent}%) for referred user ${payerId}`,
      entries: [
        {
          walletId: systemWalletId,
          balanceType: 'MAIN',
          direction: 'DEBIT',
          amount: rewardAmount,
        },
        {
          walletId: referrerWallet.id,
          balanceType: 'MAIN',
          direction: 'CREDIT',
          amount: rewardAmount,
        },
      ],
    });

    // Отмечаем, что бонус выдан
    await this.prisma.referralUse.update({
      where: { id: referralUse.id },
      data: { rewardLedgerTxId: transaction.id },
    });
  }

  private generateUniqueCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }
}
