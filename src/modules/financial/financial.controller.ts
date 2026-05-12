import { Controller, Get, Query, Request } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Roles(Role.ADMIN, Role.SELLER)
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Roles(Role.ADMIN)
  @Get('summary')
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.getSummary(startDate, endDate);
  }

  @Roles(Role.SELLER)
  @Get('my-summary')
  getMySummary(@Request() req: { user: any }) {
    return this.financialService.getSellerSummary(req.user.id);
  }

  /**
   * Relatório por carro.
   * Apenas admin vê todos os carros.
   */
  @Roles(Role.ADMIN)
  @Get('vehicles-report')
  getVehiclesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.getVehiclesReport(startDate, endDate);
  }
}