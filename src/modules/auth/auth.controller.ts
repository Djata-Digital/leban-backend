import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Cadastro público.
   * Nesta versão, o usuário cria conta, mas o telefone ainda precisa ser verificado.
   */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Confirma o número de telefone usando código enviado por WhatsApp.
   */
  @Public()
  @Post('verify-phone')
  async verifyPhone(
    @Body()
    dto: {
      phoneNumber: string;
      code: string;
    },
  ) {
    return this.authService.verifyPhone(dto.phoneNumber, dto.code);
  }

  /**
   * Reenvia código de verificação para o WhatsApp.
   */
  @Public()
  @Post('resend-phone-code')
  async resendPhoneCode(
    @Body()
    dto: {
      phoneNumber: string;
    },
  ) {
    return this.authService.resendPhoneCode(dto.phoneNumber);
  }

  /**
   * Login público.
   */
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Solicita código para redefinir senha via WhatsApp.
   */
  @Public()
  @Post('request-password-reset')
  async requestPasswordReset(
    @Body()
    dto: {
      phoneNumber: string;
    },
  ) {
    return this.authService.requestPasswordReset(dto.phoneNumber);
  }

  /**
   * Redefine a senha usando código recebido pelo WhatsApp.
   */
  @Public()
  @Post('reset-password')
  async resetPassword(
    @Body()
    dto: {
      phoneNumber: string;
      code: string;
      newPassword: string;
    },
  ) {
    return this.authService.resetPassword(
      dto.phoneNumber,
      dto.code,
      dto.newPassword,
    );
  }

  /**
   * Teste simples de autenticação.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: Record<string, any>) {
    return {
      message: 'Token válido.',
      user,
    };
  }
}