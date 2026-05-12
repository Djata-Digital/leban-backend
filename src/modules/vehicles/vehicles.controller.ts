import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

type VehicleBody = Partial<Vehicle> & {
  routeId?: string;
  driverId?: string;
};

@Roles(Role.ADMIN, Role.SELLER)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  private async uploadVehicleImageToCloudinary(
    file: Express.Multer.File,
  ): Promise<string> {
    if (!file?.buffer) {
      throw new InternalServerErrorException(
        'Arquivo de imagem inválido.',
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'passagens/vehicles',
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                'Erro ao enviar imagem para Cloudinary.',
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

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: VehicleBody,
    @Request() req: { user: any },
  ) {
    if (file) {
      body.vehicleImageUrl =
        await this.uploadVehicleImageToCloudinary(file);
    }

    return this.vehiclesService.create(body, req.user);
  }

  @Get()
  findAll(@Request() req: { user: any }) {
    return this.vehiclesService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: VehicleBody,
    @Request() req: { user: any },
  ) {
    if (file) {
      body.vehicleImageUrl =
        await this.uploadVehicleImageToCloudinary(file);
    }

    return this.vehiclesService.update(id, body, req.user);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.vehiclesService.deactivate(id);
  }
}