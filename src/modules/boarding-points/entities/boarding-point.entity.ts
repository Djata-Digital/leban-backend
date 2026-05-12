import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Route } from '../../routes/entities/route.entity';

@Entity('boarding_points')
export class BoardingPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Nome do ponto.
   * Ex:
   * Mercado Central
   * Aeroporto
   * Safim
   */
  @Column({
    name: 'name',
    type: 'varchar',
    length: 150,
  })
  name: string;

  /**
   * Ordem do embarque.
   * Ex:
   * 1 = primeiro ponto
   * 2 = segundo ponto
   */
  @Column({
    name: 'order_number',
    type: 'int',
  })
  orderNumber: number;

  /**
   * Rota deste ponto.
   */
  @ManyToOne(() => Route, {
    eager: true,
  })
  route: Route;

  /**
   * Indica se o ponto está ativo.
   */
  @Column({
    default: true,
  })
  active: boolean;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}