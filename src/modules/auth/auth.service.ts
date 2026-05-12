import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Serviço de autenticação.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registra novo usuário e já devolve token.
   */
  async register(dto: RegisterDto) {
    const user = await this.usersService.create({
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      email: dto.email,
      nickname: dto.nickname,
      password: dto.password,
      role: dto.role,
    });

    const safeUser = this.usersService.sanitizeUser(user);
    const token = await this.generateToken(user.id, user.phoneNumber, user.role);

    return {
      message: 'Usuário cadastrado com sucesso.',
      accessToken: token,
      user: safeUser,
    };
  }

  /**
   * Autentica usuário por telefone e senha.
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByPhoneWithPassword(dto.phoneNumber);

    if (!user) {
      throw new UnauthorizedException('Telefone ou senha inválidos.');
    }

    const passwordMatches = await user.comparePassword(dto.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Telefone ou senha inválidos.');
    }

    await this.usersService.updateLastLogin(user.id);

    const safeUser = this.usersService.sanitizeUser(user);
    const token = await this.generateToken(user.id, user.phoneNumber, user.role);

    return {
      message: 'Login realizado com sucesso.',
      accessToken: token,
      user: safeUser,
    };
  }

  /**
   * Gera o JWT do usuário.
   */
  private async generateToken(
    userId: string,
    phoneNumber: string,
    role: string,
  ): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      phoneNumber,
      role,
    });
  }
}