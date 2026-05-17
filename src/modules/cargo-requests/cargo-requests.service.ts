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

import {
  CargoRequest,
  CargoRequestStatus,
} from './entities/cargo-request.entity';

import { CreateCargoRequestDto } from './dto/create-cargo-request.dto';
import { ReviewCargoRequestDto } from './dto/review-cargo-request.dto';

/**
 * Serviço responsável pela lógica de carga/bagagem.
 */
@Injectable()
export class CargoRequestsService {
  constructor(
    @InjectRepository(CargoRequest)
    private readonly cargoRepository: Repository<CargoRequest>,

    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Converte valores vindos do multipart/form-data para número.
   * Se vier vazio, null ou inválido, retorna null.
   */
  private parseOptionalNumber(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    const text = String(value).trim();

    if (!text) {
      return null;
    }

    const numberValue = Number(text.replace(',', '.'));

    if (Number.isNaN(numberValue)) {
      return null;
    }

    return numberValue;
  }

  /**
   * Recalcula o total da reserva.
   */
  private async recalculateBookingTotal(booking: Booking): Promise<void> {
    booking.totalAmount =
      Number(booking.subtotalAmount || 0) +
      Number(booking.systemFeeAmount || 0) +
      Number(booking.cargoAmount || 0) -
      Number(booking.discountAmount || 0);

    booking.grossAmount = booking.totalAmount;

    await this.bookingsRepository.save(booking);
  }

  /**
   * Cria um pedido de carga ligado a uma reserva.
   */
  async create(dto: CreateCargoRequestDto): Promise<CargoRequest> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: dto.bookingId },
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

    /**
     * Se já veio preço da carga, atualiza os valores da reserva.
     * Isso acontece no fluxo do vendedor.
     */
    if (hasFinalPrice) {
      booking.cargoAmount = finalPrice;
      await this.recalculateBookingTotal(booking);
    }

    return savedCargo;
  }

  /**
   * Lista todos os pedidos de carga.
   */
  async findAll(): Promise<CargoRequest[]> {
    return this.cargoRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Lista pedidos pendentes de revisão.
   */
  async findPending(): Promise<CargoRequest[]> {
    return this.cargoRepository.find({
      where: {
        cargoStatus: CargoRequestStatus.PENDING_REVIEW,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Busca pedido de carga por ID.
   */
  async findOne(id: string): Promise<CargoRequest> {
    const cargo = await this.cargoRepository.findOne({
      where: { id },
    });

    if (!cargo) {
      throw new NotFoundException('Pedido de carga não encontrado.');
    }

    return cargo;
  }

  /**
   * Busca carga por reserva.
   */
  async findByBooking(bookingId: string): Promise<CargoRequest | null> {
    return this.cargoRepository.findOne({
      where: {
        booking: { id: bookingId },
      },
    });
  }

  /**
   * Aprova ou rejeita o pedido de carga pela operação/vendedor.
   */
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

    /**
     * Quando o vendedor aprova, o passageiro ainda precisa aceitar.
     * Por isso passengerAccepted continua null.
     */
    cargo.passengerAccepted = null;
    cargo.passengerAcceptedAt = null;
    cargo.passengerRejectedAt = null;

    if (dto.cargoStatus === CargoRequestStatus.APPROVED) {
      if (finalPrice === null || finalPrice < 0) {
        throw new BadRequestException(
          'Para aprovar a carga, informe um preço final válido.',
        );
      }

      const booking = cargo.booking;

      booking.cargoAmount = finalPrice;

      await this.recalculateBookingTotal(booking);
    }

    /**
     * Se vendedor rejeitar, remove valor da carga da reserva.
     */
    if (dto.cargoStatus === CargoRequestStatus.REJECTED) {
      const booking = cargo.booking;

      booking.cargoAmount = 0;

      await this.recalculateBookingTotal(booking);
    }

    return this.cargoRepository.save(cargo);
  }

  /**
   * Passageiro aceita o preço da carga aprovado pelo vendedor/operação.
   */
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

  /**
   * Passageiro recusa o preço da carga.
   *
   * A carga passa para CANCELLED, o valor da carga é removido
   * da reserva, e o passageiro pode seguir apenas com a passagem.
   */
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

  /**
   * Cancela um pedido de carga ainda pendente.
   */
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