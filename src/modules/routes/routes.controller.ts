import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';

import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }

  @Roles(Role.ADMIN, Role.SELLER)
  @Get()
  findAll(
    @Query('search') search: string | undefined,
    @Request() req: { user: any },
  ) {
    return this.routesService.findAll(search, req.user);
  }

  /**
   * Endpoint leve para app passageiro buscar origem/destino.
   * Retorna apenas rotas ativas e poucos campos.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Get('suggestions')
  suggestions(@Query('search') search?: string) {
    return this.routesService.suggestions(search);
  }

  @Roles(Role.ADMIN, Role.SELLER)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: any }) {
    return this.routesService.findOne(id, req.user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.routesService.deactivate(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.routesService.activate(id);
  }
}