import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinUserRoom')
  joinUserRoom(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!userId) {
      return {
        message: 'userId inválido.',
      };
    }

    client.join(`user:${userId}`);

    return {
      message: `Usuário entrou na sala user:${userId}`,
    };
  }

  @SubscribeMessage('leaveUserRoom')
  leaveUserRoom(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!userId) {
      return {
        message: 'userId inválido.',
      };
    }

    client.leave(`user:${userId}`);

    return {
      message: `Usuário saiu da sala user:${userId}`,
    };
  }

  /**
   * Entra na sala da viagem.
   * Usado na tela de seleção de assentos.
   */
  @SubscribeMessage('joinTripRoom')
  joinTripRoom(
    @MessageBody() tripId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!tripId) {
      return {
        message: 'tripId inválido.',
      };
    }

    client.join(`trip:${tripId}`);

    return {
      message: `Usuário entrou na sala trip:${tripId}`,
    };
  }

  /**
   * Sai da sala da viagem.
   */
  @SubscribeMessage('leaveTripRoom')
  leaveTripRoom(
    @MessageBody() tripId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!tripId) {
      return {
        message: 'tripId inválido.',
      };
    }

    client.leave(`trip:${tripId}`);

    return {
      message: `Usuário saiu da sala trip:${tripId}`,
    };
  }

  sendNotificationToUser(userId: string, notification: any) {
    if (!userId) return;

    this.server.to(`user:${userId}`).emit('newNotification', notification);
  }

  sendUnreadCountToUser(userId: string, count: number) {
    if (!userId) return;

    this.server.to(`user:${userId}`).emit('notificationUnreadCount', {
      count,
    });
  }

  /**
   * Envia atualização de assento para todos que estão na tela da mesma viagem.
   */
  sendSeatUpdateToTrip(tripId: string, payload: any) {
    if (!tripId) return;

    this.server.to(`trip:${tripId}`).emit('seatUpdated', payload);
  }

  /**
   * Envia atualização geral da viagem: lugares disponíveis, status etc.
   */
  sendTripUpdate(tripId: string, payload: any) {
    if (!tripId) return;

    this.server.to(`trip:${tripId}`).emit('tripUpdated', payload);
  }
}