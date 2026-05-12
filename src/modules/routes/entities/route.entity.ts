import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entidade que representa uma rota comercial.
 * Exemplo: Bissau -> Bafatá.
 */
@Entity('routes')
export class Route {
  /**
   * Identificador único da rota.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Cidade/local de origem da rota.
   */
  @Column({ name: 'origin_name', type: 'varchar', length: 150 })
  originName: string;

  /**
   * Cidade/local de destino da rota.
   */
  @Column({ name: 'destination_name', type: 'varchar', length: 150 })
  destinationName: string;

  /**
   * Distância aproximada em quilômetros.
   */
  @Column({ name: 'distance_km', type: 'numeric', precision: 10, scale: 2, nullable: true })
  distanceKm?: number | null;

  /**
   * Duração estimada da viagem em minutos.
   */
  @Column({ name: 'estimated_duration_minutes', type: 'int', nullable: true })
  estimatedDurationMinutes?: number | null;

  /**
   * Preço base da passagem.
   */
  @Column({ name: 'base_price', type: 'numeric', precision: 12, scale: 2 })
  basePrice: number;

  /**
   * Indica se a rota está ativa para vendas.
   */
  @Column({ default: true })
  active: boolean;

  /**
   * Data de criação.
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Data da última atualização.
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}