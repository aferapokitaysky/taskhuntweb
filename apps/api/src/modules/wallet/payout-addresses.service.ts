import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePayoutAddressDto } from './dto/create-payout-address.dto';
import { UpdatePayoutAddressDto } from './dto/update-payout-address.dto';

@Injectable()
export class PayoutAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.savedPayoutAddress.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { lastUsedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(userId: string, dto: CreatePayoutAddressDto) {
    const existing = await this.prisma.savedPayoutAddress.findUnique({
      where: {
        userId_network_address: {
          userId,
          network: dto.network,
          address: dto.address,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Такой адрес уже сохранён');
    }

    const count = await this.prisma.savedPayoutAddress.count({ where: { userId } });
    const isDefault = count === 0;

    return this.prisma.savedPayoutAddress.create({
      data: {
        userId,
        label: dto.label,
        network: dto.network,
        address: dto.address,
        isDefault,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdatePayoutAddressDto) {
    const item = await this.prisma.savedPayoutAddress.findFirst({ where: { id, userId } });
    if (!item) {
      throw new NotFoundException('Address not found');
    }

    if (dto.isDefault === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.savedPayoutAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
        return tx.savedPayoutAddress.update({
          where: { id },
          data: {
            label: dto.label,
            isDefault: true,
          },
        });
      });
    }

    return this.prisma.savedPayoutAddress.update({
      where: { id },
      data: dto,
    });
  }

  async delete(userId: string, id: string) {
    const item = await this.prisma.savedPayoutAddress.findFirst({ where: { id, userId } });
    if (!item) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.savedPayoutAddress.delete({ where: { id } });

    if (item.isDefault) {
      const nextAddress = await this.prisma.savedPayoutAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (nextAddress) {
        await this.prisma.savedPayoutAddress.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { success: true };
  }
}
