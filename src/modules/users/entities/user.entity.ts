import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../../../common/enums/role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';

/**
 * Entidade principal do usuário.
 * Aqui mantemos os dados centrais de login e perfil básico.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_USERS_PHONE', { unique: true })
  @Column({ name: 'phone_number', type: 'varchar', length: 30, unique: true })
  phoneNumber: string;

  @Index('IDX_USERS_EMAIL', { unique: true })
  @Column({ type: 'varchar', length: 150, unique: true, nullable: true })
  email?: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  nickname?: string | null;

  @Column({ name: 'profile_photo_url', type: 'text', nullable: true })
  profilePhotoUrl?: string | null;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.PASSENGER,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  /**
   * Campo temporário apenas para receber senha em texto puro
   * no momento de criação/alteração. Não é persistido no banco.
   */
  password?: string;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Faz o hash da senha antes de salvar no banco, se houver nova senha.
   */
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password && this.password.trim().length > 0) {
      const saltRounds = 10;
      this.passwordHash = await bcrypt.hash(this.password, saltRounds);
      this.password = undefined;
    }
  }

  /**
   * Compara senha informada com o hash salvo no banco.
   */
  async comparePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.passwordHash);
  }
}