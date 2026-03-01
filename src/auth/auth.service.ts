import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { randomUUID } from 'crypto';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';

type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  passwordHash: string;
};

@Injectable()
export class AuthService {
  private readonly usersByEmail = new Map<string, AuthUser>();

  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    this.validateCredentials(dto.email, dto.password);

    const normalizedEmail = dto.email.toLowerCase();
    const existingUser = this.usersByEmail.get(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hash(dto.password, 10);
    const user: AuthUser = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash,
      fullName: dto.fullName?.trim() || null,
    };
    this.usersByEmail.set(normalizedEmail, user);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    };
  }

  async signin(dto: SigninDto) {
    this.validateCredentials(dto.email, dto.password);

    const normalizedEmail = dto.email.toLowerCase();
    const user = this.usersByEmail.get(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    };
  }

  private validateCredentials(email?: string, password?: string): void {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
  }
}
