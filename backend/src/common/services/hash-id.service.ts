import { Injectable } from '@nestjs/common';
import Hashids from 'hashids';

@Injectable()
export class HashIdService {
  private readonly hashids: Hashids;

  constructor() {
    const salt = process.env.HASHID_SALT || 'patasoft-default-salt';
    this.hashids = new Hashids(salt, 6);
  }

  encode(id: number): string {
    return this.hashids.encode(id);
  }

  decode(hash: string): number | null {
    const result = this.hashids.decode(hash);
    if (result.length === 0) return null;
    const val = result[0];
    return typeof val === 'number' ? val : Number(val);
  }
}
