import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Roles(Role.PASSENGER)
  @Post()
  create(@Body() dto: CreateReviewDto, @Request() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.reviewsService.create(dto, userId);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.reviewsService.findByUser(userId);
  }

  @Get('user/:userId/average')
  getAverage(@Param('userId') userId: string) {
    return this.reviewsService.getAverageRating(userId);
  }
}