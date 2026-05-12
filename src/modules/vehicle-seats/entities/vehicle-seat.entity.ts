import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

/**
 * Entidade que representa um assento dentro de um veículo.
 * Cada veículo pode ter vários assentos.
 */
@Entity('vehicle_seats')
export class VehicleSeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Relação com o veículo
   * Um assento pertence a um veículo
   */
  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  vehicle: Vehicle;

  /**
   * Número do assento (1, 2, 3...)
   */
  @Column()
  seatNumber: number;

  /**
   * Código do assento (A1, B2, etc.)
   */
  @Column()
  seatLabel: string;

  /**
   * Tipo do assento (normal, premium, etc.)
   */
  @Column({ default: 'normal' })
  seatType: string;

  /**
   * Se o assento está ativo ou não
   */
  @Column({ default: true })
  active: boolean;

  /**
   * Data de criação
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Data de atualização
   */
  @UpdateDateColumn()
  updatedAt: Date;
}