import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';

import { DepartureMode, Trip, TripStatus } from './entities/trip.entity';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

import { Route } from '../routes/entities/route.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { VehicleSeat } from '../vehicle-seats/entities/vehicle-seat.entity';
import { SellerRoute } from '../seller-routes/entities/seller-route.entity';

import {
  SeatReservation,
  SeatReservationStatus,
} from '../seat-reservations/entities/seat-reservation.entity';

import { Role } from '../../common/enums/role.enum';

type SearchTripsFilters = {
  origin?: string;
  destination?: string;
  vehicleType?: string;
  routeId?: string;
  date?: string;
};

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,

    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,

    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(VehicleSeat)
    private readonly vehicleSeatsRepository: Repository<VehicleSeat>,

    @InjectRepository(SellerRoute)
    private readonly sellerRoutesRepository: Repository<SellerRoute>,

    @InjectRepository(SeatReservation)
    private readonly seatReservationsRepository: Repository<SeatReservation>,
  ) {}

  private getTodayDateOnly(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private getTodayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getUserIdFromJwt(user: any): string {
    return user?.sub || user?.id;
  }

  private getTripDateOnly(dto: CreateTripDto): Date | null {
    if (dto.boardingDate) {
      const date = new Date(`${dto.boardingDate}T00:00:00`);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (dto.departureDatetime) {
      const date = new Date(dto.departureDatetime);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    return null;
  }

  private async ensureDriverCanAccessTrip(trip: Trip, user?: any): Promise<void> {
    if (!user || user.role !== Role.DRIVER) return;

    const driverId = this.getUserIdFromJwt(user);

    if (!trip.driver || trip.driver.id !== driverId) {
      throw new ForbiddenException(
        'Você não tem permissão para controlar esta viagem.',
      );
    }
  }

  async create(dto: CreateTripDto, user: User): Promise<Trip> {
    const route = await this.routesRepository.findOne({
      where: { id: dto.routeId },
    });

    if (!route) {
      throw new NotFoundException('Rota não encontrada.');
    }

    const vehicle = await this.vehiclesRepository.findOne({
      where: { id: dto.vehicleId },
      relations: {
        route: true,
        driver: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    if (!vehicle.route || vehicle.route.id !== route.id) {
      throw new BadRequestException(
        'Este veículo não pertence à rota selecionada.',
      );
    }

    if (!vehicle.vehicleType) {
      throw new BadRequestException(
        'Este veículo ainda não possui tipo de serviço definido.',
      );
    }

    if (user.role === Role.SELLER) {
      const sellerId = this.getUserIdFromJwt(user);

      const sellerRoute = await this.sellerRoutesRepository.findOne({
        where: {
          seller: { id: sellerId },
          route: { id: route.id },
          vehicleType: vehicle.vehicleType,
        },
      });

      if (!sellerRoute) {
        throw new BadRequestException(
          'Você não tem permissão para criar viagem nesta rota com este tipo de veículo.',
        );
      }
    }

    const departureMode = dto.departureMode ?? DepartureMode.SCHEDULED_TIME;
    const tripDateOnly = this.getTripDateOnly(dto);

    if (!tripDateOnly) {
      throw new BadRequestException('Data da viagem é obrigatória.');
    }

    if (tripDateOnly < this.getTodayDateOnly()) {
      throw new BadRequestException(
        'Não é permitido publicar viagem em data passada.',
      );
    }

    let driver: User | null = null;

    if (dto.driverId) {
      driver = await this.usersRepository.findOne({
        where: { id: dto.driverId },
      });

      if (!driver) {
        throw new NotFoundException('Motorista não encontrado.');
      }

      if (driver.role !== Role.DRIVER) {
        throw new BadRequestException(
          'O usuário selecionado não possui perfil de motorista.',
        );
      }
    } else if (vehicle.driver) {
      driver = vehicle.driver;
    }

    let departureDatetime: Date | null = null;

    if (departureMode === DepartureMode.SCHEDULED_TIME) {
      if (!dto.departureDatetime) {
        throw new BadRequestException(
          'Hora de saída é obrigatória para viagens com horário.',
        );
      }

      departureDatetime = new Date(dto.departureDatetime);
    }

    if (departureMode === DepartureMode.WHEN_FULL) {
      if (!dto.boardingDate) {
        throw new BadRequestException(
          'Data da viagem é obrigatória para viagens que saem quando encher.',
        );
      }

      departureDatetime = null;
    }

    const seatsCount = await this.vehicleSeatsRepository.count({
      where: {
        vehicle: { id: vehicle.id },
        active: true,
      },
    });

    const trip = this.tripsRepository.create({
      route,
      vehicle,
      driver,
      departureMode,
      boardingDate: dto.boardingDate ?? null,
      departureDatetime,
      estimatedArrivalDatetime: dto.estimatedArrivalDatetime
        ? new Date(dto.estimatedArrivalDatetime)
        : null,
      baseFare: dto.baseFare,
      availableSeatsCount: seatsCount,
      status: TripStatus.SCHEDULED,
      notes: dto.notes ?? null,
    });

    return this.tripsRepository.save(trip);
  }

  async findAll(user: User): Promise<Trip[]> {
    const activeStatuses = [TripStatus.SCHEDULED, TripStatus.BOARDING];

    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      return this.tripsRepository.find({
        where: { status: In(activeStatuses) },
        relations: {
          route: true,
          vehicle: true,
          driver: true,
        },
        order: {
          boardingDate: 'ASC',
          departureDatetime: 'ASC',
          createdAt: 'DESC',
        },
      });
    }

    if (user.role === Role.SELLER) {
      const sellerId = this.getUserIdFromJwt(user);

      const sellerRoutes = await this.sellerRoutesRepository.find({
        where: {
          seller: { id: sellerId },
        },
        relations: {
          route: true,
        },
      });

      if (sellerRoutes.length === 0) return [];

      const routeIds = sellerRoutes
        .map((item) => item.route?.id)
        .filter(Boolean);

      if (routeIds.length === 0) return [];

      const trips = await this.tripsRepository.find({
        where: {
          route: { id: In(routeIds) },
          status: In(activeStatuses),
        },
        relations: {
          route: true,
          vehicle: true,
          driver: true,
        },
        order: {
          boardingDate: 'ASC',
          departureDatetime: 'ASC',
          createdAt: 'DESC',
        },
      });

      return trips.filter((trip) =>
        sellerRoutes.some(
          (sellerRoute) =>
            sellerRoute.route?.id === trip.route?.id &&
            sellerRoute.vehicleType === trip.vehicle?.vehicleType,
        ),
      );
    }

    return [];
  }

  async findAllLight(user: User) {
    const activeStatuses = [TripStatus.SCHEDULED, TripStatus.BOARDING];

    let routeIds: string[] = [];
    let allowedPairs: Array<{ routeId: string; vehicleType: string }> = [];

    if (user.role === Role.SELLER) {
      const sellerId = this.getUserIdFromJwt(user);

      const sellerRoutes = await this.sellerRoutesRepository.find({
        where: {
          seller: { id: sellerId },
        },
        relations: {
          route: true,
        },
      });

      if (sellerRoutes.length === 0) return [];

      allowedPairs = sellerRoutes
        .filter((item) => item.route?.id && item.vehicleType)
        .map((item) => ({
          routeId: item.route.id,
          vehicleType: item.vehicleType,
        }));

      routeIds = [...new Set(allowedPairs.map((item) => item.routeId))];

      if (routeIds.length === 0) return [];
    }

    const query = this.tripsRepository
      .createQueryBuilder('trip')
      .leftJoin('trip.route', 'route')
      .leftJoin('trip.vehicle', 'vehicle')
      .leftJoin('trip.driver', 'driver')
      .select([
        'trip.id',
        'trip.departureMode',
        'trip.boardingDate',
        'trip.departureDatetime',
        'trip.baseFare',
        'trip.availableSeatsCount',
        'trip.status',
        'trip.createdAt',

        'route.id',
        'route.originName',
        'route.destinationName',
        'route.distanceKm',
        'route.estimatedDurationMinutes',

        'vehicle.id',
        'vehicle.brand',
        'vehicle.model',
        'vehicle.plateNumber',
        'vehicle.vehicleType',
        'vehicle.seatCount',
        'vehicle.vehicleImageUrl',

        'driver.id',
        'driver.fullName',
        'driver.phoneNumber',
      ])
      .where('trip.status IN (:...statuses)', {
        statuses: activeStatuses,
      });

    if (user.role === Role.SELLER) {
      query.andWhere('route.id IN (:...routeIds)', { routeIds });
    }

    query
      .orderBy('trip.boardingDate', 'ASC')
      .addOrderBy('trip.departureDatetime', 'ASC')
      .addOrderBy('trip.createdAt', 'DESC');

    const trips = await query.getMany();

    const filteredTrips =
      user.role === Role.SELLER
        ? trips.filter((trip) =>
            allowedPairs.some(
              (pair) =>
                pair.routeId === trip.route?.id &&
                pair.vehicleType === trip.vehicle?.vehicleType,
            ),
          )
        : trips;

    return filteredTrips.map((trip) => {
      const totalSeats = Number(
        trip.vehicle?.seatCount || trip.availableSeatsCount || 0,
      );

      const availableSeats = Number(trip.availableSeatsCount || 0);

      return {
        id: trip.id,
        departureMode: trip.departureMode,
        boardingDate: trip.boardingDate,
        departureDatetime: trip.departureDatetime,
        baseFare: trip.baseFare,
        status: trip.status,

        totalSeats,
        availableSeatsCount: availableSeats,
        realAvailableSeats: availableSeats,
        occupiedSeatsCount: Math.max(totalSeats - availableSeats, 0),

        route: trip.route
          ? {
              id: trip.route.id,
              originName: trip.route.originName,
              destinationName: trip.route.destinationName,
              distanceKm: trip.route.distanceKm,
              estimatedDurationMinutes: trip.route.estimatedDurationMinutes,
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
              vehicleImageUrl: trip.vehicle.vehicleImageUrl,
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
    });
  }
    async findMyDriverTrips(driverId: string): Promise<Trip[]> {
    return this.tripsRepository.find({
      where: {
        driver: { id: driverId },
        status: In([
          TripStatus.SCHEDULED,
          TripStatus.BOARDING,
          TripStatus.IN_PROGRESS,
          TripStatus.COMPLETED,
          TripStatus.CANCELLED,
        ]),
      },
      relations: {
        route: true,
        vehicle: true,
        driver: true,
      },
      order: {
        boardingDate: 'DESC',
        departureDatetime: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async findAvailable(): Promise<Trip[]> {
    const today = this.getTodayString();

    return this.tripsRepository.find({
      where: [
        {
          status: In([TripStatus.SCHEDULED, TripStatus.BOARDING]),
          departureDatetime: MoreThanOrEqual(new Date()),
        },
        {
          status: In([TripStatus.SCHEDULED, TripStatus.BOARDING]),
          departureMode: DepartureMode.WHEN_FULL,
          boardingDate: MoreThanOrEqual(today),
        },
      ],
      relations: {
        route: true,
        vehicle: true,
        driver: true,
      },
      order: {
        boardingDate: 'ASC',
        departureDatetime: 'ASC',
        createdAt: 'DESC',
      },
    });
  }

  async search(filters: SearchTripsFilters): Promise<Trip[]> {
    const now = new Date();
    const today = this.getTodayString();

    const {
      origin,
      destination,
      vehicleType,
      routeId,
      date,
    } = filters;

    const query = this.tripsRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('trip.driver', 'driver')
      .where('trip.status IN (:...statuses)', {
        statuses: [TripStatus.SCHEDULED, TripStatus.BOARDING],
      })
      .andWhere(
        `(
          trip.departure_datetime >= :now
          OR (
            trip.departure_mode = :whenFull
            AND trip.boarding_date >= :today
          )
        )`,
        {
          now,
          whenFull: DepartureMode.WHEN_FULL,
          today,
        },
      );

    if (routeId && routeId.trim()) {
      query.andWhere('route.id = :routeId', {
        routeId: routeId.trim(),
      });
    }

    if (origin && origin.trim()) {
      query.andWhere(
        'LOWER(route.origin_name) LIKE LOWER(:origin)',
        {
          origin: `%${origin.trim()}%`,
        },
      );
    }

    if (destination && destination.trim()) {
      query.andWhere(
        'LOWER(route.destination_name) LIKE LOWER(:destination)',
        {
          destination: `%${destination.trim()}%`,
        },
      );
    }

    if (vehicleType && vehicleType !== 'all') {
      query.andWhere(
        'vehicle.vehicle_type = :vehicleType',
        {
          vehicleType,
        },
      );
    }

    if (date && date.trim()) {
      query.andWhere(
        `(
          trip.boarding_date = :date
          OR DATE(trip.departure_datetime) = :date
        )`,
        {
          date: date.trim(),
        },
      );
    }

    query
      .orderBy('trip.boarding_date', 'ASC')
      .addOrderBy('trip.departure_datetime', 'ASC')
      .addOrderBy('trip.created_at', 'DESC');

    return query.getMany();
  }

  async findOne(id: string): Promise<Trip> {
    const trip = await this.tripsRepository.findOne({
      where: { id },
      relations: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });

    if (!trip) {
      throw new NotFoundException(
        'Viagem não encontrada.',
      );
    }

    return trip;
  }

  async findSeatsByTrip(tripId: string) {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId },
      relations: {
        vehicle: true,
      },
    });

    if (!trip) {
      throw new NotFoundException(
        'Viagem não encontrada.',
      );
    }

    if (!trip.vehicle) {
      throw new BadRequestException(
        'Esta viagem não possui veículo associado.',
      );
    }

    const seats = await this.vehicleSeatsRepository.find({
      where: {
        vehicle: { id: trip.vehicle.id },
        active: true,
      },
      order: {
        seatNumber: 'ASC',
      },
    });

    const now = new Date();

    const occupiedReservations =
      await this.seatReservationsRepository
        .createQueryBuilder('reservation')
        .leftJoinAndSelect(
          'reservation.vehicleSeat',
          'vehicleSeat',
        )
        .where(
          'reservation.tripId = :tripId',
          {
            tripId: trip.id,
          },
        )
        .andWhere(
          `(
            reservation.reservationStatus = :soldStatus
            OR reservation.reservationStatus = :reservedStatus
            OR (
              reservation.reservationStatus = :heldStatus
              AND reservation.expiresAt IS NOT NULL
              AND reservation.expiresAt > :now
            )
          )`,
          {
            soldStatus:
              SeatReservationStatus.SOLD,
            reservedStatus:
              SeatReservationStatus.RESERVED,
            heldStatus:
              SeatReservationStatus.HELD,
            now,
          },
        )
        .getMany();

    const occupiedSeatIds = new Set(
      occupiedReservations.map(
        (reservation) =>
          reservation.vehicleSeat.id,
      ),
    );

    const reservationBySeatId = new Map(
      occupiedReservations.map(
        (reservation) => [
          reservation.vehicleSeat.id,
          reservation,
        ],
      ),
    );

    const availableSeatsCount = seats.filter(
      (seat) =>
        !occupiedSeatIds.has(seat.id),
    ).length;

    trip.availableSeatsCount =
      availableSeatsCount;

    await this.tripsRepository.save(trip);

    return seats.map((seat) => {
      const reservation =
        reservationBySeatId.get(seat.id);

      const isOccupied =
        occupiedSeatIds.has(seat.id);

      return {
        id: seat.id,
        seatNumber: seat.seatNumber,
        seatLabel: seat.seatLabel,
        seatType: seat.seatType,
        isAvailable: !isOccupied,
        status: isOccupied
          ? 'occupied'
          : 'available',
        reservationStatus:
          reservation?.reservationStatus ??
          null,
        expiresAt:
          reservation?.expiresAt ?? null,
      };
    });
  }

  async update(
    id: string,
    dto: UpdateTripDto,
  ): Promise<Trip> {
    const trip = await this.findOne(id);

    if (dto.routeId) {
      const route =
        await this.routesRepository.findOne({
          where: { id: dto.routeId },
        });

      if (!route) {
        throw new NotFoundException(
          'Rota não encontrada.',
        );
      }

      trip.route = route;
    }

    if (dto.vehicleId) {
      const vehicle =
        await this.vehiclesRepository.findOne({
          where: { id: dto.vehicleId },
          relations: {
            route: true,
            driver: true,
          },
        });

      if (!vehicle) {
        throw new NotFoundException(
          'Veículo não encontrado.',
        );
      }

      if (
        trip.route &&
        vehicle.route &&
        vehicle.route.id !== trip.route.id
      ) {
        throw new BadRequestException(
          'Este veículo não pertence à rota da viagem.',
        );
      }

      trip.vehicle = vehicle;

      if (!dto.driverId) {
        trip.driver =
          vehicle.driver ?? null;
      }
    }

    if (dto.driverId) {
      const driver =
        await this.usersRepository.findOne({
          where: { id: dto.driverId },
        });

      if (!driver) {
        throw new NotFoundException(
          'Motorista não encontrado.',
        );
      }

      if (driver.role !== Role.DRIVER) {
        throw new BadRequestException(
          'O usuário selecionado não possui perfil de motorista.',
        );
      }

      trip.driver = driver;
    }

    if (dto.departureMode !== undefined) {
      trip.departureMode =
        dto.departureMode;
    }

    if (dto.boardingDate !== undefined) {
      trip.boardingDate =
        dto.boardingDate;
    }

    if (
      dto.departureDatetime !== undefined
    ) {
      trip.departureDatetime =
        dto.departureDatetime
          ? new Date(dto.departureDatetime)
          : null;
    }

    if (
      dto.estimatedArrivalDatetime !==
      undefined
    ) {
      trip.estimatedArrivalDatetime =
        dto.estimatedArrivalDatetime
          ? new Date(
              dto.estimatedArrivalDatetime,
            )
          : null;
    }

    if (dto.baseFare !== undefined) {
      trip.baseFare = dto.baseFare;
    }

    if (dto.notes !== undefined) {
      trip.notes = dto.notes;
    }

    if (dto.status !== undefined) {
      trip.status = dto.status;
    }

    return this.tripsRepository.save(trip);
  }

  async cancel(id: string): Promise<Trip> {
    const trip = await this.findOne(id);

    trip.status = TripStatus.CANCELLED;

    return this.tripsRepository.save(trip);
  }

  async startBoarding(
    id: string,
    user?: any,
  ): Promise<Trip> {
    const trip = await this.findOne(id);

    await this.ensureDriverCanAccessTrip(
      trip,
      user,
    );

    if (
      trip.status !==
        TripStatus.SCHEDULED &&
      trip.status !==
        TripStatus.BOARDING
    ) {
      throw new BadRequestException(
        'A viagem não pode entrar em embarque neste estado.',
      );
    }

    trip.status = TripStatus.BOARDING;

    return this.tripsRepository.save(trip);
  }

  async startTrip(
    id: string,
    user?: any,
  ): Promise<Trip> {
    const trip = await this.findOne(id);

    await this.ensureDriverCanAccessTrip(
      trip,
      user,
    );

    if (
      trip.status !==
        TripStatus.SCHEDULED &&
      trip.status !==
        TripStatus.BOARDING
    ) {
      throw new BadRequestException(
        'A viagem só pode ser iniciada se estiver agendada ou em embarque.',
      );
    }

    trip.status = TripStatus.IN_PROGRESS;

    return this.tripsRepository.save(trip);
  }

  async complete(
    id: string,
    user?: any,
  ): Promise<Trip> {
    const trip = await this.findOne(id);

    await this.ensureDriverCanAccessTrip(
      trip,
      user,
    );

    if (
      trip.status !==
      TripStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        'A viagem só pode ser finalizada se estiver em andamento.',
      );
    }

    trip.status = TripStatus.COMPLETED;

    return this.tripsRepository.save(trip);
  }
}