import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Post()
  create(@Body() dto: CreateBookingDto, @Request() req: { user: any }) {
    return this.bookingsService.create(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SELLER)
  @Get()
  findAll(@Request() req: { user: any }) {
    return this.bookingsService.findAll(req.user);
  }

  @Roles(Role.PASSENGER)
  @Get('my')
  findMyBookings(@Request() req: { user: any }) {
    const userId = req.user?.id || req.user?.sub;

    return this.bookingsService.findMyBookings(userId);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Get('trip/:tripId/passengers')
  findPassengersByTrip(
    @Param('tripId') tripId: string,
    @Request() req: { user: any },
  ) {
    return this.bookingsService.findPassengersByTrip(tripId, req.user);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER, Role.DRIVER)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: any }) {
    return this.bookingsService.findOne(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @Request() req: { user: any },
  ) {
    return this.bookingsService.update(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Patch(':id/pay')
  confirmPayment(@Param('id') id: string, @Request() req: { user: any }) {
    return this.bookingsService.confirm(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SELLER)
  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @Request() req: { user: any }) {
    return this.bookingsService.confirm(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Patch(':id/confirm-boarding')
  confirmBoarding(@Param('id') id: string, @Request() req: { user: any }) {
    return this.bookingsService.confirmBoarding(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.DRIVER)
  @Patch(':id/confirm-arrival')
  confirmArrival(@Param('id') id: string, @Request() req: { user: any }) {
    return this.bookingsService.confirmArrival(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SELLER, Role.PASSENGER)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req: { user: any }) {
    return this.bookingsService.cancel(id, req.user);
  }
}