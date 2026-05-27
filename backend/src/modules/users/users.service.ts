import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getUsersByTenant(tenantId: string) {
    return this.prisma.user.findMany({ where: { tenantId } });
  }

  async createUser(data: any) {
    return this.prisma.user.create({ data });
  }

  async updateUser(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
