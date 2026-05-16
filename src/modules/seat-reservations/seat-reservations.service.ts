import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

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
  ) {}

  /**
   * Segura temporariamente um assento por 3 minutos.
   * Isso acontece quando o passageiro toca no assento, antes de confirmar a reserva.
   */
  async holdSeat(dto: {
    tripId: string;
    vehicleSeatId: string;
  }): Promise<SeatReservation> {
    const trip = await this.tripsRepository.findOne({
      where: { id: dto.tripId },
      relations: ['vehicle'],
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    const vehicleSeat = await this.vehicleSeatsRepository.findOne({
      where: { id: dto.vehicleSeatId },
      relations: ['vehicle'],
    });

    if (!vehicleSeat) {
      throw new NotFoundException('Assento não encontrado.');
    }

    if (vehicleSeat.vehicle.id !== trip.vehicle.id) {
      throw new BadRequestException(
        'Este assento não pertence ao veículo desta viagem.',
      );
    }

    await this.expireOldReservations();

    const activeReservation = await this.seatReservationsRepository.findOne({
      where: {
        trip: { id: trip.id },
        vehicleSeat: { id: vehicleSeat.id },
        reservationStatus: In([
          SeatReservationStatus.HELD,
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
    });

    if (activeReservation) {
      throw new BadRequestException('Este assento já está ocupado.');
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 1);

    const seatReservation = this.seatReservationsRepository.create({
      trip,
      vehicleSeat,
      booking: null,
      reservationStatus: SeatReservationStatus.HELD,
      reservedAt: new Date(),
      expiresAt,
    });

    const saved = await this.seatReservationsRepository.save(seatReservation);

    await this.checkTripAutoStatus(trip.id);

    this.sendSeatRealtimeUpdate({
      tripId: trip.id,
      vehicleSeatId: vehicleSeat.id,
      reservationStatus: SeatReservationStatus.HELD,
      isAvailable: false,
      expiresAt,
    });

    await this.sendTripRealtimeUpdate(trip.id);

    return saved;
  }

  /**
   * Libera uma seleção temporária antes da confirmação.
   */
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

  /**
   * Reserva definitivamente o assento depois que a reserva principal já foi criada.
   *
   * Se existir HELD para o mesmo assento, ele vira RESERVED.
   * Se não existir HELD, cria RESERVED diretamente.
   */
  async reserveSeat(dto: CreateSeatReservationDto): Promise<SeatReservation> {
    const trip = await this.tripsRepository.findOne({
      where: { id: dto.tripId },
      relations: ['vehicle'],
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    const booking = await this.bookingsRepository.findOne({
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

    const vehicleSeat = await this.vehicleSeatsRepository.findOne({
      where: { id: dto.vehicleSeatId },
      relations: ['vehicle'],
    });

    if (!vehicleSeat) {
      throw new NotFoundException('Assento não encontrado.');
    }

    if (vehicleSeat.vehicle.id !== trip.vehicle.id) {
      throw new BadRequestException(
        'Este assento não pertence ao veículo desta viagem.',
      );
    }

    await this.expireOldReservations();

    const finalReservation = await this.seatReservationsRepository.findOne({
      where: {
        trip: { id: trip.id },
        vehicleSeat: { id: vehicleSeat.id },
        reservationStatus: In([
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
    });

    if (finalReservation) {
      throw new BadRequestException('Este assento já está reservado ou vendido.');
    }

    const heldReservation = await this.seatReservationsRepository.findOne({
      where: {
        trip: { id: trip.id },
        vehicleSeat: { id: vehicleSeat.id },
        reservationStatus: SeatReservationStatus.HELD,
      },
      relations: ['vehicleSeat'],
    });

    if (heldReservation) {
      heldReservation.booking = booking;
      heldReservation.reservationStatus = SeatReservationStatus.RESERVED;
      heldReservation.expiresAt = null;
      heldReservation.reservedAt = new Date();

      const saved = await this.seatReservationsRepository.save(heldReservation);

      await this.checkTripAutoStatus(trip.id);

      this.sendSeatRealtimeUpdate({
        tripId: trip.id,
        vehicleSeatId: vehicleSeat.id,
        reservationStatus: SeatReservationStatus.RESERVED,
        isAvailable: false,
        expiresAt: null,
      });

      await this.sendTripRealtimeUpdate(trip.id);

      return saved;
    }

    const seatReservation = this.seatReservationsRepository.create({
      trip,
      booking,
      vehicleSeat,
      reservationStatus: SeatReservationStatus.RESERVED,
      reservedAt: new Date(),
      expiresAt: null,
    });

    const saved = await this.seatReservationsRepository.save(seatReservation);

    await this.checkTripAutoStatus(trip.id);

    this.sendSeatRealtimeUpdate({
      tripId: trip.id,
      vehicleSeatId: vehicleSeat.id,
      reservationStatus: SeatReservationStatus.RESERVED,
      isAvailable: false,
      expiresAt: null,
    });

    await this.sendTripRealtimeUpdate(trip.id);

    return saved;
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

  /**
   * Expira apenas seleções temporárias HELD.
   * Nunca expira RESERVED ou SOLD.
   */
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