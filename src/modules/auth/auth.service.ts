import {
  BadRequestException,
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
  /**
   * Guarda códigos temporários em memória.
   *
   * Depois podemos mover para banco de dados ou Redis.
   */
  private readonly resetCodes = new Map<
    string,
    {
      code: string;
      expiresAt: Date;
    }
  >();

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

    const token = await this.generateToken(
      user.id,
      user.phoneNumber,
      user.role,
    );

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
    const user = await this.usersService.findByPhoneWithPassword(
      dto.phoneNumber,
    );

    if (!user) {
      throw new UnauthorizedException(
        'Telefone ou senha inválidos.',
      );
    }

    const passwordMatches = await user.comparePassword(dto.password);

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Telefone ou senha inválidos.',
      );
    }

    await this.usersService.updateLastLogin(user.id);

    const safeUser = this.usersService.sanitizeUser(user);

    const token = await this.generateToken(
      user.id,
      user.phoneNumber,
      user.role,
    );

    return {
      message: 'Login realizado com sucesso.',
      accessToken: token,
      user: safeUser,
    };
  }

  /**
   * Solicita redefinição de senha.
   */
  async requestPasswordReset(phoneNumber: string) {
    const user = await this.usersService.findByPhoneWithPassword(
      phoneNumber,
    );

    /**
     * Por segurança não mostramos
     * se o telefone existe ou não.
     */
    if (!user) {
      return {
        message:
          'Se o telefone existir, um código será enviado.',
      };
    }

    /**
     * Gera código de 6 dígitos.
     */
    const code = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    /**
     * Expira em 10 minutos.
     */
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    this.resetCodes.set(phoneNumber, {
      code,
      expiresAt,
    });

    /**
     * TEMPORÁRIO:
     * mostra no console do backend.
     *
     * Depois vamos integrar SMS/WhatsApp.
     */
    console.log('===================================');
    console.log('CÓDIGO RESET SENHA');
    console.log('Telefone:', phoneNumber);
    console.log('Código:', code);
    console.log('===================================');

    return {
      message:
        'Código de redefinição gerado com sucesso.',
    };
  }

  /**
   * Redefine senha.
   */
  async resetPassword(
    phoneNumber: string,
    code: string,
    newPassword: string,
  ) {
    const stored = this.resetCodes.get(phoneNumber);

    if (!stored) {
      throw new BadRequestException(
        'Código inválido ou expirado.',
      );
    }

    /**
     * Verifica expiração.
     */
    if (stored.expiresAt.getTime() < Date.now()) {
      this.resetCodes.delete(phoneNumber);

      throw new BadRequestException(
        'Código expirado.',
      );
    }

    /**
     * Verifica código.
     */
    if (stored.code !== code) {
      throw new BadRequestException(
        'Código inválido.',
      );
    }

    const user = await this.usersService.findByPhoneWithPassword(
      phoneNumber,
    );

    if (!user) {
      throw new BadRequestException(
        'Usuário não encontrado.',
      );
    }

    /**
     * Atualiza senha.
     */
    user.password = newPassword;

    await this.usersService.save(user);

    /**
     * Remove código usado.
     */
    this.resetCodes.delete(phoneNumber);

    return {
      message: 'Senha redefinida com sucesso.',
    };
  }

  /**
   * Gera JWT.
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