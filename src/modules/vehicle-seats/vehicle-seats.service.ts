import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleSeat } from './entities/vehicle-seat.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { CreateVehicleSeatDto } from './dto/create-vehicle-seat.dto';
import { GenerateSeatsDto } from './dto/generate-seats.dto';

/**
 * Service responsável pela lógica dos assentos
 */
@Injectable()
export class VehicleSeatsService {
  constructor(
    @InjectRepository(VehicleSeat)
    private readonly seatRepository: Repository<VehicleSeat>,

    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  /**
   * Criar assento manualmente
   */
  async create(dto: CreateVehicleSeatDto) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: dto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }

    const seat = this.seatRepository.create({
      vehicle,
      seatNumber: dto.seatNumber,
      seatLabel: dto.seatLabel,
    });

    return this.seatRepository.save(seat);
  }

  /**
   * Gerar vários assentos automaticamente
   */
  async generateSeats(dto: GenerateSeatsDto) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: dto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }

    const seats: VehicleSeat[] = [];

    for (let i = 1; i <= dto.totalSeats; i++) {
      const seat = this.seatRepository.create({
        vehicle,
        seatNumber: i,
        seatLabel: `A${i}`, // Ex: A1, A2, A3
      });

      seats.push(seat);
    }

    return this.seatRepository.save(seats);
  }

  /**
   * Listar assentos de um veículo
   */
  async findByVehicle(vehicleId: string) {
    return this.seatRepository.find({
      where: {
        vehicle: { id: vehicleId },
      },
      order: { seatNumber: 'ASC' },
    });
  }
}