import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';

import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ValidateTicketDto } from './dto/validate-ticket.dto';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * Emite um novo bilhete manualmente.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Post('issue')
  issueTicket(@Body() dto: CreateTicketDto) {
    return this.ticketsService.issueTicket(dto);
  }

  /**
   * Lista todos os bilhetes.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  /**
   * Busca bilhete pelo booking.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get('booking/:bookingId')
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.ticketsService.findByBooking(bookingId);
  }

  /**
   * Busca um bilhete pelo ID.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  /**
   * Valida bilhete no embarque pelo código.
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Post('validate')
  validateTicket(@Body() dto: ValidateTicketDto, @Request() req: { user: any }) {
    return this.ticketsService.validateTicket(dto, req.user);
  }

  /**
   * Scanner QR Code do motorista.
   * O app motorista chama:
   * PATCH /tickets/scan
   */
  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Patch('scan')
  scanTicket(
    @Body() dto: { qrCodeValue: string },
    @Request() req: { user: any },
  ) {
    return this.ticketsService.scanTicket(dto.qrCodeValue, req.user);
  }

  /**
   * Cancela um bilhete.
   */
  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.ticketsService.cancel(id);
  }
}