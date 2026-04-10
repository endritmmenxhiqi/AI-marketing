import { EventEmitter } from 'node:events';

export const localJobEvents = new EventEmitter();
localJobEvents.setMaxListeners(200);
