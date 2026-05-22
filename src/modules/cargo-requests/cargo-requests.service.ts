import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Booking,
  BookingStatus,
} from '../bookings/entities/booking.entity';

import { User } from '../users/entities/user.entity';

import { SellerRoute } from '../seller-routes/entities/seller-route.entity';

import {
  CargoRequest,
  CargoRequestStatus,
} from './entities/cargo-request.entity';

import { CreateCargoRequestDto } from './dto/create-cargo-request.dto';
import { ReviewCargoRequestDto } from './dto/review-cargo-request.dto';

import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationChannel,
  NotificationType,
} from '../notifications/entities/notification.entity';

@Injectable()
export class CargoRequestsService {
  constructor(
    @InjectRepository(CargoRequest)
    private readonly cargoRepository: Repository<CargoRequest>,

    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(SellerRoute)
    private readonly sellerRoutesRepository: Repository<SellerRoute>,

    private readonly notificationsService: NotificationsService,
  ) {}

  private parseOptionalNumber(value: unknown): number | null {
    if (value === undefined || value === null) return null;

    const text = String(value).trim();

    if (!text) return null;

    const numberValue = Number(text.replace(',', '.'));

    if (Number.isNaN(numberValue)) return null;

    return numberValue;
  }

  private async recalculateBookingTotal(booking: Booking): Promise<void> {
    booking.totalAmount =
      Number(booking.subtotalAmount || 0) +
      Number(booking.systemFeeAmount || 0) +
      Number(booking.cargoAmount || 0) -
      Number(booking.discountAmount || 0);

    booking.grossAmount = booking.totalAmount;

    await this.bookingsRepository.save(booking);
  }

  private async notifySellersAboutPendingCargo(
    booking: Booking,
    cargo: CargoRequest,
  ): Promise<void> {
    const notifiedSellerIds = new Set<string>();

    async function addSellerId(sellerId?: string | null) {
      if (!sellerId) return;
      notifiedSellerIds.add(sellerId);
    }

    // 1. Notifica o vendedor ligado diretamente à reserva, se existir
    await addSellerId(booking.seller?.id);

    // 2. Notifica todos os vendedores autorizados para a rota/tipo do veículo
    const routeId = booking.trip?.route?.id;
    const vehicleType = booking.trip?.vehicle?.vehicleType;

    if (routeId && vehicleType) {
      const sellerRoutes = await this.sellerRoutesRepository.find({
        where: {
          route: { id: routeId },
          vehicleType,
        },
        relations: {
          seller: true,
          route: true,
        },
      });

      for (const sellerRoute of sellerRoutes) {
        await addSellerId(sellerRoute.seller?.id);
      }
    }

    console.log('VENDEDORES QUE RECEBERÃO NOTIFICAÇÃO DE CARGA:', [
      ...notifiedSellerIds,
    ]);

    for (const sellerId of notifiedSellerIds) {
      await this.notificationsService.create({
        userId: sellerId,
        title: 'Nova carga pendente',
        message: `Existe uma nova carga para analisar na reserva ${
          booking.bookingCode || booking.id
        }.`,
        notificationType: NotificationType.SYSTEM,
        deliveryChannel: NotificationChannel.IN_APP,
      });
    }
  }

  private async notifyPassengerCargoReviewed(
    booking: Booking,
    cargoStatus: CargoRequestStatus,
    finalPrice?: number | null,
  ): Promise<void> {
    const passengerId = booking.buyer?.id;

    if (!passengerId) return;

    if (cargoStatus === CargoRequestStatus.APPROVED) {
      await this.notificationsService.create({
        userId: passengerId,
        title: 'Carga aprovada',
        message: `Sua carga foi aprovada. Preço final: ${Number(
          finalPrice || 0,
        ).toLocaleString()} XOF.`,
        notificationType: NotificationType.SYSTEM,
        deliveryChannel: NotificationChannel.IN_APP,
      });

      return;
    }

    if (cargoStatus === CargoRequestStatus.REJECTED) {
      await this.notificationsService.create({
        userId: passengerId,
        title: 'Carga rejeitada',
        message:
          'Sua carga foi rejeitada pela operação. A reserva seguirá sem valor de carga.',
        notificationType: NotificationType.SYSTEM,
        deliveryChannel: NotificationChannel.IN_APP,
      });
    }
  }

  async create(dto: CreateCargoRequestDto): Promise<CargoRequest> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: dto.bookingId },
      relations: {
        buyer: true,
        seller: true,
        trip: {
          route: true,
          vehicle: true,
          driver: true,
        },
        boardingPoint: true,
        dropoffPoint: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva não encontrada.');
    }

    if (
      booking.bookingStatus === BookingStatus.CANCELLED ||
      booking.bookingStatus === BookingStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Não é possível adicionar carga a uma reserva cancelada ou expirada.',
      );
    }

    const existingCargo = await this.cargoRepository.findOne({
      where: {
        booking: { id: booking.id },
      },
    });

    if (existingCargo) {
      throw new BadRequestException('Esta reserva já possui pedido de carga.');
    }

    const estimatedWeightKg = this.parseOptionalNumber(dto.estimatedWeightKg);
    const finalPrice = this.parseOptionalNumber(dto.finalPrice);

    const hasFinalPrice = finalPrice !== null && finalPrice >= 0;

    const cargo = this.cargoRepository.create({
      booking,
      cargoDescription: dto.cargoDescription,
      estimatedWeightKg,
      photoUrl: dto.photoUrl ?? null,
      finalPrice,
      cargoStatus: hasFinalPrice
        ? CargoRequestStatus.APPROVED
        : CargoRequestStatus.PENDING_REVIEW,
      passengerAccepted: hasFinalPrice ? true : null,
      passengerAcceptedAt: hasFinalPrice ? new Date() : null,
      passengerRejectedAt: null,
      reviewedAt: hasFinalPrice ? new Date() : null,
      reviewNote: hasFinalPrice
        ? 'Carga aprovada durante o fluxo de venda.'
        : null,
    });

    const savedCargo = await this.cargoRepository.save(cargo);

    if (hasFinalPrice) {
      booking.cargoAmount = finalPrice;
      await this.recalculateBookingTotal(booking);
    } else {
      await this.notifySellersAboutPendingCargo(booking, savedCargo);
    }

    return savedCargo;
  }

  async findAll(): Promise<CargoRequest[]> {
    return this.cargoRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findPending(): Promise<CargoRequest[]> {
    return this.cargoRepository.find({
      where: {
        cargoStatus: CargoRequestStatus.PENDING_REVIEW,
      },
      relations: {
        booking: {
          buyer: true,
          seller: true,
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          boardingPoint: true,
          dropoffPoint: true,
        },
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<CargoRequest> {
    const cargo = await this.cargoRepository.findOne({
      where: { id },
      relations: {
        booking: {
          buyer: true,
          seller: true,
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          boardingPoint: true,
          dropoffPoint: true,
        },
        reviewedBy: true,
      },
    });

    if (!cargo) {
      throw new NotFoundException('Pedido de carga não encontrado.');
    }

    return cargo;
  }

  async findByBooking(bookingId: string): Promise<CargoRequest | null> {
    return this.cargoRepository.findOne({
      where: {
        booking: { id: bookingId },
      },
      relations: {
        booking: {
          buyer: true,
          seller: true,
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
        },
      },
    });
  }

  async review(id: string, dto: ReviewCargoRequestDto): Promise<CargoRequest> {
    const cargo = await this.findOne(id);

    if (cargo.cargoStatus !== CargoRequestStatus.PENDING_REVIEW) {
      throw new BadRequestException('Este pedido de carga já foi revisado.');
    }

    if (
      dto.cargoStatus === CargoRequestStatus.APPROVED &&
      (dto.finalPrice === undefined || dto.finalPrice === null)
    ) {
      throw new BadRequestException(
        'Para aprovar a carga, informe o preço final.',
      );
    }

    let reviewedBy: User | null = null;

    if (dto.reviewedByUserId) {
      reviewedBy = await this.usersRepository.findOne({
        where: { id: dto.reviewedByUserId },
      });

      if (!reviewedBy) {
        throw new NotFoundException('Usuário revisor não encontrado.');
      }
    }

    const finalPrice = this.parseOptionalNumber(dto.finalPrice);

    cargo.cargoStatus = dto.cargoStatus;
    cargo.finalPrice = finalPrice;
    cargo.reviewedBy = reviewedBy;
    cargo.reviewedAt = new Date();
    cargo.reviewNote = dto.reviewNote ?? null;

    cargo.passengerAccepted = null;
    cargo.passengerAcceptedAt = null;
    cargo.passengerRejectedAt = null;

    const booking = cargo.booking;

    if (dto.cargoStatus === CargoRequestStatus.APPROVED) {
      if (finalPrice === null || finalPrice < 0) {
        throw new BadRequestException(
          'Para aprovar a carga, informe um preço final válido.',
        );
      }

      booking.cargoAmount = finalPrice;

      await this.recalculateBookingTotal(booking);
      await this.notifyPassengerCargoReviewed(
        booking,
        CargoRequestStatus.APPROVED,
        finalPrice,
      );
    }

    if (dto.cargoStatus === CargoRequestStatus.REJECTED) {
      booking.cargoAmount = 0;

      await this.recalculateBookingTotal(booking);
      await this.notifyPassengerCargoReviewed(
        booking,
        CargoRequestStatus.REJECTED,
        null,
      );
    }

    return this.cargoRepository.save(cargo);
  }

  async passengerAccept(id: string): Promise<CargoRequest> {
    const cargo = await this.findOne(id);

    if (cargo.cargoStatus !== CargoRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Só é possível aceitar uma carga aprovada pela operação.',
      );
    }

    if (cargo.finalPrice === null || cargo.finalPrice === undefined) {
      throw new BadRequestException(
        'Esta carga ainda não possui preço final definido.',
      );
    }

    cargo.passengerAccepted = true;
    cargo.passengerAcceptedAt = new Date();
    cargo.passengerRejectedAt = null;

    const booking = cargo.booking;

    booking.cargoAmount = Number(cargo.finalPrice || 0);

    await this.recalculateBookingTotal(booking);

    return this.cargoRepository.save(cargo);
  }

  async passengerReject(id: string): Promise<CargoRequest> {
    const cargo = await this.findOne(id);

    if (cargo.cargoStatus !== CargoRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Só é possível recusar uma carga aprovada pela operação.',
      );
    }

    cargo.passengerAccepted = false;
    cargo.passengerAcceptedAt = null;
    cargo.passengerRejectedAt = new Date();
    cargo.cargoStatus = CargoRequestStatus.CANCELLED;
    cargo.reviewNote =
      cargo.reviewNote ||
      'Carga cancelada porque o passageiro recusou o preço.';

    const booking = cargo.booking;

    booking.cargoAmount = 0;

    await this.recalculateBookingTotal(booking);

    return this.cargoRepository.save(cargo);
  }

  async cancel(id: string): Promise<CargoRequest> {
    const cargo = await this.findOne(id);

    if (cargo.cargoStatus !== CargoRequestStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Só é possível cancelar carga ainda pendente.',
      );
    }

    cargo.cargoStatus = CargoRequestStatus.CANCELLED;
    cargo.passengerAccepted = false;
    cargo.passengerRejectedAt = new Date();

    const booking = cargo.booking;

    booking.cargoAmount = 0;

    await this.recalculateBookingTotal(booking);

    return this.cargoRepository.save(cargo);
  }
}