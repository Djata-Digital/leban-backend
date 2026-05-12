import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Trip } from '../../trips/entities/trip.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Passageiro que avaliou
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  reviewer: User;

  // Motorista avaliado (ou dono da viagem)
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  reviewedUser: User;

  // Viagem relacionada
  @ManyToOne(() => Trip, { eager: true, onDelete: 'CASCADE' })
  trip: Trip;

  @Column({ type: 'int' })
  rating: number; // 1 a 5

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @CreateDateColumn()
  createdAt: Date;
}