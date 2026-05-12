import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';

@Injectable()
export class FinancialService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  async getSummary(startDate?: string, endDate?: string) {
    const whereCondition: any = {
      bookingStatus: BookingStatus.CONFIRMED,
    };

    if (startDate && endDate) {
      whereCondition.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const bookings = await this.bookingsRepository.find({
      where: whereCondition,
    });

    return this.buildSummary(bookings);
  }

  async getSellerSummary(sellerId: string) {
    const bookings = await this.bookingsRepository.find({
      where: {
        bookingStatus: BookingStatus.CONFIRMED,
        seller: { id: sellerId },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      totals: this.calculateTotals(bookings),
      recentSales: bookings.slice(0, 10),
    };
  }

  /**
   * Relatório financeiro agrupado por carro.
   */
  async getVehiclesReport(startDate?: string, endDate?: string) {
    const whereCondition: any = {
      bookingStatus: BookingStatus.CONFIRMED,
    };

    if (startDate && endDate) {
      whereCondition.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const bookings = await this.bookingsRepository.find({
      where: whereCondition,
      order: {
        createdAt: 'DESC',
      },
    });

    const vehicleMap = new Map<string, any>();

    for (const booking of bookings) {
      const vehicle = booking.trip?.vehicle;

      if (!vehicle) {
        continue;
      }

      const vehicleId = vehicle.id;

      const current = vehicleMap.get(vehicleId) ?? {
        vehicleId,
        plateNumber: vehicle.plateNumber,
        model: vehicle.model,
        ownerName: vehicle.ownerName || '-',
        ownerPhone: vehicle.ownerPhone || '-',
        route: booking.trip?.route
          ? `${booking.trip.route.originName} → ${booking.trip.route.destinationName}`
          : '-',
        grossAmount: 0,
        ticketAmount: 0,
        systemFeeAmount: 0,
        sellerCommissionAmount: 0,
        ownerAmount: 0,
        salesCount: 0,
        passengersCount: 0,
      };

      current.grossAmount += Number(booking.grossAmount || booking.totalAmount || 0);
      current.ticketAmount += Number(booking.ticketAmount || booking.subtotalAmount || 0);
      current.systemFeeAmount += Number(booking.systemFeeAmount || booking.companyAmount || 0);
      current.sellerCommissionAmount += Number(
        booking.sellerCommissionAmount || booking.commissionAmount || 0,
      );
      current.ownerAmount += Number(booking.ownerAmount || 0);
      current.salesCount += 1;
      current.passengersCount += Number(booking.seatQuantity || 1);

      vehicleMap.set(vehicleId, current);
    }

    return Array.from(vehicleMap.values()).sort(
      (a, b) => b.grossAmount - a.grossAmount,
    );
  }

  private buildSummary(bookings: Booking[]) {
    const totals = this.calculateTotals(bookings);

    const sellerMap = new Map<string, any>();

    for (const booking of bookings) {
      if (!booking.seller) continue;

      const sellerId = booking.seller.id;

      const current = sellerMap.get(sellerId) ?? {
        sellerId,
        sellerName: booking.seller.fullName,
        grossAmount: 0,
        ticketAmount: 0,
        systemFeeAmount: 0,
        sellerCommissionAmount: 0,
        ownerAmount: 0,
        salesCount: 0,
      };

      current.grossAmount += Number(booking.grossAmount || booking.totalAmount || 0);
      current.ticketAmount += Number(booking.ticketAmount || booking.subtotalAmount || 0);
      current.systemFeeAmount += Number(booking.systemFeeAmount || booking.companyAmount || 0);
      current.sellerCommissionAmount += Number(
        booking.sellerCommissionAmount || booking.commissionAmount || 0,
      );
      current.ownerAmount += Number(booking.ownerAmount || 0);
      current.salesCount += 1;

      sellerMap.set(sellerId, current);
    }

    return {
      today: totals,
      allTime: totals,
      sellerRanking: Array.from(sellerMap.values()).sort(
        (a, b) => b.grossAmount - a.grossAmount,
      ),
    };
  }

  private calculateTotals(bookings: Booking[]) {
    return {
      grossAmount: bookings.reduce(
        (sum, b) => sum + Number(b.grossAmount || b.totalAmount || 0),
        0,
      ),
      ticketAmount: bookings.reduce(
        (sum, b) => sum + Number(b.ticketAmount || b.subtotalAmount || 0),
        0,
      ),
      systemFeeAmount: bookings.reduce(
        (sum, b) => sum + Number(b.systemFeeAmount || b.companyAmount || 0),
        0,
      ),
      sellerCommissionAmount: bookings.reduce(
        (sum, b) => sum + Number(b.sellerCommissionAmount || b.commissionAmount || 0),
        0,
      ),
      ownerAmount: bookings.reduce(
        (sum, b) => sum + Number(b.ownerAmount || 0),
        0,
      ),
      salesCount: bookings.length,
    };
  }
}