import { Test, TestingModule } from '@nestjs/testing';
import { SellerRoutesService } from './seller-routes.service';

describe('SellerRoutesService', () => {
  let service: SellerRoutesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SellerRoutesService],
    }).compile();

    service = module.get<SellerRoutesService>(SellerRoutesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
