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

import { CargoRequestsService } from './cargo-requests.service';
import { CreateCargoRequestDto } from './dto/create-cargo-request.dto';
import { ReviewCargoRequestDto } from './dto/review-cargo-request.dto';

@Controller('cargo-requests')
export class CargoRequestsController {
  constructor(private readonly cargoService: CargoRequestsService) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Envia a foto da carga para o Cloudinary
   * e retorna a URL pública da imagem.
   */
  private async uploadCargoPhotoToCloudinary(
    file: Express.Multer.File,
  ): Promise<string> {
    if (!file?.buffer) {
      throw new InternalServerErrorException('Arquivo de imagem inválido.');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'passagens/cargo',
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            console.log('ERRO CLOUDINARY:', error);

            reject(
              new InternalServerErrorException(
                'Erro ao enviar foto da carga para Cloudinary.',
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
   * Cria pedido de carga.
   *
   * Recebe:
   * - bookingId
   * - cargoDescription
   * - estimatedWeightKg
   * - photo
   *
   * A foto vem no campo "photo".
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateCargoRequestDto,
  ) {
    console.log('==============================');
    console.log('CRIANDO PEDIDO DE CARGA');
    console.log('BODY RECEBIDO:', dto);

    if (file) {
      console.log('ARQUIVO RECEBIDO:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      dto.photoUrl = await this.uploadCargoPhotoToCloudinary(file);

      console.log('URL CLOUDINARY:', dto.photoUrl);
    } else {
      console.log('NENHUM ARQUIVO RECEBIDO NO CAMPO photo');
    }

    console.log('DTO FINAL PARA SALVAR:', dto);
    console.log('==============================');

    return this.cargoService.create(dto);
  }

  /**
   * Lista todos os pedidos de carga.
   */
  @Get()
  findAll() {
    return this.cargoService.findAll();
  }

  /**
   * Lista pedidos pendentes.
   */
  @Get('pending')
  findPending() {
    return this.cargoService.findPending();
  }

  /**
   * Busca pedido de carga por booking.
   *
   * Importante: esta rota precisa vir antes de @Get(':id')
   * para não confundir "booking" com id.
   */
  @Get('booking/:bookingId')
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.cargoService.findByBooking(bookingId);
  }

  /**
   * Busca pedido de carga por ID.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cargoService.findOne(id);
  }

  /**
   * Aprova ou rejeita pedido de carga pela operação/vendedor.
   */
  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewCargoRequestDto) {
    return this.cargoService.review(id, dto);
  }

  /**
   * Passageiro aceita o preço da carga.
   */
  @Patch(':id/passenger-accept')
  passengerAccept(@Param('id') id: string) {
    return this.cargoService.passengerAccept(id);
  }

  /**
   * Passageiro recusa o preço da carga.
   *
   * Neste caso, a carga é cancelada e o valor da carga
   * é removido da reserva.
   */
  @Patch(':id/passenger-reject')
  passengerReject(@Param('id') id: string) {
    return this.cargoService.passengerReject(id);
  }

  /**
   * Cancela pedido de carga.
   */
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.cargoService.cancel(id);
  }
}