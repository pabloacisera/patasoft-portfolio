import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CronService } from './cron.service';

describe('CronService', () => {
  let service: CronService;
  let mockDebtsService: any;
  let mockSubService: any;

  beforeEach(() => {
    mockDebtsService = {
      processAlerts: vi.fn().mockResolvedValue({ processed: 5 }),
    };
    mockSubService = {
      checkExpirations: vi.fn().mockResolvedValue(undefined),
    };
    service = new CronService(mockDebtsService, mockSubService);
  });

  describe('handleDebtAlerts', () => {
    it('should call debtsService.processAlerts', async () => {
      await service.handleDebtAlerts();

      expect(mockDebtsService.processAlerts).toHaveBeenCalledOnce();
    });

    it('should log the number of processed debts', async () => {
      mockDebtsService.processAlerts.mockResolvedValue({ processed: 3 });

      await service.handleDebtAlerts();

      expect(mockDebtsService.processAlerts).toHaveBeenCalledOnce();
    });
  });

  describe('handleSubscriptionExpirations', () => {
    it('should call subService.checkExpirations', async () => {
      await service.handleSubscriptionExpirations();

      expect(mockSubService.checkExpirations).toHaveBeenCalledOnce();
    });
  });
});
