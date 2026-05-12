import { Test, TestingModule } from '@nestjs/testing';
import { SellerRoutesController } from './seller-routes.controller';

describe('SellerRoutesController', () => {
  let controller: SellerRoutesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SellerRoutesController],
    }).compile();

    controller = module.get<SellerRoutesController>(SellerRoutesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
