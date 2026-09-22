import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Role, UserStatus } from '../common/roles.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Campos que se pueden devolver al cliente. Nunca incluye password_hash.
const publicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  emailVerifiedAt: true,
  status: true,
  createdAt: true,
  roles: { select: { role: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async create(input: CreateUserInput) {
    const email = this.normalizeEmail(input.email);
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictException('Ya existe una cuenta con ese email');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: UserStatus.ACTIVE,
        roles: { create: { role: Role.USER } },
      },
      select: publicSelect,
    });
    return this.toPublic(user);
  }

  findByEmailWithHash(email: string) {
    return this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      include: { roles: true },
    });
  }

  async findPublicById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicSelect });
    return user ? this.toPublic(user) : null;
  }

  private toPublic<T extends { roles: { role: string }[] }>(user: T) {
    return { ...user, roles: user.roles.map((r) => r.role) };
  }
}
