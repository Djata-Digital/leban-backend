import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Route } from '../../routes/entities/route.entity';
import { VehicleType } from '../../vehicles/entities/vehicle.entity';

/**
 * Entidade que liga um vendedor a:
 * - uma rota
 * - um tipo de carro
 *
 * Exemplo:
 * João vende Bissau → Bafatá → autocarro
 */
@Entity('seller_routes')
@Unique(['seller', 'route', 'vehicleType'])
export class SellerRoute {
  /**
   * ID único do vínculo.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Usuário vendedor.
   */
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  seller: User;

  /**
   * Rota atribuída ao vendedor.
   */
  @ManyToOne(() => Route, { eager: true, onDelete: 'CASCADE' })
  route: Route;

  /**
   * Tipo de carro que o seller pode vender nesta rota.
   *
   * Default temporário:
   * usado para evitar erro em registros antigos do banco.
   */
  @Column({
    name: 'vehicle_type',
    type: 'enum',
    enum: VehicleType,
    default: VehicleType.SMALL_CAR,
  })
  vehicleType: VehicleType;

  /**
   * Data da atribuição.
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}