import { PartialType } from '@nestjs/mapped-types';
import { CreateRouteDto } from './create-route.dto';

/**
 * DTO usado para atualizar uma rota.
 * PartialType transforma todos os campos do CreateRouteDto em opcionais.
 */
export class UpdateRouteDto extends PartialType(CreateRouteDto) {}