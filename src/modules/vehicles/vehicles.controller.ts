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

  /**
   * Usado pelo app mobile para enviar imagem sem multipart/form-data.
   */
  vehicleImageBase64?: string;
  vehicleImageMimeType?: string;
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

  /**
   * Upload tradicional via multipart/form-data.
   * Continua funcionando para web/navegador.
   */
  private async uploadVehicleImageToCloudinary(
    file: Express.Multer.File,
  ): Promise<string> {
    if (!file?.buffer) {
      throw new InternalServerErrorException('Arquivo de imagem inválido.');
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

  /**
   * Upload via base64.
   * Usado pelo APK Android para evitar erro de multipart/form-data.
   */
  private async uploadVehicleImageBase64ToCloudinary(
    base64: string,
    mimeType = 'image/jpeg',
  ): Promise<string> {
    try {
      if (!base64) {
        throw new InternalServerErrorException('Imagem base64 inválida.');
      }

      const dataUri = `data:${mimeType};base64,${base64}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'passagens/vehicles',
        resource_type: 'image',
      });

      if (!result?.secure_url) {
        throw new InternalServerErrorException(
          'Cloudinary não retornou URL da imagem.',
        );
      }

      return result.secure_url;
    } catch (error) {
      console.log('ERRO UPLOAD BASE64 CLOUDINARY:', error);

      throw new InternalServerErrorException(
        'Erro ao enviar imagem base64 para Cloudinary.',
      );
    }
  }

  /**
   * Trata imagem recebida tanto por multipart quanto por base64.
   */
  private async prepareVehicleImage(
    body: VehicleBody,
    file?: Express.Multer.File,
  ): Promise<void> {
    if (file) {
      body.vehicleImageUrl = await this.uploadVehicleImageToCloudinary(file);
    }

    if (body.vehicleImageBase64) {
      body.vehicleImageUrl = await this.uploadVehicleImageBase64ToCloudinary(
        body.vehicleImageBase64,
        body.vehicleImageMimeType || 'image/jpeg',
      );
    }

    delete body.vehicleImageBase64;
    delete body.vehicleImageMimeType;
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
    await this.prepareVehicleImage(body, file);

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
    await this.prepareVehicleImage(body, file);

    return this.vehiclesService.update(id, body, req.user);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.vehiclesService.deactivate(id);
  }
}