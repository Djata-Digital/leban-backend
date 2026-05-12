import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BoardingPoint } from './entities/boarding-point.entity';

import { Route } from '../routes/entities/route.entity';

import { CreateBoardingPointDto } from './dto/create-boarding-point.dto';
import { UpdateBoardingPointDto } from './dto/update-boarding-point.dto';

@Injectable()
export class BoardingPointsService {
  constructor(
    @InjectRepository(BoardingPoint)
    private readonly boardingPointsRepository: Repository<BoardingPoint>,

    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,
  ) {}

  async create(dto: CreateBoardingPointDto) {
    const route = await this.routesRepository.findOne({
      where: {
        id: dto.routeId,
      },
    });

    if (!route) {
      throw new NotFoundException('Rota não encontrada.');
    }

    const existing = await this.boardingPointsRepository.findOne({
      where: {
        route: {
          id: route.id,
        },
        orderNumber: dto.orderNumber,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Já existe um ponto usando esta ordem.',
      );
    }

    const boardingPoint = this.boardingPointsRepository.create({
      name: dto.name,
      orderNumber: dto.orderNumber,
      route,
      active: true,
    });

    return this.boardingPointsRepository.save(boardingPoint);
  }

  async findByRoute(routeId: string) {
    return this.boardingPointsRepository.find({
      where: {
        route: {
          id: routeId,
        },
        active: true,
      },
      order: {
        orderNumber: 'ASC',
      },
    });
  }

  async update(id: string, dto: UpdateBoardingPointDto) {
    const boardingPoint =
      await this.boardingPointsRepository.findOne({
        where: {
          id,
        },
      });

    if (!boardingPoint) {
      throw new NotFoundException(
        'Ponto de embarque não encontrado.',
      );
    }

    Object.assign(boardingPoint, dto);

    return this.boardingPointsRepository.save(
      boardingPoint,
    );
  }

  async remove(id: string) {
    const boardingPoint =
      await this.boardingPointsRepository.findOne({
        where: {
          id,
        },
      });

    if (!boardingPoint) {
      throw new NotFoundException(
        'Ponto de embarque não encontrado.',
      );
    }

    boardingPoint.active = false;

    return this.boardingPointsRepository.save(
      boardingPoint,
    );
  }
}