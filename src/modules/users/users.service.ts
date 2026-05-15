import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { User } from './entities/user.entity';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { UpdateAdminPasswordDto } from './dto/update-admin-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

type CreateUserInput = {
  fullName: string;
  phoneNumber: string;
  password: string;
  email?: string;
  nickname?: string;
  role?: Role;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(data: CreateUserInput): Promise<User> {
    await this.ensurePhoneIsAvailable(data.phoneNumber);

    if (data.email) {
      await this.ensureEmailIsAvailable(data.email);
    }

    const user = this.usersRepository.create({
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      email: data.email ?? null,
      nickname: data.nickname ?? null,
      role: data.role ?? Role.PASSENGER,
      status: UserStatus.ACTIVE,
    });

    user.password = data.password;

    return this.usersRepository.save(user);
  }

  async save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  async createAdmin(dto: CreateAdminDto): Promise<User> {
    await this.ensurePhoneIsAvailable(dto.phoneNumber.trim());

    if (dto.email) {
      await this.ensureEmailIsAvailable(dto.email.trim());
    }

    const admin = this.usersRepository.create({
      fullName: dto.fullName.trim(),
      phoneNumber: dto.phoneNumber.trim(),
      email: dto.email?.trim() || null,
      nickname: dto.nickname?.trim() || null,
      role: Role.ADMIN,
      status: dto.status ?? UserStatus.ACTIVE,
    });

    admin.password = dto.password;

    return this.usersRepository.save(admin);
  }

  async updateAdmin(id: string, dto: UpdateAdminDto): Promise<User> {
    const admin = await this.findById(id);

    if (admin.role !== Role.ADMIN) {
      throw new BadRequestException('Este usuário não é administrador.');
    }

    if (dto.phoneNumber && dto.phoneNumber.trim() !== admin.phoneNumber) {
      await this.ensurePhoneIsAvailable(dto.phoneNumber.trim(), admin.id);
      admin.phoneNumber = dto.phoneNumber.trim();
    }

    if (dto.email !== undefined) {
      const nextEmail = dto.email?.trim() || null;

      if (nextEmail && nextEmail !== admin.email) {
        await this.ensureEmailIsAvailable(nextEmail, admin.id);
      }

      admin.email = nextEmail;
    }

    if (dto.fullName !== undefined) {
      admin.fullName = dto.fullName.trim();
    }

    if (dto.nickname !== undefined) {
      admin.nickname = dto.nickname?.trim() || null;
    }

    if (dto.status !== undefined) {
      admin.status = dto.status;
    }

    return this.usersRepository.save(admin);
  }

  async updateAdminPassword(
    id: string,
    dto: UpdateAdminPasswordDto,
  ): Promise<User> {
    const admin = await this.findById(id);

    if (admin.role !== Role.ADMIN) {
      throw new BadRequestException('Este usuário não é administrador.');
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('As senhas não coincidem.');
    }

    admin.password = dto.password;

    return this.usersRepository.save(admin);
  }

  async updateAdminStatus(
    id: string,
    currentUserId: string,
    dto: UpdateUserStatusDto,
  ): Promise<User> {
    const admin = await this.findById(id);

    if (admin.role !== Role.ADMIN) {
      throw new BadRequestException('Este usuário não é administrador.');
    }

    if (admin.id === currentUserId && dto.status === UserStatus.INACTIVE) {
      throw new BadRequestException(
        'Você não pode desativar o seu próprio usuário administrador.',
      );
    }

    admin.status = dto.status;

    return this.usersRepository.save(admin);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: {
        fullName: 'ASC',
      },
    });
  }

  async findByRole(role: Role): Promise<User[]> {
    return this.usersRepository.find({
      where: {
        role,
      },
      order: {
        fullName: 'ASC',
      },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return user;
  }

  async findByPhoneWithPassword(phoneNumber: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.phoneNumber = :phoneNumber', {
        phoneNumber,
      })
      .getOne();
  }

  async updateOwnProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.findById(userId);

    if (dto.phoneNumber && dto.phoneNumber.trim() !== user.phoneNumber) {
      await this.ensurePhoneIsAvailable(dto.phoneNumber.trim(), user.id);
      user.phoneNumber = dto.phoneNumber.trim();
    }

    if (dto.email !== undefined) {
      const nextEmail = dto.email?.trim() || null;

      if (nextEmail && nextEmail !== user.email) {
        await this.ensureEmailIsAvailable(nextEmail, user.id);
      }

      user.email = nextEmail;
    }

    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName.trim();
    }

    if (dto.nickname !== undefined) {
      user.nickname = dto.nickname?.trim() || null;
    }

    if (dto.profilePhotoUrl !== undefined) {
      user.profilePhotoUrl = dto.profilePhotoUrl;
    }

    if (dto.password) {
      user.password = dto.password;
    }

    return this.usersRepository.save(user);
  }

  /**
   * Salva token Expo Push Notification.
   * Otimizado: só salva se mudou, evitando escrita desnecessária no banco.
   */
  async updateExpoPushToken(
    userId: string,
    expoPushToken?: string,
  ): Promise<User> {
    const user = await this.findById(userId);

    const cleanToken = String(expoPushToken || '').trim();

    if (!cleanToken) {
      throw new BadRequestException('Token de notificação inválido.');
    }

    if (user.expoPushToken === cleanToken) {
      return user;
    }

    user.expoPushToken = cleanToken;

    return this.usersRepository.save(user);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  sanitizeUser(user: User) {
    const { passwordHash, password, ...safeUser } = user as User & {
      passwordHash?: string;
      password?: string;
    };

    return safeUser;
  }

  private async ensurePhoneIsAvailable(
    phoneNumber: string,
    ignoreUserId?: string,
  ): Promise<void> {
    const existingUser = await this.usersRepository.findOne({
      where: ignoreUserId
        ? {
            phoneNumber,
            id: Not(ignoreUserId),
          }
        : { phoneNumber },
    });

    if (existingUser) {
      throw new ConflictException(
        'Já existe um usuário com este número de telefone.',
      );
    }
  }

  private async ensureEmailIsAvailable(
    email: string,
    ignoreUserId?: string,
  ): Promise<void> {
    const existingUser = await this.usersRepository.findOne({
      where: ignoreUserId
        ? {
            email,
            id: Not(ignoreUserId),
          }
        : { email },
    });

    if (existingUser) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }
  }
}