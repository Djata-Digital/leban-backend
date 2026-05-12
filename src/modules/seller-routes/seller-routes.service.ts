import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SellerRoute } from './entities/seller-route.entity';
import { AssignSellerRouteDto } from './dto/assign-seller-route.dto';

import { User } from '../users/entities/user.entity';
import { Route } from '../routes/entities/route.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class SellerRoutesService {
  constructor(
    @InjectRepository(SellerRoute)
    private readonly sellerRoutesRepository: Repository<SellerRoute>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,
  ) {}

  async assign(dto: AssignSellerRouteDto): Promise<SellerRoute> {
    const seller = await this.usersRepository.findOne({
      where: { id: dto.sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Vendedor não encontrado.');
    }

    if (seller.role !== Role.SELLER && String(seller.role) !== 'seller') {
      throw new BadRequestException('O usuário informado não é vendedor.');
    }

    const route = await this.routesRepository.findOne({
      where: { id: dto.routeId },
    });

    if (!route) {
      throw new NotFoundException('Rota não encontrada.');
    }

    if (!dto.vehicleType) {
      throw new BadRequestException('Informe o tipo de veículo.');
    }

    const existing = await this.sellerRoutesRepository.findOne({
      where: {
        seller: { id: seller.id },
        route: { id: route.id },
        vehicleType: dto.vehicleType,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Este vendedor já possui esta rota com este tipo de veículo.',
      );
    }

    const sellerRoute = this.sellerRoutesRepository.create({
      seller,
      route,
      vehicleType: dto.vehicleType,
    });

    return this.sellerRoutesRepository.save(sellerRoute);
  }

  async findAll(): Promise<SellerRoute[]> {
    return this.sellerRoutesRepository.find({
      relations: {
        seller: true,
        route: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findBySeller(sellerId: string): Promise<SellerRoute[]> {
    if (!sellerId) {
      return [];
    }

    return this.sellerRoutesRepository.find({
      where: {
        seller: { id: sellerId },
      },
      relations: {
        seller: true,
        route: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findMyRoutes(currentUser: {
    id?: string;
    sub?: string;
    role?: Role | string;
  }): Promise<SellerRoute[]> {
    const sellerId = currentUser?.id || currentUser?.sub;

    if (!sellerId) {
      return [];
    }

    return this.sellerRoutesRepository.find({
      where: {
        seller: { id: sellerId },
      },
      relations: {
        seller: true,
        route: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const sellerRoute = await this.sellerRoutesRepository.findOne({
      where: { id },
    });

    if (!sellerRoute) {
      throw new NotFoundException('Vínculo seller-rota não encontrado.');
    }

    await this.sellerRoutesRepository.remove(sellerRoute);

    return {
      message: 'Rota removida do vendedor com sucesso.',
    };
  }
}