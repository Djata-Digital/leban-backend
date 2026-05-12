import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from './entities/booking.entity';

import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

import { Trip, TripStatus } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { SellerRoute } from '../seller-routes/entities/seller-route.entity';

import {
  CargoRequest,
  CargoRequestStatus,
} from '../cargo-requests/entities/cargo-request.entity';

import { BoardingPoint } from '../boarding-points/entities/boarding-point.entity';

import { Role } from '../../common/enums/role.enum';

import {
  SeatReservation,
  SeatReservationStatus,
} from '../seat-reservations/entities/seat-reservation.entity';

import { TicketsService } from '../tickets/tickets.service';
import { NotificationsService } from '../notifications/notifications.service';

type CurrentUser = {
  id?: string;
  sub?: string;
  role: Role | string;
};

@Injectable()
export class BookingsService {
  private readonly SYSTEM_FEE_PER_SEAT = 100;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,

    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(SeatReservation)
    private readonly seatReservationsRepository: Repository<SeatReservation>,

    @InjectRepository(SellerRoute)
    private readonly sellerRoutesRepository: Repository<SellerRoute>,

    @InjectRepository(CargoRequest)
    private readonly cargoRequestsRepository: Repository<CargoRequest>,

    @InjectRepository(BoardingPoint)
    private readonly boardingPointsRepository: Repository<BoardingPoint>,

    private readonly ticketsService: TicketsService,

    private readonly notificationsService: NotificationsService,
  ) {}

  private getUserId(user?: CurrentUser): string | undefined {
    return user?.id || user?.sub;
  }

  private isAdmin(user?: CurrentUser): boolean {
    return user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;
  }

  private isSeller(user?: CurrentUser): boolean {
    return user?.role === Role.SELLER || String(user?.role) === 'seller';
  }

  private isDriver(user?: CurrentUser): boolean {
    return user?.role === Role.DRIVER || String(user?.role) === 'driver';
  }

  private isPassenger(user?: CurrentUser): boolean {
    return user?.role === Role.PASSENGER || String(user?.role) === 'passenger';
  }

  private async sellerHasAccessToBooking(
    booking: Booking,
    sellerId: string,
  ): Promise<boolean> {
    if (booking.seller?.id === sellerId) {
      return true;
    }

    const routeId = booking.trip?.route?.id;
    const vehicleType = booking.trip?.vehicle?.vehicleType;

    if (!routeId || !vehicleType) {
      return false;
    }

    const sellerRoute = await this.sellerRoutesRepository.findOne({
      where: {
        seller: {
          id: sellerId,
        },
        route: {
          id: routeId,
        },
        vehicleType,
      },
    });

    return !!sellerRoute;
  }

  private recalculateBookingTotal(booking: Booking): void {
    booking.totalAmount =
      Number(booking.subtotalAmount || 0) +
      Number(booking.systemFeeAmount || 0) +
      Number(booking.cargoAmount || 0) -
      Number(booking.discountAmount || 0);
  }

  private async findAndValidateBoardingPoint(
    pointId: string,
    trip: Trip,
    fieldLabel: string,
  ): Promise<BoardingPoint> {
    const point = await this.boardingPointsRepository.findOne({
      where: {
        id: pointId,
      },
      relations: {
        route: true,
      },
    });

    if (!point) {
      throw new NotFoundException(`${fieldLabel} não encontrado.`);
    }

    if (!point.active) {
      throw new BadRequestException(`${fieldLabel} está desativado.`);
    }

    if (point.route?.id !== trip.route?.id) {
      throw new BadRequestException(
        `${fieldLabel} não pertence à rota da viagem.`,
      );
    }

    return point;
  }

  async create(
    dto: CreateBookingDto,
    currentUser?: CurrentUser,
  ): Promise<Booking> {
    const trip = await this.tripsRepository.findOne({
      where: { id: dto.tripId },
      relations: {
        route: true,
        vehicle: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    if (
      trip.status !== TripStatus.SCHEDULED &&
      trip.status !== TripStatus.BOARDING
    ) {
      throw new BadRequestException('Viagem não disponível.');
    }

    if (trip.availableSeatsCount < dto.seatQuantity) {
      throw new BadRequestException('Sem assentos disponíveis.');
    }

    const buyer = await this.usersRepository.findOne({
      where: { id: dto.buyerId },
    });

    if (!buyer) {
      throw new NotFoundException('Comprador não encontrado.');
    }

    let seller: User | null = null;

    if (this.isSeller(currentUser)) {
      const sellerId = this.getUserId(currentUser);

      if (!sellerId) {
        throw new BadRequestException('Usuário vendedor inválido.');
      }

      seller = await this.usersRepository.findOne({
        where: { id: sellerId },
      });
    }

    const boardingPoint = await this.findAndValidateBoardingPoint(
      dto.boardingPointId,
      trip,
      'Ponto de embarque',
    );

    let dropoffPoint: BoardingPoint | null = null;

    if (dto.dropoffPointId) {
      dropoffPoint = await this.findAndValidateBoardingPoint(
        dto.dropoffPointId,
        trip,
        'Ponto de desembarque',
      );
    }

    const seatQuantity = Number(dto.seatQuantity);
    const baseFare = Number(trip.baseFare);

    const ticketAmount = baseFare * seatQuantity;
    const systemFeeAmount = this.SYSTEM_FEE_PER_SEAT * seatQuantity;
    const grossAmount = ticketAmount + systemFeeAmount;

    const sellerCommissionAmount =
      Number(trip.vehicle?.sellerCommissionAmount || 0) * seatQuantity;

    const ownerAmount = ticketAmount - sellerCommissionAmount;

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const booking = this.bookingsRepository.create({
      bookingCode: this.generateBookingCode(),

      trip,
      buyer,
      seller,

      passengerName: dto.passengerName,
      passengerPhone: dto.passengerPhone ?? null,

      pickupLocation: boardingPoint.name,

      boardingPoint,
      boardingPointOrder: boardingPoint.orderNumber,

      dropoffPoint,
      dropoffPointOrder: dropoffPoint?.orderNumber ?? null,

      seatQuantity,

      ticketAmount,
      systemFeeAmount,
      grossAmount,
      ownerAmount,
      sellerCommissionAmount,

      subtotalAmount: ticketAmount,
      cargoAmount: 0,
      discountAmount: 0,
      totalAmount: grossAmount,

      commissionRate: 0,
      commissionAmount: sellerCommissionAmount,
      companyAmount: systemFeeAmount,

      bookingStatus: BookingStatus.RESERVED,
      paymentStatus: PaymentStatus.PENDING,

      expiresAt,
    });

    const savedBooking = await this.bookingsRepository.save(booking);

    if (savedBooking.buyer?.id) {
      await this.notificationsService.createBookingCreated(
        savedBooking.buyer.id,
        savedBooking.bookingCode,
      );
    }

    return savedBooking;
  }

  async findAll(currentUser?: CurrentUser): Promise<Booking[]> {
    if (this.isAdmin(currentUser)) {
      return this.bookingsRepository.find({
        relations: {
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          buyer: true,
          seller: true,
          boardingPoint: true,
          dropoffPoint: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    }

    if (this.isSeller(currentUser)) {
      const sellerId = this.getUserId(currentUser);

      if (!sellerId) {
        return [];
      }

      const bookings = await this.bookingsRepository.find({
        relations: {
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          buyer: true,
          seller: true,
          boardingPoint: true,
          dropoffPoint: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      const allowedBookings: Booking[] = [];

      for (const booking of bookings) {
        const canAccess = await this.sellerHasAccessToBooking(
          booking,
          sellerId,
        );

        const soldByAnotherSeller =
          booking.seller && booking.seller.id !== sellerId;

        if (canAccess && !soldByAnotherSeller) {
          allowedBookings.push(booking);
        }
      }

      return allowedBookings;
    }

    return [];
  }

  async findMyBookings(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: {
        buyer: {
          id: userId,
        },
      },
      relations: {
        trip: {
          route: true,
          vehicle: true,
          driver: true,
        },
        seller: true,
        boardingPoint: true,
        dropoffPoint: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findPassengersByTrip(
    tripId: string,
    currentUser?: CurrentUser,
  ): Promise<any[]> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId },
      relations: {
        driver: true,
        route: true,
        vehicle: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    if (this.isDriver(currentUser)) {
      const driverId = this.getUserId(currentUser);

      if (!trip.driver || trip.driver.id !== driverId) {
        throw new ForbiddenException(
          'Você não tem acesso aos passageiros desta viagem.',
        );
      }
    }

    const bookings = await this.bookingsRepository.find({
      where: {
        trip: {
          id: tripId,
        },
      },
      relations: {
        buyer: true,
        seller: true,
        boardingPoint: true,
        dropoffPoint: true,
        trip: {
          route: true,
          vehicle: true,
          driver: true,
        },
      },
      order: {
        createdAt: 'ASC',
      },
    });

    let allowedBookings = bookings;

    if (this.isSeller(currentUser)) {
      const sellerId = this.getUserId(currentUser);

      if (!sellerId) {
        allowedBookings = [];
      } else {
        const filtered: Booking[] = [];

        for (const booking of bookings) {
          const soldByAnotherSeller =
            booking.seller && booking.seller.id !== sellerId;

          const canAccess = await this.sellerHasAccessToBooking(
            booking,
            sellerId,
          );

          if (canAccess && !soldByAnotherSeller) {
            filtered.push(booking);
          }
        }

        allowedBookings = filtered;
      }
    }

    const result = [];

    for (const booking of allowedBookings) {
      const seatReservations = await this.seatReservationsRepository.find({
        where: {
          booking: {
            id: booking.id,
          },
        },
        relations: {
          vehicleSeat: true,
        },
      });

      const orderedSeatReservations = seatReservations.sort((a, b) => {
        const seatA = Number(a.vehicleSeat?.seatNumber || 0);
        const seatB = Number(b.vehicleSeat?.seatNumber || 0);

        return seatA - seatB;
      });

      result.push({
        ...booking,
        seatReservations: orderedSeatReservations,
      });
    }

    return result.sort((a, b) => {
      const boardingA = Number(a.boardingPointOrder || 999999);
      const boardingB = Number(b.boardingPointOrder || 999999);

      if (boardingA !== boardingB) {
        return boardingA - boardingB;
      }

      const dropoffA = Number(a.dropoffPointOrder || 999999);
      const dropoffB = Number(b.dropoffPointOrder || 999999);

      if (dropoffA !== dropoffB) {
        return dropoffA - dropoffB;
      }

      return (
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
      );
    });
  }

  async findOne(id: string, currentUser?: CurrentUser): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: {
        trip: {
          route: true,
          vehicle: true,
          driver: true,
        },
        buyer: true,
        seller: true,
        boardingPoint: true,
        dropoffPoint: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva não encontrada.');
    }

    if (this.isPassenger(currentUser)) {
      const passengerId = this.getUserId(currentUser);

      if (!passengerId || booking.buyer?.id !== passengerId) {
        throw new ForbiddenException('Você não tem acesso a esta reserva.');
      }
    }

    if (this.isDriver(currentUser)) {
      const driverId = this.getUserId(currentUser);

      if (!booking.trip?.driver || booking.trip.driver.id !== driverId) {
        throw new ForbiddenException('Você não tem acesso a esta reserva.');
      }
    }

    if (this.isSeller(currentUser)) {
      const sellerId = this.getUserId(currentUser);

      if (!sellerId) {
        throw new ForbiddenException('Usuário vendedor inválido.');
      }

      const soldByAnotherSeller =
        booking.seller && booking.seller.id !== sellerId;

      const canAccess = await this.sellerHasAccessToBooking(
        booking,
        sellerId,
      );

      if (!canAccess || soldByAnotherSeller) {
        throw new ForbiddenException('Você não tem acesso a esta reserva.');
      }
    }

    return booking;
  }

  async update(
    id: string,
    dto: UpdateBookingDto,
    currentUser?: CurrentUser,
  ): Promise<Booking> {
    const booking = await this.findOne(id, currentUser);

    Object.assign(booking, dto);

    return this.bookingsRepository.save(booking);
  }

  async confirm(id: string, currentUser?: CurrentUser): Promise<Booking> {
    const booking = await this.findOne(id, currentUser);

    const seatReservations = await this.seatReservationsRepository.find({
      where: {
        booking: { id: booking.id },
        reservationStatus: SeatReservationStatus.RESERVED,
      },
    });

    if (seatReservations.length === 0) {
      throw new BadRequestException('Sem assentos reservados.');
    }

    booking.bookingStatus = BookingStatus.CONFIRMED;
    booking.paymentStatus = PaymentStatus.PAID;
    booking.confirmedAt = new Date();

    for (const reservation of seatReservations) {
      reservation.reservationStatus = SeatReservationStatus.SOLD;
      reservation.soldAt = new Date();
    }

    await this.seatReservationsRepository.save(seatReservations);

    const savedBooking = await this.bookingsRepository.save(booking);

    await this.ticketsService.issueTicket({
      bookingId: savedBooking.id,
    });

    if (savedBooking.buyer?.id) {
      await this.notificationsService.createPaymentConfirmed(
        savedBooking.buyer.id,
        savedBooking.bookingCode,
      );
    }

    return savedBooking;
  }

  async confirmBoarding(
    bookingId: string,
    currentUser?: CurrentUser,
  ): Promise<Booking> {
    const booking = await this.findOne(bookingId, currentUser);

    if (booking.bookingStatus !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('A reserva precisa estar confirmada.');
    }

    if (booking.boardedAt) {
      throw new BadRequestException(
        'O embarque deste passageiro já foi confirmado.',
      );
    }

    booking.boardedAt = new Date();

    const savedBooking = await this.bookingsRepository.save(booking);

    if (savedBooking.buyer?.id) {
      await this.notificationsService.createPassengerBoarded(
        savedBooking.buyer.id,
        savedBooking.bookingCode,
      );
    }

    return savedBooking;
  }

  async confirmArrival(
    bookingId: string,
    currentUser?: CurrentUser,
  ): Promise<Booking> {
    const booking = await this.findOne(bookingId, currentUser);

    if (booking.bookingStatus !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('A reserva precisa estar confirmada.');
    }

    if (!booking.boardedAt) {
      throw new BadRequestException(
        'O passageiro precisa embarcar antes de confirmar a descida.',
      );
    }

    if (booking.arrivedAt) {
      throw new BadRequestException(
        'A descida deste passageiro já foi confirmada.',
      );
    }

    booking.arrivedAt = new Date();

    const savedBooking = await this.bookingsRepository.save(booking);

    if (savedBooking.buyer?.id) {
      await this.notificationsService.createPassengerArrived(
        savedBooking.buyer.id,
        savedBooking.bookingCode,
      );
    }

    return savedBooking;
  }

  async cancel(id: string, currentUser?: CurrentUser): Promise<Booking> {
    const booking = await this.findOne(id, currentUser);

    if (booking.bookingStatus === BookingStatus.CANCELLED) {
      throw new BadRequestException('Esta reserva já está cancelada.');
    }

    if (booking.boardedAt) {
      throw new BadRequestException(
        'Não é possível cancelar uma reserva após o embarque.',
      );
    }

    if (this.isPassenger(currentUser)) {
      if (booking.trip?.status !== TripStatus.SCHEDULED) {
        throw new BadRequestException(
          'Você só pode cancelar antes do início do embarque.',
        );
      }
    }

    const seatReservations = await this.seatReservationsRepository.find({
      where: {
        booking: {
          id: booking.id,
        },
      },
    });

    for (const reservation of seatReservations) {
      reservation.reservationStatus = SeatReservationStatus.CANCELLED;
    }

    await this.seatReservationsRepository.save(seatReservations);

    const cargo = await this.cargoRequestsRepository.findOne({
      where: {
        booking: {
          id: booking.id,
        },
      },
    });

    if (cargo) {
      cargo.cargoStatus = CargoRequestStatus.CANCELLED;
      cargo.passengerAccepted = false;
      cargo.passengerRejectedAt = new Date();

      await this.cargoRequestsRepository.save(cargo);
    }

    booking.bookingStatus = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cargoAmount = 0;

    this.recalculateBookingTotal(booking);

    return this.bookingsRepository.save(booking);
  }

  private generateBookingCode(): string {
    return `BK-${Date.now().toString().slice(-6)}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
  }
}