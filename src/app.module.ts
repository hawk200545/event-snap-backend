import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { FacesModule } from './faces/faces.module';
import { PhotosModule } from './photos/photos.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    RoomsModule,
    PhotosModule,
    FacesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
