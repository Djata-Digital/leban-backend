import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Ticket, TicketStatus } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ValidateTicketDto } from './dto/validate-ticket.dto';

import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../bookings/entities/booking.entity';

import {
  SeatReservation,
} from '../seat-reservations/entities/seat-reservation.entity';

import { Role } from '../../common/enums/role.enum';

type CurrentUser = {
  id?: string;
  sub?: string;
  role?: Role;
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,

    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,

    @InjectRepository(SeatReservation)
    private readonly seatReservationsRepository: Repository<SeatReservation>,
  ) {}

  private getUserId(user?: CurrentUser): string | undefined {
    return user?.id || user?.sub;
  }

  /**
   * Emite bilhete da reserva.
   */
  async issueTicket(dto: CreateTicketDto): Promise<Ticket> {
    const booking = await this.bookingsRepository.findOne({
      where: {
        id: dto.bookingId,
      },
      relations: {
        trip: {
          route: true,
          vehicle: true,
          driver: true,
        },
        buyer: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva não encontrada.');
    }

    if (booking.bookingStatus !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Só é possível emitir bilhete para reserva confirmada.',
      );
    }

    if (booking.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        'Só é possível emitir bilhete para pagamento confirmado.',
      );
    }

    /**
     * Evita criar dois bilhetes para mesma reserva.
     */
    const existingTicket = await this.ticketsRepository.findOne({
      where: {
        booking: {
          id: booking.id,
        },
      },
      relations: {
        booking: {
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          buyer: true,
        },
      },
    });

    if (existingTicket) {
      return this.attachSeats(existingTicket);
    }

    const seatReservations = await this.seatReservationsRepository.find({
      where: {
        booking: {
          id: booking.id,
        },
      },
      relations: {
        vehicleSeat: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    const seatLabels = seatReservations
      .map((reservation) => reservation.vehicleSeat?.seatLabel)
      .filter(Boolean);

    const ticketNumber = this.generateTicketNumber();
    const validationCode = this.generateValidationCode();

    /**
     * Dados embutidos no QR Code.
     */
    const qrCodeValue = JSON.stringify({
      ticketNumber,
      validationCode,

      bookingId: booking.id,
      bookingCode: booking.bookingCode,

      passengerName: booking.passengerName,

      seats: seatLabels,

      ticketAmount: booking.ticketAmount,
      systemFeeAmount: booking.systemFeeAmount,
      cargoAmount: booking.cargoAmount,
      totalAmount: booking.totalAmount,
    });

    const ticket = this.ticketsRepository.create({
      booking,
      ticketNumber,
      validationCode,
      qrCodeValue,
      ticketStatus: TicketStatus.ISSUED,
    });

    const savedTicket = await this.ticketsRepository.save(ticket);

    return {
      ...savedTicket,
      booking,
      seatReservations,
    } as Ticket & {
      seatReservations: SeatReservation[];
    };
  }

  /**
   * Lista todos os bilhetes.
   */
  async findAll(): Promise<Ticket[]> {
    const tickets = await this.ticketsRepository.find({
      relations: {
        booking: {
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          buyer: true,
        },
      },
      order: {
        issuedAt: 'DESC',
      },
    });

    return Promise.all(
      tickets.map((ticket) => this.attachSeats(ticket)),
    );
  }

  /**
   * Busca bilhete por ID.
   */
  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: {
        id,
      },
      relations: {
        booking: {
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          buyer: true,
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Bilhete não encontrado.');
    }

    return this.attachSeats(ticket);
  }

  /**
   * Busca bilhete pela reserva.
   */
  async findByBooking(bookingId: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: {
        booking: {
          id: bookingId,
        },
      },
      relations: {
        booking: {
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          buyer: true,
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(
        'Bilhete não encontrado para esta reserva.',
      );
    }

    return this.attachSeats(ticket);
  }

  /**
   * Busca bilhete pelo código de validação.
   */
  async findByValidationCode(
    validationCode: string,
  ): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: {
        validationCode,
      },
      relations: {
        booking: {
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
          buyer: true,
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Bilhete não encontrado.');
    }

    return this.attachSeats(ticket);
  }

  /**
   * Validação manual.
   */
  async validateTicket(
    dto: ValidateTicketDto,
    currentUser?: CurrentUser,
  ): Promise<Ticket> {
    const ticket = await this.findByValidationCode(
      dto.validationCode,
    );

    await this.ensureDriverCanValidate(
      ticket,
      currentUser,
    );

    if (ticket.ticketStatus === TicketStatus.USED) {
      throw new BadRequestException(
        'Este bilhete já foi utilizado.',
      );
    }

    if (ticket.ticketStatus !== TicketStatus.ISSUED) {
      throw new BadRequestException(
        'Este bilhete não está válido para embarque.',
      );
    }

    ticket.ticketStatus = TicketStatus.USED;
    ticket.validatedAt = new Date();

    if (ticket.booking) {
      ticket.booking.boardedAt = new Date();

      await this.bookingsRepository.save(
        ticket.booking,
      );
    }

    await this.ticketsRepository.save(ticket);

    return this.findByValidationCode(
      dto.validationCode,
    );
  }

  /**
   * Scanner QR do motorista.
   */
  async scanTicket(
    qrCodeValue: string,
    currentUser?: CurrentUser,
  ) {
    if (!qrCodeValue) {
      throw new BadRequestException(
        'QR Code inválido.',
      );
    }

    const parsed = this.parseQrCode(qrCodeValue);

    const validationCode =
      parsed.validationCode || qrCodeValue;

    const ticket = await this.findByValidationCode(
      validationCode,
    );

    await this.ensureDriverCanValidate(
      ticket,
      currentUser,
    );

    if (ticket.ticketStatus === TicketStatus.USED) {
      throw new BadRequestException(
        'Este bilhete já foi utilizado.',
      );
    }

    if (ticket.ticketStatus !== TicketStatus.ISSUED) {
      throw new BadRequestException(
        'Este bilhete não está válido para embarque.',
      );
    }

    const booking = ticket.booking;

    if (!booking) {
      throw new BadRequestException(
        'Bilhete sem reserva vinculada.',
      );
    }

    if (
      booking.bookingStatus !==
      BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Reserva ainda não está confirmada.',
      );
    }

    ticket.ticketStatus = TicketStatus.USED;
    ticket.validatedAt = new Date();

    booking.boardedAt = new Date();

    await this.bookingsRepository.save(booking);

    const savedTicket =
      await this.ticketsRepository.save(ticket);

    /**
     * Busca ticket completo já com assentos.
     */
    const ticketWithSeats =
      (await this.findOne(savedTicket.id)) as Ticket & {
        seatReservations: SeatReservation[];
      };

    const seatLabels =
      ticketWithSeats.seatReservations
        .map(
          (reservation: SeatReservation) =>
            reservation.vehicleSeat?.seatLabel,
        )
        .filter(Boolean);

    const fullBooking = ticketWithSeats.booking;

    /**
     * Retorno completo para app seller/motorista.
     */
    return {
      message: 'Bilhete validado com sucesso.',

      status: 'validated',

      ticketId: savedTicket.id,

      ticketNumber:
        savedTicket.ticketNumber,

      validationCode:
        savedTicket.validationCode,

      ticketStatus:
        savedTicket.ticketStatus,

      bookingId: fullBooking.id,

      bookingCode:
        fullBooking.bookingCode,

      passengerName:
        fullBooking.passengerName,

      passengerPhone:
        fullBooking.passengerPhone,

      pickupLocation:
        fullBooking.pickupLocation,

      seats: seatLabels,

      /**
       * Valores financeiros.
       */
      ticketAmount: Number(
        fullBooking.ticketAmount || 0,
      ),

      subtotalAmount: Number(
        fullBooking.subtotalAmount || 0,
      ),

      systemFeeAmount: Number(
        fullBooking.systemFeeAmount || 0,
      ),

      cargoAmount: Number(
        fullBooking.cargoAmount || 0,
      ),

      discountAmount: Number(
        fullBooking.discountAmount || 0,
      ),

      totalAmount: Number(
        fullBooking.totalAmount || 0,
      ),

      grossAmount: Number(
        fullBooking.grossAmount || 0,
      ),

      booking: fullBooking,

      route: {
        originName:
          fullBooking.trip?.route?.originName,

        destinationName:
          fullBooking.trip?.route
            ?.destinationName,
      },

      vehicle: {
        plateNumber:
          fullBooking.trip?.vehicle
            ?.plateNumber,

        brand:
          fullBooking.trip?.vehicle?.brand,

        model:
          fullBooking.trip?.vehicle?.model,
      },

      boardedAt: fullBooking.boardedAt,
    };
  }

  /**
   * Cancela bilhete.
   */
  async cancel(id: string): Promise<Ticket> {
    const ticket = await this.findOne(id);

    if (ticket.ticketStatus === TicketStatus.USED) {
      throw new BadRequestException(
        'Bilhete usado não pode ser cancelado.',
      );
    }

    ticket.ticketStatus =
      TicketStatus.CANCELLED;

    await this.ticketsRepository.save(ticket);

    return this.findOne(id);
  }

  /**
   * Verifica se motorista pode validar.
   */
  private async ensureDriverCanValidate(
    ticket: Ticket,
    currentUser?: CurrentUser,
  ): Promise<void> {
    if (currentUser?.role !== Role.DRIVER) {
      return;
    }

    const driverId = this.getUserId(
      currentUser,
    );

    const tripDriverId =
      ticket.booking?.trip?.driver?.id;

    if (
      !tripDriverId ||
      tripDriverId !== driverId
    ) {
      throw new ForbiddenException(
        'Você não pode validar bilhete de uma viagem que não pertence a você.',
      );
    }
  }

  /**
   * Tenta interpretar QR Code JSON.
   */
  private parseQrCode(qrCodeValue: string): any {
    try {
      return JSON.parse(qrCodeValue);
    } catch {
      return {
        validationCode: qrCodeValue,
      };
    }
  }

  /**
   * Anexa assentos ao ticket.
   */
  private async attachSeats(
    ticket: Ticket,
  ): Promise<
    Ticket & {
      seatReservations: SeatReservation[];
    }
  > {
    const seatReservations =
      await this.seatReservationsRepository.find({
        where: {
          booking: {
            id: ticket.booking.id,
          },
        },
        relations: {
          vehicleSeat: true,
        },
        order: {
          createdAt: 'ASC',
        },
      });

    return {
      ...ticket,
      seatReservations,
    };
  }

  /**
   * Gera número do bilhete.
   */
  private generateTicketNumber(): string {
    const randomPart = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    const timestamp = Date.now()
      .toString()
      .slice(-6);

    return `TK-${timestamp}-${randomPart}`;
  }

  /**
   * Gera código de validação.
   */
  private generateValidationCode(): string {
    return Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();
  }
}