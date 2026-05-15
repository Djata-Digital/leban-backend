import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';

import { Route } from './entities/route.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { SellerRoute } from '../seller-routes/entities/seller-route.entity';
import { Role } from '../../common/enums/role.enum';

type CurrentUser = {
  id?: string;
  sub?: string;
  role: Role;
};

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,

    @InjectRepository(SellerRoute)
    private readonly sellerRoutesRepository: Repository<SellerRoute>,
  ) {}

  private getUserId(user?: CurrentUser): string | undefined {
    return user?.id || user?.sub;
  }

  async create(dto: CreateRouteDto): Promise<Route> {
    const route = this.routesRepository.create({
      originName: dto.originName,
      destinationName: dto.destinationName,
      distanceKm: dto.distanceKm ?? null,
      estimatedDurationMinutes: dto.estimatedDurationMinutes ?? null,
      basePrice: dto.basePrice,
      active: dto.active ?? true,
    });

    return this.routesRepository.save(route);
  }

  async findAll(search?: string, user?: CurrentUser): Promise<Route[]> {
    const normalizedSearch = search?.trim();

    if (user?.role === Role.SELLER) {
      const sellerId = this.getUserId(user);

      if (!sellerId) {
        return [];
      }

      const sellerRoutes = await this.sellerRoutesRepository.find({
        where: {
          seller: { id: sellerId },
        },
        relations: {
          route: true,
        },
      });

      const routeIds = sellerRoutes
        .map((item) => item.route?.id)
        .filter(Boolean);

      if (routeIds.length === 0) {
        return [];
      }

      if (normalizedSearch && normalizedSearch.length > 0) {
        return this.routesRepository.find({
          where: [
            {
              id: In(routeIds),
              originName: ILike(`%${normalizedSearch}%`),
            },
            {
              id: In(routeIds),
              destinationName: ILike(`%${normalizedSearch}%`),
            },
          ],
          order: {
            originName: 'ASC',
            destinationName: 'ASC',
          },
        });
      }

      return this.routesRepository.find({
        where: {
          id: In(routeIds),
        },
        order: {
          originName: 'ASC',
          destinationName: 'ASC',
        },
      });
    }

    if (normalizedSearch && normalizedSearch.length > 0) {
      return this.routesRepository.find({
        where: [
          {
            originName: ILike(`%${normalizedSearch}%`),
          },
          {
            destinationName: ILike(`%${normalizedSearch}%`),
          },
        ],
        order: {
          originName: 'ASC',
          destinationName: 'ASC',
        },
      });
    }

    return this.routesRepository.find({
      order: {
        originName: 'ASC',
        destinationName: 'ASC',
      },
    });
  }

  /**
   * Sugestões leves para app passageiro.
   * Retorna apenas rotas ativas e poucos campos.
   * Ideal para internet fraca.
   */
  async suggestions(search?: string): Promise<
    {
      id: string;
      originName: string;
      destinationName: string;
      label: string;
    }[]
  > {
    const normalizedSearch = search?.trim();

    const query = this.routesRepository
      .createQueryBuilder('route')
      .select([
        'route.id',
        'route.originName',
        'route.destinationName',
      ])
      .where('route.active = :active', {
        active: true,
      });

    if (normalizedSearch && normalizedSearch.length > 0) {
      query.andWhere(
        `(
          LOWER(route.origin_name) LIKE LOWER(:search)
          OR LOWER(route.destination_name) LIKE LOWER(:search)
        )`,
        {
          search: `%${normalizedSearch}%`,
        },
      );
    }

    query
      .orderBy('route.origin_name', 'ASC')
      .addOrderBy('route.destination_name', 'ASC')
      .limit(15);

    const routes = await query.getMany();

    return routes.map((route) => ({
      id: route.id,
      originName: route.originName,
      destinationName: route.destinationName,
      label: `${route.originName} → ${route.destinationName}`,
    }));
  }

  async findOne(id: string, user?: CurrentUser): Promise<Route> {
    const route = await this.routesRepository.findOne({
      where: { id },
    });

    if (!route) {
      throw new NotFoundException('Rota não encontrada.');
    }

    if (user?.role === Role.SELLER) {
      const sellerId = this.getUserId(user);

      if (!sellerId) {
        throw new ForbiddenException('Usuário autenticado inválido.');
      }

      const sellerRoute = await this.sellerRoutesRepository.findOne({
        where: {
          seller: { id: sellerId },
          route: { id },
        },
      });

      if (!sellerRoute) {
        throw new ForbiddenException('Você não tem acesso a esta rota.');
      }
    }

    return route;
  }

  async update(id: string, dto: UpdateRouteDto): Promise<Route> {
    const route = await this.findOne(id);

    Object.assign(route, dto);

    return this.routesRepository.save(route);
  }

  async deactivate(id: string): Promise<Route> {
    const route = await this.findOne(id);

    route.active = false;

    return this.routesRepository.save(route);
  }

  async activate(id: string): Promise<Route> {
    const route = await this.findOne(id);

    route.active = true;

    return this.routesRepository.save(route);
  }
}