import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

/**
 * Chave usada pelo guard para ler as roles permitidas.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator para definir quais perfis podem acessar uma rota.
 *
 * Exemplo:
 * @Roles(Role.ADMIN)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);