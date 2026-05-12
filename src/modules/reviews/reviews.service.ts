import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';

import { User } from '../users/entities/user.entity';
import { Trip } from '../trips/entities/trip.entity';

import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationChannel,
  NotificationType,
} from '../notifications/entities/notification.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Trip)
    private tripRepo: Repository<Trip>,

    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Cria avaliação de viagem
   */
  async create(dto: CreateReviewDto, currentUserId: string) {
    const reviewer = await this.userRepo.findOne({
      where: { id: currentUserId },
    });

    if (!reviewer) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const reviewedUser = await this.userRepo.findOne({
      where: { id: dto.reviewedUserId },
    });

    if (!reviewedUser) {
      throw new NotFoundException('Usuário avaliado não encontrado.');
    }

    const trip = await this.tripRepo.findOne({
      where: { id: dto.tripId },
      relations: {
        route: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    if (reviewer.id === reviewedUser.id) {
      throw new BadRequestException('Você não pode avaliar a si mesmo.');
    }

    const existingReview = await this.reviewRepo.findOne({
      where: {
        reviewer: { id: currentUserId },
        trip: { id: dto.tripId },
      },
    });

    if (existingReview) {
      throw new BadRequestException('Você já avaliou esta viagem.');
    }

    const review = this.reviewRepo.create({
      reviewer,
      reviewedUser,
      trip,
      rating: dto.rating,
      comment: dto.comment?.trim() || undefined,
    });

    const savedReview = await this.reviewRepo.save(review);

    await this.notificationsService.create({
      userId: reviewedUser.id,
      title: 'Nova avaliação recebida',
      message: `${reviewer.fullName} avaliou sua viagem com ${dto.rating} estrela(s).`,
      notificationType: NotificationType.SYSTEM,
      deliveryChannel: NotificationChannel.IN_APP,
    });

    return savedReview;
  }

  /**
   * Lista avaliações de um usuário
   */
  async findByUser(userId: string) {
    return this.reviewRepo.find({
      where: {
        reviewedUser: { id: userId },
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Calcula média de avaliações
   */
  async getAverageRating(userId: string) {
    const reviews = await this.findByUser(userId);

    if (reviews.length === 0) {
      return { average: 0, total: 0 };
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);

    return {
      average: Number((sum / total).toFixed(1)),
      total,
    };
  }
}