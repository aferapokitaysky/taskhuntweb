import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async blockFreelancer(clientId: string, freelancerId: string) {
    if (clientId === freelancerId) {
      throw new BadRequestException('Cannot block yourself');
    }
    const freelancer = await this.prisma.user.findUnique({ where: { id: freelancerId } });
    if (!freelancer) throw new NotFoundException('Freelancer not found');

    return this.prisma.clientBlock.upsert({
      where: { clientId_freelancerId: { clientId, freelancerId } },
      create: { clientId, freelancerId },
      update: {},
    });
  }

  async unblockFreelancer(clientId: string, freelancerId: string) {
    await this.prisma.clientBlock.deleteMany({
      where: { clientId, freelancerId },
    });
    return { success: true };
  }

  async listBlockedFreelancers(clientId: string) {
    const blocks = await this.prisma.clientBlock.findMany({
      where: { clientId },
      include: {
        freelancer: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return blocks.map((b) => ({
      blockId: b.id,
      createdAt: b.createdAt,
      freelancer: b.freelancer,
    }));
  }
}
