import { Test, TestingModule } from '@nestjs/testing';
import { SeatReservationsService } from './seat-reservations.service';

describe('SeatReservationsService', () => {
  let service: SeatReservationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeatReservationsService],
    }).compile();

    service = module.get<SeatReservationsService>(SeatReservationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
