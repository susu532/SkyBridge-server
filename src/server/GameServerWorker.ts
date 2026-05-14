import Database from 'better-sqlite3';
import { createGameServer } from './GameServer.ts';
import { HubMode } from './modes/HubMode.ts';
import { SkyBridgeMode } from './modes/SkyBridgeMode.ts';
import { SkyCastlesMode } from './modes/SkyCastlesMode.ts';
import { VoidTrailMode } from './modes/VoidTrailMode.ts';
import { DungeonDelverMode } from './modes/DungeonDelverMode.ts';
import { BattleRoyaleMode } from './modes/BattleRoyaleMode.ts';
import { encodePacket, decodePacket } from './WSHelpers.ts';
import { parentPort, workerData } from 'worker_threads';
import { WebSocketServer } from 'ws';

// Extract data passed from main thread via workerData
const baseName = workerData?.BASE_NAME || 'hub';
const instanceId = workerData?.INSTANCE_ID || '/hub_1';

function getModeFactory(name: string) {
  if (name === 'hub') return new HubMode();
  if (name === 'skybridge') return new SkyBridgeMode();
  if (name === 'skycastles') return new SkyCastlesMode('/skycastles');
  if (name === 'voidtrail') return new VoidTrailMode('/voidtrail');
  if (name === 'dungeondelver') return new DungeonDelverMode();
  if (name === 'battleroyale') return new BattleRoyaleMode();
  return new HubMode();
}

const mode = getModeFactory(baseName);
mode.name = instanceId; // set namespace prefix properly

let db: Database.Database;
try {
  const sanitized = instanceId.replace(/[^a-zA-Z0-9_-]/g, '');
  db = new Database(`db_${sanitized}.db`);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunk_data (
      world TEXT,
      chunk_id TEXT,
      data BLOB,
      PRIMARY KEY (world, chunk_id)
    );
    CREATE TABLE IF NOT EXISTS world_npcs (
      world TEXT,
      data TEXT,
      PRIMARY KEY (world)
    );
  `);
} catch (err) {
  console.error("Worker DB init failed:", err);
  process.exit(1);
}

// We need a pseudo-socket.io API wrapped over the wss server to maintain compatibility with SocketHandlers.ts
class FakeIoNamespace {
  public sockets: Map<string, FakeSocket> = new Map();
  public rooms: Map<string, Set<FakeSocket>> = new Map();
  public handlers: Record<string, Function> = {};
  
  on(event: string, handler: Function) {
    this.handlers[event] = handler;
  }
  
  emit(event: string, ...args: any[]) {
    const packet = encodePacket(event, args);
    for (const socket of this.sockets.values()) {
       socket.ws.send(packet);
    }
  }

  to(room: string) {
    const rm = this.rooms.get(room);
    const res = {
      emit: (event: string, ...args: any[]) => {
        if (rm) {
           const packet = encodePacket(event, args);
           for (const socket of rm) {
              socket.ws.send(packet);
           }
        }
      },
      except: (excludeId: string) => ({
        emit: (event: string, ...args: any[]) => {
          if (rm) {
             const packet = encodePacket(event, args);
             for (const socket of rm) {
                if (socket.id !== excludeId) socket.ws.send(packet);
             }
          }
        }
      })
    };
    (res as any).volatile = res;
    return res;
  }

  disconnectSockets(closeUnclosed: boolean) {
    for (const socket of this.sockets.values()) {
        socket.ws.terminate();
    }
    this.sockets.clear();
  }

  removeAllListeners() {
    this.handlers = {};
  }
}

class FakeSocket {
  public id: string;
  public ws: any;
  public handlers: Record<string, Function> = {};
  public broadcast: any;
  public rooms = new Set<string>();
  public volatile: any;
  
  constructor(id: string, ws: any, private nsp: FakeIoNamespace) {
    this.id = id;
    this.ws = ws;
    this.volatile = this;
    this.broadcast = {
      emit: (event: string, ...args: any[]) => {
        const packet = encodePacket(event, args);
        for (const s of this.nsp.sockets.values()) {
           if (s.id !== id) s.ws.send(packet);
        }
      }
    };
    (this.broadcast as any).volatile = this.broadcast;

    ws.on('message', (data: any, isBinary: boolean) => {
       // decode packet
       const parsed = decodePacket(data);
       if (parsed && this.handlers[parsed.event]) {
           this.handlers[parsed.event](...parsed.args);
       }
    });

    ws.on('close', () => {
       for (const room of this.rooms) {
          const rm = this.nsp.rooms.get(room);
          if (rm) rm.delete(this);
       }
       this.nsp.sockets.delete(id);
       if (this.handlers['disconnect']) this.handlers['disconnect']();
    });
  }
  
  on(event: string, handler: Function) {
    this.handlers[event] = handler;
  }
  
  emit(event: string, ...args: any[]) {
    this.ws.send(encodePacket(event, args));
  }
  
  join(room: string) {
    this.rooms.add(room);
    let rm = this.nsp.rooms.get(room);
    if (!rm) {
       rm = new Set();
       this.nsp.rooms.set(room, rm);
    }
    rm.add(this);
  }
  
  leave(room: string) {
    this.rooms.delete(room);
    const rm = this.nsp.rooms.get(room);
    if (rm) rm.delete(this);
  }
  
  disconnect(close: boolean) {
    this.ws.terminate();
  }
}

const fakeIo = new FakeIoNamespace();

const fakeServer = {
  of: (name: string) => fakeIo
};

const api = createGameServer(fakeServer as any, db, mode);

const wss = new WebSocketServer({ noServer: true });

if (parentPort) {
  // Periodically send the player count to the main thread
  setInterval(() => {
    parentPort!.postMessage({ type: 'playerCount', count: fakeIo.sockets.size });
  }, 5000);

  parentPort.on('message', (msg: any) => {
    if (msg && msg.type === 'new_client') {
       const port = msg.port;
       const id = Math.random().toString(36).substring(2, 10);
       
       const fakeWs = {
          handlers: {} as Record<string, Function>,
          on: function(event: string, handler: Function) {
              this.handlers[event] = handler;
          },
          send: function(data: any) {
              port.postMessage({ type: 'message', data });
          },
          terminate: function() {
              port.postMessage({ type: 'close' });
              port.close();
          }
       };

       port.on('message', (m: any) => {
         if (m.type === 'message') {
             if (fakeWs.handlers['message']) {
                 fakeWs.handlers['message'](m.data, m.isBinary);
             }
         } else if (m.type === 'close') {
             if (fakeWs.handlers['close']) {
                 fakeWs.handlers['close']();
             }
             port.close();
         }
       });
       
       port.on('close', () => {
           if (fakeWs.handlers['close']) {
               fakeWs.handlers['close']();
           }
       });

       const fakeSocket = new FakeSocket(id, fakeWs, fakeIo);
       
       fakeIo.sockets.set(id, fakeSocket);
       fakeWs.send(encodePacket('set_id', [id]));
       
       if (fakeIo.handlers['connection']) {
           fakeIo.handlers['connection'](fakeSocket);
       }
    } else if (msg && msg.type === 'destroy') {
      if (api && (api as any).destroy) (api as any).destroy();
      db.close();
      process.exit(0);
    }
  });
}


