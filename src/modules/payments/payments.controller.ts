import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
/**
 * Controller responsável pelas rotas HTTP de pagamentos.
 */
@Roles(Role.ADMIN, Role.SELLER)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Cria um registro inicial de pagamento.
   */
  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  /**
   * Lista todos os pagamentos.
   */
  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  /**
   * Busca pagamento pelo ID.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  /**
   * Lista pagamentos de uma reserva.
   */
  @Get('booking/:bookingId')
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.paymentsService.findByBooking(bookingId);
  }

  /**
   * Confirma pagamento.
   */
  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirm(id, dto);
  }

  /**
   * Cancela pagamento.
   */
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.paymentsService.cancel(id);
  }
}