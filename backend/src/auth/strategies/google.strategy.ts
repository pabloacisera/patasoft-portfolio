import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
  console.log('[GoogleStrategy] Profile recibido:', { 
    id: profile.id, 
    email: profile.emails?.[0]?.value,
    displayName: profile.displayName 
  });
  
  const email = profile.emails?.[0]?.value;
  const name = profile.displayName || profile.name?.givenName;

  let user = await this.prisma.user.findUnique({
    where: { googleId: profile.id },
  });

  if (!user && email) {
    user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.id, avatarUrl: profile.photos?.[0]?.value },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          googleId: profile.id,
          avatarUrl: profile.photos?.[0]?.value,
          role: 'USER',
        },
      });
    }
  }

  console.log('[GoogleStrategy] Usuario final:', user ? `id=${user.id}` : 'null');
  done(null, user);
}
}