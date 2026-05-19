import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

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

  private generateBookingCode(): string {
    return `BK-${Date.now().toString().slice(-6)}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
  }

  private recalculateBookingTotal(booking: Booking): void {
    booking.totalAmount =
      Number(booking.subtotalAmount || 0) +
      Number(booking.systemFeeAmount || 0) +
      Number(booking.cargoAmount || 0) -
      Number(booking.discountAmount || 0);
  }

  private sellerRouteMatchesTrip(sellerRoute: SellerRoute, trip: Trip): boolean {
    const sameRoute = sellerRoute.route?.id === trip.route?.id;

    if (!sameRoute) {
      return false;
    }

    /**
     * Importante:
     * Se vehicleType estiver vazio em seller_routes, liberamos pela rota.
     * Isso evita esconder viagens válidas por configuração incompleta.
     */
    if (!sellerRoute.vehicleType) {
      return true;
    }

    return sellerRoute.vehicleType === trip.vehicle?.vehicleType;
  }

  private async sellerHasAccessToBooking(
    booking: Booking,
    sellerId: string,
  ): Promise<boolean> {
    if (booking.seller?.id === sellerId) {
      return true;
    }

    const routeId = booking.trip?.route?.id;

    if (!routeId) {
      return false;
    }

    const sellerRoutes = await this.sellerRoutesRepository.find({
      where: {
        seller: {
          id: sellerId,
        },
        route: {
          id: routeId,
        },
      },
      relations: {
        route: true,
      },
    });

    return sellerRoutes.some((sellerRoute) =>
      this.sellerRouteMatchesTrip(sellerRoute, booking.trip),
    );
  }

  private async ensureSellerCanAccessTrip(
    trip: Trip,
    currentUser?: CurrentUser,
  ): Promise<void> {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (!this.isSeller(currentUser)) {
      throw new ForbiddenException('Acesso negado.');
    }

    const sellerId = this.getUserId(currentUser);

    if (!sellerId) {
      throw new ForbiddenException('Usuário vendedor inválido.');
    }

    const sellerRoutes = await this.sellerRoutesRepository.find({
      where: {
        seller: {
          id: sellerId,
        },
        route: {
          id: trip.route?.id,
        },
      },
      relations: {
        route: true,
      },
    });

    const canAccess = sellerRoutes.some((sellerRoute) =>
      this.sellerRouteMatchesTrip(sellerRoute, trip),
    );

    if (!canAccess) {
      throw new ForbiddenException('Você não tem acesso a esta viagem.');
    }
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

  private mapTripForSellerBookings(trip: Trip) {
    return {
      id: trip.id,
      status: trip.status,
      departureMode: trip.departureMode,
      boardingDate: trip.boardingDate,
      departureDatetime: trip.departureDatetime,
      baseFare: trip.baseFare,
      availableSeatsCount: trip.availableSeatsCount,

      route: trip.route
        ? {
            id: trip.route.id,
            originName: trip.route.originName,
            destinationName: trip.route.destinationName,
          }
        : null,

      vehicle: trip.vehicle
        ? {
            id: trip.vehicle.id,
            brand: trip.vehicle.brand,
            model: trip.vehicle.model,
            plateNumber: trip.vehicle.plateNumber,
            vehicleType: trip.vehicle.vehicleType,
            seatCount: trip.vehicle.seatCount,
          }
        : null,

      driver: trip.driver
        ? {
            id: trip.driver.id,
            fullName: trip.driver.fullName,
            phoneNumber: trip.driver.phoneNumber,
          }
        : null,
    };
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

      expiresAt: null,
      passengerDeletedAt: null,
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

  /**
   * Endpoint leve:
   * Lista apenas viagens/carros ativos para a tela de vendas/reservas.
   */
  async findSellerActiveTrips(currentUser?: CurrentUser): Promise<any[]> {
    if (!this.isSeller(currentUser) && !this.isAdmin(currentUser)) {
      throw new ForbiddenException('Acesso negado.');
    }

    const query = this.tripsRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('trip.driver', 'driver')
      .where('trip.status IN (:...statuses)', {
        statuses: [TripStatus.SCHEDULED, TripStatus.BOARDING],
      })
      .orderBy('trip.boardingDate', 'ASC')
      .addOrderBy('trip.departureDatetime', 'ASC')
      .addOrderBy('trip.createdAt', 'DESC');

    const trips = await query.getMany();

    if (this.isAdmin(currentUser)) {
      return trips.map((trip) => this.mapTripForSellerBookings(trip));
    }

    const sellerId = this.getUserId(currentUser);

    if (!sellerId) {
      return [];
    }

    const sellerRoutes = await this.sellerRoutesRepository.find({
      where: {
        seller: {
          id: sellerId,
        },
      },
      relations: {
        route: true,
      },
    });

    const allowedTrips = trips.filter((trip) =>
      sellerRoutes.some((sellerRoute) =>
        this.sellerRouteMatchesTrip(sellerRoute, trip),
      ),
    );

    return allowedTrips.map((trip) => this.mapTripForSellerBookings(trip));
  }

  /**
   * Endpoint leve:
   * Lista reservas/vendas apenas da viagem selecionada.
   */
  async findBookingsByTripForSeller(
    tripId: string,
    currentUser?: CurrentUser,
  ): Promise<any[]> {
    const trip = await this.tripsRepository.findOne({
      where: {
        id: tripId,
      },
      relations: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    await this.ensureSellerCanAccessTrip(trip, currentUser);

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
        createdAt: 'DESC',
      },
    });

    const sellerId = this.getUserId(currentUser);

    const filteredBookings = this.isSeller(currentUser)
      ? bookings.filter((booking) => {
          const soldByAnotherSeller =
            booking.seller && booking.seller.id !== sellerId;

          return !soldByAnotherSeller;
        })
      : bookings;

    const bookingIds = filteredBookings.map((booking) => booking.id);

    if (bookingIds.length === 0) {
      return [];
    }

    const seatReservations = await this.seatReservationsRepository.find({
      where: {
        booking: {
          id: In(bookingIds),
        },
        reservationStatus: In([
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
      relations: {
        booking: true,
        vehicleSeat: true,
      },
    });

    const cargoRequests = await this.cargoRequestsRepository.find({
      where: {
        booking: {
          id: In(bookingIds),
        },
      },
      relations: {
        booking: true,
      },
    });

    const seatsByBooking = new Map<string, SeatReservation[]>();
    const cargoByBooking = new Map<string, CargoRequest>();

    for (const reservation of seatReservations) {
      const bookingId = reservation.booking?.id;

      if (!bookingId) {
        continue;
      }

      const current = seatsByBooking.get(bookingId) || [];
      current.push(reservation);
      seatsByBooking.set(bookingId, current);
    }

    for (const cargo of cargoRequests) {
      const bookingId = cargo.booking?.id;

      if (!bookingId) {
        continue;
      }

      cargoByBooking.set(bookingId, cargo);
    }

    return filteredBookings.map((booking) => {
      const reservations = seatsByBooking.get(booking.id) || [];

      const orderedReservations = reservations.sort((a, b) => {
        const seatA = Number(a.vehicleSeat?.seatNumber || 0);
        const seatB = Number(b.vehicleSeat?.seatNumber || 0);

        return seatA - seatB;
      });

      const reservedSeatLabels = orderedReservations
        .map(
          (reservation) =>
            reservation.vehicleSeat?.seatLabel ||
            reservation.vehicleSeat?.seatNumber,
        )
        .filter(Boolean);

      const cargo = cargoByBooking.get(booking.id) || null;

      return {
        id: booking.id,
        bookingCode: booking.bookingCode,

        passengerName: booking.passengerName,
        passengerPhone: booking.passengerPhone,

        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,

        seatQuantity: booking.seatQuantity,
        reservedSeatLabels,

        ticketAmount: booking.ticketAmount,
        subtotalAmount: booking.subtotalAmount,
        systemFeeAmount: booking.systemFeeAmount,
        cargoAmount: booking.cargoAmount,
        totalAmount: booking.totalAmount,

        confirmedAt: booking.confirmedAt,
        cancelledAt: booking.cancelledAt,
        boardedAt: booking.boardedAt,
        arrivedAt: booking.arrivedAt,
        createdAt: booking.createdAt,

        boardingPoint: booking.boardingPoint
          ? {
              id: booking.boardingPoint.id,
              name: booking.boardingPoint.name,
              orderNumber: booking.boardingPoint.orderNumber,
            }
          : null,

        dropoffPoint: booking.dropoffPoint
          ? {
              id: booking.dropoffPoint.id,
              name: booking.dropoffPoint.name,
              orderNumber: booking.dropoffPoint.orderNumber,
            }
          : null,

        trip: booking.trip
          ? {
              id: booking.trip.id,
              status: booking.trip.status,
              boardingDate: booking.trip.boardingDate,
              departureDatetime: booking.trip.departureDatetime,
              baseFare: booking.trip.baseFare,

              route: booking.trip.route
                ? {
                    id: booking.trip.route.id,
                    originName: booking.trip.route.originName,
                    destinationName: booking.trip.route.destinationName,
                  }
                : null,

              vehicle: booking.trip.vehicle
                ? {
                    id: booking.trip.vehicle.id,
                    brand: booking.trip.vehicle.brand,
                    model: booking.trip.vehicle.model,
                    plateNumber: booking.trip.vehicle.plateNumber,
                    vehicleType: booking.trip.vehicle.vehicleType,
                    seatCount: booking.trip.vehicle.seatCount,
                  }
                : null,

              driver: booking.trip.driver
                ? {
                    id: booking.trip.driver.id,
                    fullName: booking.trip.driver.fullName,
                    phoneNumber: booking.trip.driver.phoneNumber,
                  }
                : null,
            }
          : null,

        cargoRequest: cargo
          ? {
              id: cargo.id,
              cargoDescription: cargo.cargoDescription,
              estimatedWeightKg: cargo.estimatedWeightKg,
              photoUrl: cargo.photoUrl,
              finalPrice: cargo.finalPrice,
              cargoStatus: cargo.cargoStatus,
              passengerAccepted: cargo.passengerAccepted,
            }
          : null,
      };
    });
  }

  async findMyBookings(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: {
        buyer: {
          id: userId,
        },
        passengerDeletedAt: IsNull(),
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

  async findMyBookingsSummary(userId: string): Promise<any[]> {
    const bookings = await this.bookingsRepository.find({
      where: {
        buyer: {
          id: userId,
        },
        passengerDeletedAt: IsNull(),
      },
      relations: {
        trip: {
          route: true,
          vehicle: true,
          driver: true,
        },
        boardingPoint: true,
        dropoffPoint: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    const bookingIds = bookings.map((booking) => booking.id);

    if (bookingIds.length === 0) {
      return [];
    }

    const seatReservations = await this.seatReservationsRepository.find({
      where: {
        booking: {
          id: In(bookingIds),
        },
        reservationStatus: In([
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
      relations: {
        booking: true,
        vehicleSeat: true,
      },
    });

    const cargos = await this.cargoRequestsRepository.find({
      where: {
        booking: {
          id: In(bookingIds),
        },
      },
      relations: {
        booking: true,
      },
    });

    const seatsByBooking = new Map<string, SeatReservation[]>();
    const cargoByBooking = new Map<string, CargoRequest>();

    for (const reservation of seatReservations) {
      const bookingId = reservation.booking?.id;

      if (!bookingId) {
        continue;
      }

      const current = seatsByBooking.get(bookingId) || [];
      current.push(reservation);
      seatsByBooking.set(bookingId, current);
    }

    for (const cargo of cargos) {
      const bookingId = cargo.booking?.id;

      if (!bookingId) {
        continue;
      }

      cargoByBooking.set(bookingId, cargo);
    }

    return bookings.map((booking) => {
      const reservations = seatsByBooking.get(booking.id) || [];

      const orderedReservations = reservations.sort((a, b) => {
        const seatA = Number(a.vehicleSeat?.seatNumber || 0);
        const seatB = Number(b.vehicleSeat?.seatNumber || 0);

        return seatA - seatB;
      });

      const reservedSeatLabels = orderedReservations
        .map(
          (reservation) =>
            reservation.vehicleSeat?.seatLabel ||
            reservation.vehicleSeat?.seatNumber,
        )
        .filter(Boolean)
        .join(', ');

      const cargo = cargoByBooking.get(booking.id) || null;

      return {
        id: booking.id,
        bookingCode: booking.bookingCode,

        passengerName: booking.passengerName,
        passengerPhone: booking.passengerPhone,

        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,

        seatQuantity: booking.seatQuantity,
        reservedSeatLabels,

        ticketAmount: booking.ticketAmount,
        subtotalAmount: booking.subtotalAmount,
        systemFeeAmount: booking.systemFeeAmount,
        cargoAmount: booking.cargoAmount,
        discountAmount: booking.discountAmount,
        grossAmount: booking.grossAmount,
        totalAmount: booking.totalAmount,

        confirmedAt: booking.confirmedAt,
        cancelledAt: booking.cancelledAt,
        boardedAt: booking.boardedAt,
        createdAt: booking.createdAt,

        boardingPoint: booking.boardingPoint
          ? {
              id: booking.boardingPoint.id,
              name: booking.boardingPoint.name,
              orderNumber: booking.boardingPoint.orderNumber,
            }
          : null,

        dropoffPoint: booking.dropoffPoint
          ? {
              id: booking.dropoffPoint.id,
              name: booking.dropoffPoint.name,
              orderNumber: booking.dropoffPoint.orderNumber,
            }
          : null,

        trip: booking.trip
          ? {
              id: booking.trip.id,
              status: booking.trip.status,
              boardingDate: booking.trip.boardingDate,
              departureDatetime: booking.trip.departureDatetime,
              baseFare: booking.trip.baseFare,

              route: booking.trip.route
                ? {
                    id: booking.trip.route.id,
                    originName: booking.trip.route.originName,
                    destinationName: booking.trip.route.destinationName,
                  }
                : null,

              vehicle: booking.trip.vehicle
                ? {
                    id: booking.trip.vehicle.id,
                    brand: booking.trip.vehicle.brand,
                    model: booking.trip.vehicle.model,
                    color: booking.trip.vehicle.color,
                    plateNumber: booking.trip.vehicle.plateNumber,
                    vehicleImageUrl: booking.trip.vehicle.vehicleImageUrl,
                  }
                : null,

              driver: booking.trip.driver
                ? {
                    id: booking.trip.driver.id,
                    fullName: booking.trip.driver.fullName,
                    phoneNumber: booking.trip.driver.phoneNumber,
                  }
                : null,
            }
          : null,

        seatReservations: orderedReservations.map((reservation) => ({
          id: reservation.id,
          reservationStatus: reservation.reservationStatus,
          vehicleSeat: reservation.vehicleSeat
            ? {
                id: reservation.vehicleSeat.id,
                seatNumber: reservation.vehicleSeat.seatNumber,
                seatLabel: reservation.vehicleSeat.seatLabel,
              }
            : null,
        })),

        cargoRequest: cargo
          ? {
              id: cargo.id,
              cargoDescription: cargo.cargoDescription,
              estimatedWeightKg: cargo.estimatedWeightKg,
              photoUrl: cargo.photoUrl,
              finalPrice: cargo.finalPrice,
              cargoStatus: cargo.cargoStatus,
              passengerAccepted: cargo.passengerAccepted,
            }
          : null,
      };
    });
  }

  async deleteForPassenger(
    bookingId: string,
    currentUser?: CurrentUser,
  ): Promise<{ message: string }> {
    if (!this.isPassenger(currentUser)) {
      throw new ForbiddenException(
        'Apenas passageiro pode eliminar esta viagem do próprio app.',
      );
    }

    const booking = await this.findOne(bookingId, currentUser);

    booking.passengerDeletedAt = new Date();

    await this.bookingsRepository.save(booking);

    return {
      message: 'Viagem eliminada do app do passageiro.',
    };
  }

  async deleteSelectedForPassenger(
    bookingIds: string[],
    currentUser?: CurrentUser,
  ): Promise<{ message: string; deletedCount: number }> {
    if (!this.isPassenger(currentUser)) {
      throw new ForbiddenException('Apenas passageiro pode eliminar viagens.');
    }

    const passengerId = this.getUserId(currentUser);

    if (!passengerId) {
      throw new ForbiddenException('Usuário inválido.');
    }

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw new BadRequestException('Nenhuma viagem selecionada.');
    }

    let deletedCount = 0;

    for (const bookingId of bookingIds) {
      const booking = await this.bookingsRepository.findOne({
        where: { id: bookingId },
        relations: { buyer: true },
      });

      if (!booking) {
        continue;
      }

      if (booking.buyer?.id !== passengerId) {
        continue;
      }

      booking.passengerDeletedAt = new Date();

      await this.bookingsRepository.save(booking);

      deletedCount += 1;
    }

    return {
      message: 'Viagens selecionadas eliminadas do app do passageiro.',
      deletedCount,
    };
  }

  async deleteAllForPassenger(
    currentUser?: CurrentUser,
  ): Promise<{ message: string; deletedCount: number }> {
    if (!this.isPassenger(currentUser)) {
      throw new ForbiddenException('Apenas passageiro pode eliminar viagens.');
    }

    const passengerId = this.getUserId(currentUser);

    if (!passengerId) {
      throw new ForbiddenException('Usuário inválido.');
    }

    const bookings = await this.bookingsRepository.find({
      where: {
        buyer: { id: passengerId },
        passengerDeletedAt: IsNull(),
      },
      relations: { buyer: true },
    });

    for (const booking of bookings) {
      booking.passengerDeletedAt = new Date();
    }

    if (bookings.length > 0) {
      await this.bookingsRepository.save(bookings);
    }

    return {
      message: 'Todas as viagens foram eliminadas do app do passageiro.',
      deletedCount: bookings.length,
    };
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
        trip: { id: tripId },
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

    const bookingIds = allowedBookings.map((booking) => booking.id);

    if (bookingIds.length === 0) {
      return [];
    }

    const seatReservations = await this.seatReservationsRepository.find({
      where: {
        booking: { id: In(bookingIds) },
      },
      relations: {
        booking: true,
        vehicleSeat: true,
      },
    });

    const seatsByBooking = new Map<string, SeatReservation[]>();

    for (const reservation of seatReservations) {
      const bookingId = reservation.booking?.id;

      if (!bookingId) {
        continue;
      }

      const current = seatsByBooking.get(bookingId) || [];
      current.push(reservation);
      seatsByBooking.set(bookingId, current);
    }

    const result = allowedBookings.map((booking) => {
      const reservations = seatsByBooking.get(booking.id) || [];

      const orderedSeatReservations = reservations.sort((a, b) => {
        const seatA = Number(a.vehicleSeat?.seatNumber || 0);
        const seatB = Number(b.vehicleSeat?.seatNumber || 0);

        return seatA - seatB;
      });

      return {
        ...booking,
        seatReservations: orderedSeatReservations,
      };
    });

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

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async findOne(id: string, currentUser?: CurrentUser): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: {
        id,
      },
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

      if (booking.passengerDeletedAt) {
        throw new NotFoundException('Reserva não encontrada.');
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

      const canAccess = await this.sellerHasAccessToBooking(booking, sellerId);

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
        booking: {
          id: booking.id,
        },
        reservationStatus: SeatReservationStatus.RESERVED,
      },
    });

    if (seatReservations.length === 0) {
      throw new BadRequestException('Sem assentos reservados.');
    }

    booking.bookingStatus = BookingStatus.CONFIRMED;
    booking.paymentStatus = PaymentStatus.PAID;
    booking.confirmedAt = new Date();
    booking.expiresAt = null;

    for (const reservation of seatReservations) {
      reservation.reservationStatus = SeatReservationStatus.SOLD;
      reservation.soldAt = new Date();
      reservation.expiresAt = null;
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
      reservation.cancelledAt = new Date();
      reservation.expiresAt = null;
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
    booking.expiresAt = null;

    this.recalculateBookingTotal(booking);

    return this.bookingsRepository.save(booking);
  }
}
