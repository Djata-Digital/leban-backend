import { Test, TestingModule } from '@nestjs/testing';
import { SeatReservationsController } from './seat-reservations.controller';

describe('SeatReservationsController', () => {
  let controller: SeatReservationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeatReservationsController],
    }).compile();

    controller = module.get<SeatReservationsController>(SeatReservationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
