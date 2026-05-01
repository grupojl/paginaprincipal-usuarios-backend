import { Test, TestingModule } from '@nestjs/testing';
import { AffiliatesService } from './affiliate.service';

describe('AffiliateService', () => {
  let service: AffiliatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AffiliateService],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
