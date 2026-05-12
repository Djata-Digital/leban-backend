import { SetMetadata } from '@nestjs/common';

/**
 * Marca rota como pública, dispensando JWT.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);