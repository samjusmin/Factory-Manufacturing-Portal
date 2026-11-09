import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { MockStrategy } from './mock-auth.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
    imports: [UserModule,
        PassportModule.register({ defaultStrategy: 'local' }),
        JwtModule.registerAsync({
            useFactory: (config: ConfigService) => {
              return {
                // Falls back to a demo secret so the app runs with zero configuration.
                secret: config.get<string>('JWT_SECRET_KEY') || 'demo-jwt-secret-not-for-production-use',
                signOptions: {
                  expiresIn: config.get<string | number>('JWT_EXPIRY') || '8h',
                },
              };
            },
            inject: [ConfigService],
        }),
    ],
    providers: [AuthService, MockStrategy, JwtStrategy],
    exports: [AuthService],
    controllers: [AuthController]
})
export class AuthModule {}
