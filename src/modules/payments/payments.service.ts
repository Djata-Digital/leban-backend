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
  PaymentStatus,
} from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import {
  Payment,
  PaymentRecordStatus,
} from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

/**
 * Serviço responsável pelas regras de pagamento.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,

    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Cria um registro inicial de pagamento.
   * No início, isso serve para pagamento manual/presencial.
   */
  async create(dto: CreatePaymentDto): Promise<Payment> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Reserva não encontrada.');
    }

    if (booking.bookingStatus === BookingStatus.CANCELLED) {
      throw new BadRequestException('Não é possível pagar uma reserva cancelada.');
    }

    if (booking.bookingStatus === BookingStatus.EXPIRED) {
      throw new BadRequestException('Não é possível pagar uma reserva expirada.');
    }

    const payment = this.paymentsRepository.create({
      booking,
      paymentMethod: dto.paymentMethod,
      amount: dto.amount,
      currencyCode: dto.currencyCode ?? 'XOF',
      providerName: dto.providerName ?? null,
      externalReference: dto.externalReference ?? null,
      paymentStatus: PaymentRecordStatus.PENDING,
    });

    return this.paymentsRepository.save(payment);
  }

  /**
   * Lista todos os pagamentos.
   */
  async findAll(): Promise<Payment[]> {
    return this.paymentsRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Busca pagamento pelo ID.
   */
  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado.');
    }

    return payment;
  }

  /**
   * Lista pagamentos de uma reserva.
   */
  async findByBooking(bookingId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: {
        booking: { id: bookingId },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Confirma pagamento.
   * Quando confirma, também atualiza o booking como pago e confirmado.
   */
  async confirm(id: string, dto: ConfirmPaymentDto): Promise<Payment> {
    const payment = await this.findOne(id);

    if (payment.paymentStatus === PaymentRecordStatus.PAID) {
      throw new BadRequestException('Este pagamento já foi confirmado.');
    }

    let receivedBy: User | null = null;

    if (dto.receivedByUserId) {
      receivedBy = await this.usersRepository.findOne({
        where: { id: dto.receivedByUserId },
      });

      if (!receivedBy) {
        throw new NotFoundException('Usuário recebedor não encontrado.');
      }
    }

    /**
     * Atualiza o pagamento.
     */
    payment.paymentStatus = PaymentRecordStatus.PAID;
    payment.receivedBy = receivedBy;
    payment.externalReference = dto.externalReference ?? payment.externalReference;
    payment.paidAt = new Date();

    /**
     * Atualiza também a reserva vinculada.
     */
    const booking = payment.booking;
    booking.paymentStatus = PaymentStatus.PAID;
    booking.bookingStatus = BookingStatus.CONFIRMED;
    booking.confirmedAt = new Date();

    await this.bookingsRepository.save(booking);

    return this.paymentsRepository.save(payment);
  }

  /**
   * Cancela um pagamento pendente.
   */
  async cancel(id: string): Promise<Payment> {
    const payment = await this.findOne(id);

    if (payment.paymentStatus === PaymentRecordStatus.PAID) {
      throw new BadRequestException('Pagamento confirmado não pode ser cancelado.');
    }

    payment.paymentStatus = PaymentRecordStatus.CANCELLED;

    return this.paymentsRepository.save(payment);
  }
}