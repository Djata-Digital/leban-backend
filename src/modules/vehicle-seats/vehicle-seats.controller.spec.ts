import { Test, TestingModule } from '@nestjs/testing';
import { VehicleSeatsController } from './vehicle-seats.controller';

describe('VehicleSeatsController', () => {
  let controller: VehicleSeatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehicleSeatsController],
    }).compile();

    controller = module.get<VehicleSeatsController>(VehicleSeatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
