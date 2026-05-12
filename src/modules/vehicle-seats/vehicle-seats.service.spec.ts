import { Test, TestingModule } from '@nestjs/testing';
import { VehicleSeatsService } from './vehicle-seats.service';

describe('VehicleSeatsService', () => {
  let service: VehicleSeatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VehicleSeatsService],
    }).compile();

    service = module.get<VehicleSeatsService>(VehicleSeatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
