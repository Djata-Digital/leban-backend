import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
} from '@nestjs/common';

import { SellerRoutesService } from './seller-routes.service';
import { AssignSellerRouteDto } from './dto/assign-seller-route.dto';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/**
 * Controller responsável por atribuir
 * rotas + tipos de veículos aos vendedores.
 *
 * Exemplo:
 * seller X pode vender:
 * - Bissau → Bafatá → small_car
 * - Bissau → Bafatá → bus
 */
@Controller('seller-routes')
export class SellerRoutesController {
  constructor(
    private readonly sellerRoutesService: SellerRoutesService,
  ) {}

  /**
   * Admin atribui rota + tipo de veículo ao seller.
   *
   * Body:
   * {
   *   sellerId,
   *   routeId,
   *   vehicleType
   * }
   */
  @Roles(Role.ADMIN)
  @Post()
  assign(@Body() dto: AssignSellerRouteDto) {
    return this.sellerRoutesService.assign(dto);
  }

  /**
   * Admin lista todas atribuições.
   */
  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.sellerRoutesService.findAll();
  }

  /**
   * Seller logado visualiza apenas
   * suas próprias rotas atribuídas.
   */
  @Roles(Role.SELLER)
  @Get('my-routes')
  findMyRoutes(@Request() req: { user: any }) {
    return this.sellerRoutesService.findMyRoutes(req.user);
  }

  /**
   * Admin consulta rotas de um seller específico.
   */
  @Roles(Role.ADMIN)
  @Get('seller/:sellerId')
  findBySeller(@Param('sellerId') sellerId: string) {
    return this.sellerRoutesService.findBySeller(sellerId);
  }

  /**
   * Admin remove vínculo seller-rota.
   */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sellerRoutesService.remove(id);
  }
}