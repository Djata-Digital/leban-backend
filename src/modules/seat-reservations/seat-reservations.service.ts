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
  ) {}

  async reserveSeat(dto: CreateSeatReservationDto): Promise<SeatReservation> {
    const trip = await this.tripsRepository.findOne({
      where: { id: dto.tripId },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    const booking = await this.bookingsRepository.findOne({
      where: { id: dto.bookingId },
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

    const activeReservation = await this.seatReservationsRepository.findOne({
      where: {
        trip: { id: trip.id },
        vehicleSeat: { id: vehicleSeat.id },
        reservationStatus: In([
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
    });

    if (activeReservation) {
      throw new BadRequestException('Este assento já está reservado ou vendido.');
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const seatReservation = this.seatReservationsRepository.create({
      trip,
      booking,
      vehicleSeat,
      reservationStatus: SeatReservationStatus.RESERVED,
      reservedAt: new Date(),
      expiresAt,
    });

    const saved = await this.seatReservationsRepository.save(seatReservation);

    await this.checkTripAutoStatus(trip.id);

    return saved;
  }

  async findByTrip(tripId: string): Promise<SeatReservation[]> {
    return this.seatReservationsRepository.find({
      where: {
        trip: { id: tripId },
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async confirmByBooking(bookingId: string): Promise<SeatReservation[]> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Reserva principal não encontrada.');
    }

    const reservations = await this.seatReservationsRepository.find({
      where: {
        booking: { id: bookingId },
        reservationStatus: SeatReservationStatus.RESERVED,
      },
    });

    if (reservations.length === 0) {
      throw new BadRequestException(
        'Nenhum assento reservado encontrado para confirmar.',
      );
    }

    for (const reservation of reservations) {
      reservation.reservationStatus = SeatReservationStatus.SOLD;
      reservation.soldAt = new Date();
    }

    booking.bookingStatus = BookingStatus.CONFIRMED;
    booking.confirmedAt = new Date();

    await this.bookingsRepository.save(booking);

    const saved = await this.seatReservationsRepository.save(reservations);

    await this.checkTripAutoStatus(booking.trip.id);

    return saved;
  }

  async cancelByBooking(bookingId: string): Promise<SeatReservation[]> {
    const reservations = await this.seatReservationsRepository.find({
      where: {
        booking: { id: bookingId },
        reservationStatus: In([
          SeatReservationStatus.RESERVED,
          SeatReservationStatus.SOLD,
        ]),
      },
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
    }

    const saved = await this.seatReservationsRepository.save(reservations);

    await this.checkTripAutoStatus(tripId);

    return saved;
  }

  async expireOldReservations(): Promise<SeatReservation[]> {
    const now = new Date();

    const expiredReservations = await this.seatReservationsRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.booking', 'booking')
      .leftJoinAndSelect('reservation.trip', 'trip')
      .where('reservation.reservationStatus = :status', {
        status: SeatReservationStatus.RESERVED,
      })
      .andWhere('reservation.expiresAt IS NOT NULL')
      .andWhere('reservation.expiresAt < :now', { now })
      .getMany();

    const affectedTripIds = new Set<string>();

    for (const reservation of expiredReservations) {
      reservation.reservationStatus = SeatReservationStatus.EXPIRED;

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

    return saved;
  }

  private async checkTripAutoStatus(tripId: string): Promise<void> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId },
      relations: ['vehicle'],
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
      relations: ['booking'],
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
}