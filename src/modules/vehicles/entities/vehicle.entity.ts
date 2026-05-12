import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Route } from '../../routes/entities/route.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Tipos de serviço disponíveis no sistema.
 * Isso representa o tipo de carro na Guiné-Bissau.
 */
export enum VehicleType {
  SMALL_CAR = 'small_car',
  LARGE_CAR = 'large_car',
  BUS = 'bus',
}

/**
 * Entidade de veículos do sistema.
 * Cada veículo pertence a uma rota e pode ter um motorista associado.
 */
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plate_number', unique: true })
  plateNumber: string;

  @Column()
  model: string;

  @Column()
  brand: string;

  @Column()
  color: string;

  @Column({ name: 'manufacture_year' })
  manufactureYear: number;

  @Column({ name: 'seat_count' })
  seatCount: number;

  @Column({
    name: 'vehicle_type',
    type: 'enum',
    enum: VehicleType,
    default: VehicleType.SMALL_CAR,
  })
  vehicleType: VehicleType;

  /**
   * Foto/imagem do veículo.
   * Será usada no app do passageiro e motorista.
   */
  @Column({
    name: 'vehicle_image_url',
    type: 'text',
    nullable: true,
  })
  vehicleImageUrl?: string | null;

  /**
   * Nome do proprietário do veículo.
   */
  @Column({
    name: 'owner_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  ownerName?: string | null;

  /**
   * Telefone do proprietário.
   */
  @Column({
    name: 'owner_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  ownerPhone?: string | null;

  /**
   * Comissão fixa do vendedor por passagem vendida.
   */
  @Column({
    name: 'seller_commission_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  sellerCommissionAmount: number;

  /**
   * Rota onde o veículo opera.
   */
  @ManyToOne(() => Route, {
    eager: true,
    nullable: true,
  })
  route?: Route | null;

  /**
   * Motorista associado ao veículo.
   */
  @ManyToOne(() => User, {
    eager: true,
    nullable: true,
  })
  driver?: User | null;

  /**
   * Veículo ativo/inativo.
   */
  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}