import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { BoardingPointsService } from './boarding-points.service';

import { CreateBoardingPointDto } from './dto/create-boarding-point.dto';
import { UpdateBoardingPointDto } from './dto/update-boarding-point.dto';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('boarding-points')
export class BoardingPointsController {
  constructor(
    private readonly boardingPointsService: BoardingPointsService,
  ) {}

  /**
   * Criar ponto de embarque.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Post()
  create(
    @Body() dto: CreateBoardingPointDto,
  ) {
    return this.boardingPointsService.create(dto);
  }

  /**
   * Listar pontos de uma rota.
   */
  @Get('route/:routeId')
  findByRoute(
    @Param('routeId') routeId: string,
  ) {
    return this.boardingPointsService.findByRoute(
      routeId,
    );
  }

  /**
   * Atualizar ponto.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBoardingPointDto,
  ) {
    return this.boardingPointsService.update(
      id,
      dto,
    );
  }

  /**
   * Desativar ponto.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id/remove')
  remove(
    @Param('id') id: string,
  ) {
    return this.boardingPointsService.remove(id);
  }
}