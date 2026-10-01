import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';

// URL centralizada en lib/config.ts (EXPO_PUBLIC_SOCKET_URL o fallback dev).

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
