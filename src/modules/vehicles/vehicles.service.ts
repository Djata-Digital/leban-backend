import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Vehicle, VehicleType } from './entities/vehicle.entity';
import { Route } from '../routes/entities/route.entity';
import { User } from '../users/entities/user.entity';
import { SellerRoute } from '../seller-routes/entities/seller-route.entity';
import { VehicleSeat } from '../vehicle-seats/entities/vehicle-seat.entity';
import { Role } from '../../common/enums/role.enum';

type CurrentUser = {
  id?: string;
  sub?: string;
  role: Role;
};

type VehiclePayload = Partial<Vehicle> & {
  routeId?: string;
  driverId?: string | null;
  vehicleImageUrl?: string | null;
};

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,

    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(SellerRoute)
    private readonly sellerRoutesRepository: Repository<SellerRoute>,

    @InjectRepository(VehicleSeat)
    private readonly vehicleSeatsRepository: Repository<VehicleSeat>,
  ) {}

  private getUserId(user?: CurrentUser): string | undefined {
    return user?.id || user?.sub;
  }

  async create(data: VehiclePayload, user: CurrentUser): Promise<Vehicle> {
    const currentUserId = this.getUserId(user);

    const existingVehicle = await this.vehiclesRepository.findOne({
      where: { plateNumber: data.plateNumber },
    });

    if (existingVehicle) {
      throw new ConflictException('Já existe um veículo com esta placa.');
    }

    if (!data.routeId) {
      throw new BadRequestException('Informe a rota do veículo.');
    }

    if (!data.vehicleType) {
      throw new BadRequestException('Informe o tipo de veículo.');
    }

    const route = await this.routesRepository.findOne({
      where: { id: data.routeId },
    });

    if (!route) {
      throw new NotFoundException('Rota não encontrada.');
    }

    if (user.role === Role.SELLER) {
      if (!currentUserId) {
        throw new BadRequestException('Usuário autenticado inválido.');
      }

      const sellerRoute = await this.sellerRoutesRepository.findOne({
        where: {
          seller: { id: currentUserId },
          route: { id: route.id },
          vehicleType: data.vehicleType,
        },
      });

      if (!sellerRoute) {
        throw new BadRequestException(
          'Você não tem permissão para cadastrar este tipo de veículo nesta rota.',
        );
      }
    }

    let driver: User | null = null;

    if (data.driverId) {
      driver = await this.usersRepository.findOne({
        where: { id: data.driverId },
      });

      if (!driver) {
        throw new NotFoundException('Motorista não encontrado.');
      }

      if (driver.role !== Role.DRIVER) {
        throw new BadRequestException(
          'O usuário selecionado não possui perfil de motorista.',
        );
      }
    }

    const vehicle = this.vehiclesRepository.create({
      plateNumber: data.plateNumber,
      model: data.model,
      brand: data.brand,
      color: data.color,
      manufactureYear: data.manufactureYear,
      seatCount: data.seatCount,
      vehicleType: data.vehicleType as VehicleType,
      vehicleImageUrl: data.vehicleImageUrl ?? null,
      ownerName: data.ownerName ?? null,
      ownerPhone: data.ownerPhone ?? null,
      sellerCommissionAmount: data.sellerCommissionAmount ?? 0,
      route,
      driver,
      active: true,
    });

    const savedVehicle = await this.vehiclesRepository.save(vehicle);

    await this.generateSeatsForVehicle(savedVehicle);

    return savedVehicle;
  }

  private async generateSeatsForVehicle(vehicle: Vehicle): Promise<void> {
    const totalSeats = Number(vehicle.seatCount || 0);

    if (totalSeats <= 0) {
      return;
    }

    const existingSeats = await this.vehicleSeatsRepository.count({
      where: {
        vehicle: { id: vehicle.id },
      },
    });

    if (existingSeats > 0) {
      return;
    }

    const seats: VehicleSeat[] = [];

    for (let i = 1; i <= totalSeats; i++) {
      const seat = this.vehicleSeatsRepository.create({
        vehicle,
        seatNumber: i,
        seatLabel: `A${i}`,
        seatType: 'normal',
        active: true,
      });

      seats.push(seat);
    }

    await this.vehicleSeatsRepository.save(seats);
  }

  async findAll(user: CurrentUser): Promise<Vehicle[]> {
    const currentUserId = this.getUserId(user);

    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      return this.vehiclesRepository.find({
        relations: {
          route: true,
          driver: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    }

    if (user.role === Role.SELLER) {
      if (!currentUserId) {
        return [];
      }

      const sellerRoutes = await this.sellerRoutesRepository.find({
        where: {
          seller: { id: currentUserId },
        },
        relations: {
          route: true,
        },
      });

      if (sellerRoutes.length === 0) {
        return [];
      }

      const routeIds = sellerRoutes
        .map((item) => item.route?.id)
        .filter(Boolean);

      const vehicleTypes = sellerRoutes
        .map((item) => item.vehicleType)
        .filter(Boolean);

      if (routeIds.length === 0 || vehicleTypes.length === 0) {
        return [];
      }

      return this.vehiclesRepository.find({
        where: {
          route: {
            id: In(routeIds),
          },
          vehicleType: In(vehicleTypes),
        },
        relations: {
          route: true,
          driver: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    }

    return [];
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
      relations: {
        route: true,
        driver: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    return vehicle;
  }

  async update(
    id: string,
    data: VehiclePayload,
    user: CurrentUser,
  ): Promise<Vehicle> {
    const currentUserId = this.getUserId(user);

    const vehicle = await this.findOne(id);

    let route = vehicle.route;

    if (data.routeId) {
      route = await this.routesRepository.findOne({
        where: { id: data.routeId },
      });

      if (!route) {
        throw new NotFoundException('Rota não encontrada.');
      }
    }

    if (!route) {
      throw new BadRequestException('Veículo sem rota associada.');
    }

    const newVehicleType = data.vehicleType ?? vehicle.vehicleType;

    if (user.role === Role.SELLER) {
      if (!currentUserId) {
        throw new BadRequestException('Usuário autenticado inválido.');
      }

      const sellerRoute = await this.sellerRoutesRepository.findOne({
        where: {
          seller: { id: currentUserId },
          route: { id: route.id },
          vehicleType: newVehicleType,
        },
      });

      if (!sellerRoute) {
        throw new BadRequestException(
          'Você não tem permissão para alterar este veículo para esta rota/tipo.',
        );
      }
    }

    let driver = vehicle.driver ?? null;

    if (data.driverId !== undefined) {
      if (data.driverId === null || data.driverId === '') {
        driver = null;
      } else {
        const foundDriver = await this.usersRepository.findOne({
          where: { id: data.driverId },
        });

        if (!foundDriver) {
          throw new NotFoundException('Motorista não encontrado.');
        }

        if (foundDriver.role !== Role.DRIVER) {
          throw new BadRequestException(
            'O usuário selecionado não possui perfil de motorista.',
          );
        }

        driver = foundDriver;
      }
    }

    vehicle.route = route;
    vehicle.vehicleType = newVehicleType;
    vehicle.driver = driver;

    Object.assign(vehicle, {
      plateNumber: data.plateNumber ?? vehicle.plateNumber,
      model: data.model ?? vehicle.model,
      brand: data.brand ?? vehicle.brand,
      color: data.color ?? vehicle.color,
      manufactureYear: data.manufactureYear ?? vehicle.manufactureYear,
      seatCount: data.seatCount ?? vehicle.seatCount,
      vehicleImageUrl:
        data.vehicleImageUrl !== undefined
          ? data.vehicleImageUrl
          : vehicle.vehicleImageUrl,
      ownerName: data.ownerName ?? vehicle.ownerName,
      ownerPhone: data.ownerPhone ?? vehicle.ownerPhone,
      sellerCommissionAmount:
        data.sellerCommissionAmount ?? vehicle.sellerCommissionAmount,
    });

    const updatedVehicle = await this.vehiclesRepository.save(vehicle);

    await this.generateSeatsForVehicle(updatedVehicle);

    return updatedVehicle;
  }

  async deactivate(id: string): Promise<Vehicle> {
    const vehicle = await this.findOne(id);

    vehicle.active = false;

    return this.vehiclesRepository.save(vehicle);
  }
}