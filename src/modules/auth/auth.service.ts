import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../users/users.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { WhatsAppService } from './whatsapp.service';

import { Role } from '../../common/enums/role.enum';

/**
 * Serviço de autenticação.
 */
@Injectable()
export class AuthService {
  private readonly phoneVerificationCodes = new Map<
    string,
    {
      code: string;
      expiresAt: Date;
      attempts: number;
    }
  >();

  private readonly resetCodes = new Map<
    string,
    {
      code: string;
      expiresAt: Date;
      attempts: number;
    }
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  /**
   * Registra novo usuário.
   * Permite cadastro público como PASSENGER, SELLER ou DRIVER.
   * Bloqueia ADMIN e SUPER_ADMIN por segurança.
   */
  async register(dto: RegisterDto) {
    if (dto.role === Role.ADMIN || dto.role === Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'Não é permitido criar conta de administrador pelo cadastro público.',
      );
    }

    const user = await this.usersService.create({
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      email: dto.email,
      nickname: dto.nickname,
      password: dto.password,
      role: dto.role,
    });

    await this.createAndSendPhoneVerificationCode(user.phoneNumber);

    const safeUser = this.usersService.sanitizeUser(user);

    return {
      message:
        'Usuário cadastrado com sucesso. Enviamos um código de verificação para o WhatsApp.',
      user: safeUser,
      requiresPhoneVerification: true,
    };
  }

  /**
   * Confirma telefone usando código recebido.
   */
  async verifyPhone(phoneNumber: string, code: string) {
    const cleanPhone = this.normalizePhone(phoneNumber);

    const stored = this.phoneVerificationCodes.get(cleanPhone);

    if (!stored) {
      throw new BadRequestException('Código inválido ou expirado.');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      this.phoneVerificationCodes.delete(cleanPhone);
      throw new BadRequestException('Código expirado.');
    }

    if (stored.attempts >= 5) {
      this.phoneVerificationCodes.delete(cleanPhone);
      throw new BadRequestException(
        'Muitas tentativas inválidas. Solicite um novo código.',
      );
    }

    if (stored.code !== code.trim()) {
      stored.attempts += 1;
      this.phoneVerificationCodes.set(cleanPhone, stored);
      throw new BadRequestException('Código inválido.');
    }

    const user = await this.usersService.findByPhoneWithPassword(cleanPhone);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }

    await this.usersService.markPhoneAsVerified(user.id);

    this.phoneVerificationCodes.delete(cleanPhone);

    const safeUser = this.usersService.sanitizeUser(user);

    const token = await this.generateToken(
      user.id,
      user.phoneNumber,
      user.role,
    );

    return {
      message: 'Telefone verificado com sucesso.',
      accessToken: token,
      user: {
        ...safeUser,
        phoneVerified: true,
      },
    };
  }

  /**
   * Reenvia código de confirmação do telefone.
   */
  async resendPhoneCode(phoneNumber: string) {
    const cleanPhone = this.normalizePhone(phoneNumber);

    const user = await this.usersService.findByPhoneWithPassword(cleanPhone);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }

    if (user.phoneVerified) {
      return {
        message: 'Este telefone já está verificado.',
      };
    }

    await this.createAndSendPhoneVerificationCode(cleanPhone);

    return {
      message: 'Novo código enviado para o WhatsApp.',
    };
  }

  /**
   * Login por telefone e senha.
   */
  async login(dto: LoginDto) {
    const cleanPhone = this.normalizePhone(dto.phoneNumber);

    const user = await this.usersService.findByPhoneWithPassword(cleanPhone);

    if (!user) {
      throw new UnauthorizedException('Telefone ou senha inválidos.');
    }

    const passwordMatches = await user.comparePassword(dto.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Telefone ou senha inválidos.');
    }

    if (!user.phoneVerified) {
      await this.createAndSendPhoneVerificationCode(user.phoneNumber);

      throw new UnauthorizedException(
        'Telefone ainda não verificado. Enviamos um novo código para o WhatsApp.',
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
    const cleanPhone = this.normalizePhone(phoneNumber);

    const user = await this.usersService.findByPhoneWithPassword(cleanPhone);

    if (!user) {
      return {
        message: 'Se o telefone existir, um código será enviado.',
      };
    }

    const code = this.generateOtpCode();
    const expiresAt = this.createExpirationDate(10);

    this.resetCodes.set(cleanPhone, {
      code,
      expiresAt,
      attempts: 0,
    });

    await this.sendWhatsAppCode({
      phoneNumber: cleanPhone,
      code,
      purpose: 'password_reset',
    });

    return {
      message: 'Se o telefone existir, um código será enviado.',
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
    const cleanPhone = this.normalizePhone(phoneNumber);

    const stored = this.resetCodes.get(cleanPhone);

    if (!stored) {
      throw new BadRequestException('Código inválido ou expirado.');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      this.resetCodes.delete(cleanPhone);
      throw new BadRequestException('Código expirado.');
    }

    if (stored.attempts >= 5) {
      this.resetCodes.delete(cleanPhone);
      throw new BadRequestException(
        'Muitas tentativas inválidas. Solicite um novo código.',
      );
    }

    if (stored.code !== code.trim()) {
      stored.attempts += 1;
      this.resetCodes.set(cleanPhone, stored);
      throw new BadRequestException('Código inválido.');
    }

    const user = await this.usersService.findByPhoneWithPassword(cleanPhone);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }

    user.password = newPassword;

    await this.usersService.save(user);

    this.resetCodes.delete(cleanPhone);

    return {
      message: 'Senha redefinida com sucesso.',
    };
  }

  /**
   * Cria e envia código de verificação do telefone.
   */
  private async createAndSendPhoneVerificationCode(phoneNumber: string) {
    const cleanPhone = this.normalizePhone(phoneNumber);

    const code = this.generateOtpCode();
    const expiresAt = this.createExpirationDate(5);

    this.phoneVerificationCodes.set(cleanPhone, {
      code,
      expiresAt,
      attempts: 0,
    });

    await this.sendWhatsAppCode({
      phoneNumber: cleanPhone,
      code,
      purpose: 'phone_verification',
    });
  }

  /**
   * Gera código de 6 dígitos.
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Cria data de expiração.
   */
  private createExpirationDate(minutes: number): Date {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);

    return expiresAt;
  }

  /**
   * Envia código pelo WhatsApp real.
   * Também mostra no console em desenvolvimento para facilitar teste.
   */
  private async sendWhatsAppCode(params: {
    phoneNumber: string;
    code: string;
    purpose: 'phone_verification' | 'password_reset';
  }) {
    const title =
      params.purpose === 'phone_verification'
        ? 'CÓDIGO DE VERIFICAÇÃO DO TELEFONE'
        : 'CÓDIGO DE RECUPERAÇÃO DE SENHA';

    console.log('===================================');
    console.log(title);
    console.log('Telefone:', params.phoneNumber);
    console.log('Código:', params.code);
    console.log('===================================');

    await this.whatsAppService.sendOtp({
      phoneNumber: params.phoneNumber,
      code: params.code,
    });
  }

  /**
   * Normaliza telefone para salvar, buscar e enviar WhatsApp.
   * Exemplo: +245 955 123 456 => 245955123456
   */
  private normalizePhone(phoneNumber: string): string {
    return String(phoneNumber || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/^\+/, '');
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