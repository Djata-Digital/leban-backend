import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import {
  SeatReservation,
  SeatReservationStatus,
} from './entities/seat-reservation.entity';

import { CreateSeatReservationDto } from './dto/create-seat-reservation.dto';
import { Trip, TripStatus } from '../trips/entities/trip.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { VehicleSeat } from '../vehicle-seats/entities/vehicle-seat.entity';

import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class SeatReservationsService {
  constructor(
    @InjectRepository(SeatReservation)
    private readonly seatReservationsRepository: Repository<SeatReservation>,

    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,

    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,

    @InjectRepository(VehicleSeat)
    private readonly vehicleSeatsRepository: Repository<VehicleSeat>,

    private readonly notificationsService: NotificationsService,

    private readonly notificationsGateway: NotificationsGateway,

    private readonly dataSource: DataSource,
  ) {}

  private handleDuplicateSeatError(error: any): never {
    if (error?.code === '23505') {
      throw new BadRequestException(
        'Este assento acabou de ser reservado por outro passageiro. Escolha outro assento.',
      );
    }

    throw error;
  }

  private async expireOldReservationsInTransaction(
    manager: EntityManager,
  ): Promise<void> {
    const now = new Date();

    await manager
      .createQueryBuilder()
      .update(SeatReservation)
      .set({
        reservationStatus: SeatReservationStatus.EXPIRED,
        expiresAt: null,
      })
      .where('reservation_status = :status', {
        status: SeatReservationStatus.HELD,
      })
      .andWhere('expires_at IS NOT NULL')
      .andWhere('expires_at < :now', { now })
      .execute();
  }

  private async findAndLockVehicleSeat(
    manager: EntityManager,
    vehicleSeatId: string,
  ): Promise<VehicleSeat> {
    const vehicleSeatsRepository = manager.getRepository(VehicleSeat);

    const vehicleSeat = await vehicleSeatsRepository.findOne({
      where: { id: vehicleSeatId },
      relations: ['vehicle'],
    });

    if (!vehicleSeat) {
      throw new NotFoundException('Assento não encontrado.');
    }

    await vehicleSeatsRepository.findOne({
      where: { id: vehicleSeatId },
      lock: {
        mode: 'pessimistic_write',
      },
    });

    return vehicleSeat;
  }

  private async findActiveReservationWithLock(
    manager: EntityManager,
    tripId: string,
    vehicleSeatId: string,
  ): Promise<SeatReservation | null> {
    return manager
      .getRepository(SeatReservation)
      .createQueryBuilder('reservation')
      .where('reservation."tripId" = :tripId', { tripId })
      .andWhere('reservation."vehicleSeatId" = :vehicleSeatId', {
        vehicleSeatId,
      })
      .andWhere('reservation.reservation_status IN (:...statuses)', {
        statuses: [
          SeatReservationStatus.HELD,
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ],
      })
      .setLock('pessimistic_write')
      .getOne();
  }

  async holdSeat(dto: {
    tripId: string;
    vehicleSeatId: string;
  }): Promise<SeatReservation> {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const tripsRepository = manager.getRepository(Trip);
        const seatReservationsRepository =
          manager.getRepository(SeatReservation);

        const trip = await tripsRepository.findOne({
          where: { id: dto.tripId },
          relations: ['vehicle'],
        });

        if (!trip) {
          throw new NotFoundException('Viagem não encontrada.');
        }

        const vehicleSeat = await this.findAndLockVehicleSeat(
          manager,
          dto.vehicleSeatId,
        );

        if (vehicleSeat.vehicle.id !== trip.vehicle.id) {
          throw new BadRequestException(
            'Este assento não pertence ao veículo desta viagem.',
          );
        }

        await this.expireOldReservationsInTransaction(manager);

        const activeReservation = await this.findActiveReservationWithLock(
          manager,
          trip.id,
          vehicleSeat.id,
        );

        if (activeReservation) {
          throw new BadRequestException('Este assento já está ocupado.');
        }

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 1);

        const seatReservation = seatReservationsRepository.create({
          trip,
          vehicleSeat,
          booking: null,
          reservationStatus: SeatReservationStatus.HELD,
          reservedAt: new Date(),
          expiresAt,
        });

        const saved = await seatReservationsRepository.save(seatReservation);

        return {
          saved,
          tripId: trip.id,
          vehicleSeatId: vehicleSeat.id,
          expiresAt,
        };
      });

      await this.checkTripAutoStatus(result.tripId);

      this.sendSeatRealtimeUpdate({
        tripId: result.tripId,
        vehicleSeatId: result.vehicleSeatId,
        reservationStatus: SeatReservationStatus.HELD,
        isAvailable: false,
        expiresAt: result.expiresAt,
      });

      await this.sendTripRealtimeUpdate(result.tripId);

      return result.saved;
    } catch (error) {
      this.handleDuplicateSeatError(error);
    }
  }

  async releaseHeldSeat(dto: {
    tripId: string;
    vehicleSeatId: string;
  }): Promise<SeatReservation> {
    const reservation = await this.seatReservationsRepository.findOne({
      where: {
        trip: { id: dto.tripId },
        vehicleSeat: { id: dto.vehicleSeatId },
        reservationStatus: SeatReservationStatus.HELD,
      },
      relations: ['trip', 'vehicleSeat'],
    });

    if (!reservation) {
      throw new NotFoundException('Seleção temporária não encontrada.');
    }

    reservation.reservationStatus = SeatReservationStatus.RELEASED;
    reservation.expiresAt = null;

    const saved = await this.seatReservationsRepository.save(reservation);

    await this.checkTripAutoStatus(reservation.trip.id);

    this.sendSeatRealtimeUpdate({
      tripId: reservation.trip.id,
      vehicleSeatId: reservation.vehicleSeat?.id || dto.vehicleSeatId,
      reservationStatus: SeatReservationStatus.RELEASED,
      isAvailable: true,
      expiresAt: null,
    });

    await this.sendTripRealtimeUpdate(reservation.trip.id);

    return saved;
  }

  async reserveSeat(dto: CreateSeatReservationDto): Promise<SeatReservation> {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const tripsRepository = manager.getRepository(Trip);
        const bookingsRepository = manager.getRepository(Booking);
        const seatReservationsRepository =
          manager.getRepository(SeatReservation);

        const trip = await tripsRepository.findOne({
          where: { id: dto.tripId },
          relations: ['vehicle'],
        });

        if (!trip) {
          throw new NotFoundException('Viagem não encontrada.');
        }

        const booking = await bookingsRepository.findOne({
          where: { id: dto.bookingId },
          relations: ['trip', 'buyer'],
        });

        if (!booking) {
          throw new NotFoundException('Reserva principal não encontrada.');
        }

        if (booking.trip.id !== trip.id) {
          throw new BadRequestException(
            'Esta reserva não pertence à viagem informada.',
          );
        }

        const vehicleSeat = await this.findAndLockVehicleSeat(
          manager,
          dto.vehicleSeatId,
        );

        if (vehicleSeat.vehicle.id !== trip.vehicle.id) {
          throw new BadRequestException(
            'Este assento não pertence ao veículo desta viagem.',
          );
        }

        await this.expireOldReservationsInTransaction(manager);

        const activeReservation = await this.findActiveReservationWithLock(
          manager,
          trip.id,
          vehicleSeat.id,
        );

        if (activeReservation) {
          if (
            activeReservation.reservationStatus === SeatReservationStatus.HELD
          ) {
            activeReservation.booking = booking;
            activeReservation.reservationStatus =
              SeatReservationStatus.RESERVED;
            activeReservation.expiresAt = null;
            activeReservation.reservedAt = new Date();

            const saved =
              await seatReservationsRepository.save(activeReservation);

            return {
              saved,
              tripId: trip.id,
              vehicleSeatId: vehicleSeat.id,
            };
          }

          throw new BadRequestException(
            'Este assento já está reservado ou vendido.',
          );
        }

        const seatReservation = seatReservationsRepository.create({
          trip,
          booking,
          vehicleSeat,
          reservationStatus: SeatReservationStatus.RESERVED,
          reservedAt: new Date(),
          expiresAt: null,
        });

        const saved = await seatReservationsRepository.save(seatReservation);

        return {
          saved,
          tripId: trip.id,
          vehicleSeatId: vehicleSeat.id,
        };
      });

      await this.checkTripAutoStatus(result.tripId);

      this.sendSeatRealtimeUpdate({
        tripId: result.tripId,
        vehicleSeatId: result.vehicleSeatId,
        reservationStatus: SeatReservationStatus.RESERVED,
        isAvailable: false,
        expiresAt: null,
      });

      await this.sendTripRealtimeUpdate(result.tripId);

      return result.saved;
    } catch (error) {
      this.handleDuplicateSeatError(error);
    }
  }

  async findByTrip(tripId: string): Promise<SeatReservation[]> {
    await this.expireOldReservations();

    return this.seatReservationsRepository.find({
      where: {
        trip: { id: tripId },
      },
      relations: ['vehicleSeat', 'booking'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async confirmByBooking(bookingId: string): Promise<SeatReservation[]> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });

    if (!booking) {
      throw new NotFoundException('Reserva principal não encontrada.');
    }

    const reservations = await this.seatReservationsRepository.find({
      where: {
        booking: { id: bookingId },
        reservationStatus: SeatReservationStatus.RESERVED,
      },
      relations: ['vehicleSeat'],
    });

    if (reservations.length === 0) {
      throw new BadRequestException(
        'Nenhum assento reservado encontrado para confirmar.',
      );
    }

    for (const reservation of reservations) {
      reservation.reservationStatus = SeatReservationStatus.SOLD;
      reservation.soldAt = new Date();
      reservation.expiresAt = null;
    }

    booking.bookingStatus = BookingStatus.CONFIRMED;
    booking.confirmedAt = new Date();

    await this.bookingsRepository.save(booking);

    const saved = await this.seatReservationsRepository.save(reservations);

    await this.checkTripAutoStatus(booking.trip.id);

    for (const reservation of saved) {
      if (reservation.vehicleSeat?.id) {
        this.sendSeatRealtimeUpdate({
          tripId: booking.trip.id,
          vehicleSeatId: reservation.vehicleSeat.id,
          reservationStatus: SeatReservationStatus.SOLD,
          isAvailable: false,
          expiresAt: null,
        });
      }
    }

    await this.sendTripRealtimeUpdate(booking.trip.id);

    return saved;
  }

  async cancelByBooking(bookingId: string): Promise<SeatReservation[]> {
    const reservations = await this.seatReservationsRepository.find({
      where: {
        booking: { id: bookingId },
        reservationStatus: In([
          SeatReservationStatus.HELD,
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
      relations: ['trip', 'vehicleSeat'],
    });

    if (reservations.length === 0) {
      throw new BadRequestException(
        'Nenhum assento reservado encontrado para cancelar.',
      );
    }

    const tripId = reservations[0].trip.id;

    for (const reservation of reservations) {
      reservation.reservationStatus = SeatReservationStatus.CANCELLED;
      reservation.cancelledAt = new Date();
      reservation.expiresAt = null;
    }

    const saved = await this.seatReservationsRepository.save(reservations);

    await this.checkTripAutoStatus(tripId);

    for (const reservation of saved) {
      if (reservation.vehicleSeat?.id) {
        this.sendSeatRealtimeUpdate({
          tripId,
          vehicleSeatId: reservation.vehicleSeat.id,
          reservationStatus: SeatReservationStatus.CANCELLED,
          isAvailable: true,
          expiresAt: null,
        });
      }
    }

    await this.sendTripRealtimeUpdate(tripId);

    return saved;
  }

  async expireOldReservations(): Promise<SeatReservation[]> {
    const now = new Date();

    const expiredReservations = await this.seatReservationsRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.trip', 'trip')
      .leftJoinAndSelect('reservation.vehicleSeat', 'vehicleSeat')
      .where('reservation.reservationStatus = :status', {
        status: SeatReservationStatus.HELD,
      })
      .andWhere('reservation.expiresAt IS NOT NULL')
      .andWhere('reservation.expiresAt < :now', { now })
      .getMany();

    const affectedTripIds = new Set<string>();

    for (const reservation of expiredReservations) {
      reservation.reservationStatus = SeatReservationStatus.EXPIRED;
      reservation.expiresAt = null;

      if (reservation.trip?.id) {
        affectedTripIds.add(reservation.trip.id);
      }
    }

    const saved =
      expiredReservations.length > 0
        ? await this.seatReservationsRepository.save(expiredReservations)
        : [];

    for (const tripId of affectedTripIds) {
      await this.checkTripAutoStatus(tripId);
    }

    for (const reservation of saved) {
      if (reservation.trip?.id && reservation.vehicleSeat?.id) {
        this.sendSeatRealtimeUpdate({
          tripId: reservation.trip.id,
          vehicleSeatId: reservation.vehicleSeat.id,
          reservationStatus: SeatReservationStatus.EXPIRED,
          isAvailable: true,
          expiresAt: null,
        });
      }
    }

    for (const tripId of affectedTripIds) {
      await this.sendTripRealtimeUpdate(tripId);
    }

    return saved;
  }

  private async checkTripAutoStatus(tripId: string): Promise<void> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId },
      relations: ['vehicle', 'route'],
    });

    if (!trip) {
      return;
    }

    const totalSeats = await this.vehicleSeatsRepository.count({
      where: {
        vehicle: { id: trip.vehicle.id },
        active: true,
      },
    });

    const occupiedSeats = await this.seatReservationsRepository.count({
      where: {
        trip: { id: trip.id },
        reservationStatus: In([
          SeatReservationStatus.HELD,
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
    });

    const availableSeats = Math.max(totalSeats - occupiedSeats, 0);

    trip.availableSeatsCount = availableSeats;

    const previousStatus = trip.status;

    if (
      trip.status === TripStatus.CANCELLED ||
      trip.status === TripStatus.COMPLETED
    ) {
      await this.tripsRepository.save(trip);
      return;
    }

    if (availableSeats === 0) {
      trip.status = TripStatus.IN_PROGRESS;
    } else if (availableSeats <= 2) {
      trip.status = TripStatus.BOARDING;
    } else if (
      trip.status === TripStatus.BOARDING ||
      trip.status === TripStatus.IN_PROGRESS
    ) {
      trip.status = TripStatus.SCHEDULED;
    }

    await this.tripsRepository.save(trip);

    if (previousStatus !== trip.status) {
      if (trip.status === TripStatus.BOARDING) {
        await this.notifyTripUsers(
          trip.id,
          'Carro quase saindo',
          `A viagem ${trip.route?.originName} → ${trip.route?.destinationName} está quase lotada. Faltam ${availableSeats} lugares.`,
        );
      }

      if (trip.status === TripStatus.IN_PROGRESS) {
        await this.notifyTripUsers(
          trip.id,
          'Viagem iniciada',
          `A viagem ${trip.route?.originName} → ${trip.route?.destinationName} já foi iniciada.`,
        );
      }
    }
  }

  private async notifyTripUsers(
    tripId: string,
    title: string,
    message: string,
  ): Promise<void> {
    const reservations = await this.seatReservationsRepository.find({
      where: {
        trip: { id: tripId },
        reservationStatus: In([
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
      relations: ['booking', 'booking.buyer'],
    });

    const notifiedUserIds = new Set<string>();

    for (const reservation of reservations) {
      const userId = reservation.booking?.buyer?.id;

      if (!userId || notifiedUserIds.has(userId)) {
        continue;
      }

      notifiedUserIds.add(userId);

      await this.notificationsService.create({
        userId,
        title,
        message,
      });
    }
  }

  private sendSeatRealtimeUpdate(payload: {
    tripId: string;
    vehicleSeatId: string;
    reservationStatus: SeatReservationStatus | string;
    isAvailable: boolean;
    expiresAt?: Date | null;
  }): void {
    this.notificationsGateway.sendSeatUpdateToTrip(payload.tripId, {
      tripId: payload.tripId,
      vehicleSeatId: payload.vehicleSeatId,
      reservationStatus: payload.reservationStatus,
      isAvailable: payload.isAvailable,
      expiresAt: payload.expiresAt ?? null,
    });
  }

  private async sendTripRealtimeUpdate(tripId: string): Promise<void> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId },
      relations: ['route', 'vehicle'],
    });

    if (!trip) return;

    this.notificationsGateway.sendTripUpdate(tripId, {
      tripId,
      status: trip.status,
      availableSeatsCount: trip.availableSeatsCount,
    });
  }
}