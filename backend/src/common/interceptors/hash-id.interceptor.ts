import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { HashIdService } from '../services/hash-id.service';

const ID_FIELDS = new Set(['id']);

@Injectable()
export class HashIdInterceptor implements NestInterceptor {
  private readonly hashIdService = new HashIdService();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => this.encodeIds(data)),
    );
  }

  private encodeIds(value: any): any {
    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) {
      return value.map(item => this.encodeIds(item));
    }

    if (typeof value === 'object') {
      const encoded: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        const val = value[key];
        if (ID_FIELDS.has(key) && typeof val === 'number' && Number.isInteger(val) && val > 0) {
          encoded[key] = this.hashIdService.encode(val);
        } else if (typeof val === 'object') {
          encoded[key] = this.encodeIds(val);
        } else {
          encoded[key] = val;
        }
      }
      return encoded;
    }

    return value;
  }
}
