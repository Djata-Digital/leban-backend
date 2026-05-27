import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  constructor(private readonly configService: ConfigService) {}

  async sendOtp(params: {
    phoneNumber: string;
    code: string;
  }): Promise<void> {
    const token = this.configService.get<string>('WHATSAPP_TOKEN');
    const phoneNumberId = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );

    const templateName =
      this.configService.get<string>('WHATSAPP_TEMPLATE_NAME') ||
      'authentication_code_copy_code_button';

    const templateLanguage =
      this.configService.get<string>('WHATSAPP_TEMPLATE_LANGUAGE') ||
      'pt_BR';

    if (!token || !phoneNumberId) {
      console.log('===================================');
      console.log('WHATSAPP NÃO CONFIGURADO');
      console.log('Telefone:', params.phoneNumber);
      console.log('Código:', params.code);
      console.log('===================================');
      return;
    }

    const cleanPhone = this.normalizePhone(params.phoneNumber);

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: params.code,
              },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: params.code,
              },
            ],
          },
        ],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error('Erro WhatsApp Cloud API:', errorText);

      throw new InternalServerErrorException(
        'Não foi possível enviar código pelo WhatsApp.',
      );
    }
  }

  private normalizePhone(phoneNumber: string): string {
    return String(phoneNumber || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/^\+/, '');
  }
}