import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

// DTOs novos que vamos criar
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { UpdateAdminPasswordDto } from './dto/update-admin-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  private async uploadProfilePhotoToCloudinary(
    file: Express.Multer.File,
  ): Promise<string> {
    if (!file?.buffer) {
      throw new InternalServerErrorException('Arquivo de imagem inválido.');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'passagens/users/profile',
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                'Erro ao enviar foto para Cloudinary.',
              ),
            );
            return;
          }

          resolve(result.secure_url);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  // ======================================================
  // USUÁRIOS GERAIS
  // ======================================================

  @Roles(Role.ADMIN, Role.SELLER)
  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((user) => this.usersService.sanitizeUser(user));
  }

  @Roles(Role.ADMIN, Role.SELLER)
  @Get('drivers')
  async findDrivers() {
    const users = await this.usersService.findByRole(Role.DRIVER);
    return users.map((user) => this.usersService.sanitizeUser(user));
  }

  // ======================================================
  // ADMINISTRADORES
  // ======================================================

  @Roles(Role.ADMIN)
  @Post('admins')
  async createAdmin(@Body() dto: CreateAdminDto) {
    const admin = await this.usersService.createAdmin(dto);
    return this.usersService.sanitizeUser(admin);
  }

  @Roles(Role.ADMIN)
  @Get('admins')
  async findAdmins() {
    const admins = await this.usersService.findByRole(Role.ADMIN);
    return admins.map((admin) => this.usersService.sanitizeUser(admin));
  }

  @Roles(Role.ADMIN)
  @Patch('admins/:id')
  async updateAdmin(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    const admin = await this.usersService.updateAdmin(id, dto);
    return this.usersService.sanitizeUser(admin);
  }

  @Roles(Role.ADMIN)
  @Patch('admins/:id/password')
  async updateAdminPassword(
    @Param('id') id: string,
    @Body() dto: UpdateAdminPasswordDto,
  ) {
    const admin = await this.usersService.updateAdminPassword(id, dto);
    return this.usersService.sanitizeUser(admin);
  }

  @Roles(Role.ADMIN)
  @Patch('admins/:id/status')
  async updateAdminStatus(
    @Param('id') id: string,
    @CurrentUser('sub') currentUserId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const admin = await this.usersService.updateAdminStatus(
      id,
      currentUserId,
      dto,
    );

    return this.usersService.sanitizeUser(admin);
  }

  // ======================================================
  // PERFIL DO USUÁRIO LOGADO
  // ======================================================

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get('me')
  async getMe(@CurrentUser('sub') userId: string) {
    const user = await this.usersService.findById(userId);
    return this.usersService.sanitizeUser(user);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Patch('me')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async updateMe(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateProfileDto,
  ) {
    if (file) {
      dto.profilePhotoUrl = await this.uploadProfilePhotoToCloudinary(file);
    }

    const updatedUser = await this.usersService.updateOwnProfile(userId, dto);

    return this.usersService.sanitizeUser(updatedUser);
  }
}