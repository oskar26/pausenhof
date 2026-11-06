// Pausenhof Netzwerk-Kern – wiederverwendbar für alle Spiele.
// Prinzip: Der Browser, der eine Lobby erstellt, ist der "Host" (Spielserver).
// Der kostenlose PeerJS-Server vermittelt nur den ersten Kontakt (Signaling),
// danach laufen alle Daten direkt per WebRTC zwischen den Geräten.
// Benötigt global `Peer` (PeerJS, per <script> eingebunden).

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PUBLIC_SLOTS = 8;

export function randomCode(len = 4) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function makePeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { debug: 1 }) : new Peer({ debug: 1 });
    let done = false;
    peer.on('open', () => { done = true; resolve(peer); });
    peer.on('error', (err) => {
      if (!done) { done = true; try { peer.destroy(); } catch (e) {} reject(err); }
    });
    setTimeout(() => { if (!done) { done = true; try { peer.destroy(); } catch (e) {} reject(new Error('timeout')); } }, 12000);
  });
}

// Öffnet eine Datenverbindung zu einer Peer-ID. Gibt null zurück, wenn niemand da ist.
function connectTo(peer, targetId, timeout = 4000) {
  return new Promise((resolve) => {
    let done = false;
    const conn = peer.connect(targetId, { reliable: true });
    const finish = (v) => { if (!done) { done = true; peer.off('error', onErr); resolve(v); } };
    const onErr = (err) => {
      if (err && err.type === 'peer-unavailable' && String(err.message || '').includes(targetId)) finish(null);
    };
    peer.on('error', onErr);
    conn.on('open', () => finish(conn));
    conn.on('error', () => finish(null));
    setTimeout(() => { try { if (!done) conn.close(); } catch (e) {} finish(null); }, timeout);
  });
}

function ask(conn, msg, timeout = 3000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeout);
    conn.on('data', (d) => { if (d && d.t === 'info') { clearTimeout(t); resolve(d); } });
    conn.send(msg);
  });
}

/**
 * Room: eine Lobby für ein Spiel.
 *  - Als Host: room.onClientMessage(fromId, msg), room.onClientJoin(id), room.onClientLeave(id),
 *              room.broadcast(msg), room.sendTo(id, msg), room.getInfo = () => ({...})
 *  - Als Client: room.onHostMessage(msg), room.onHostLost()
 *  - Beide: room.send(msg) schickt an den Host (beim Host lokal verarbeitet).
 */
export class Room {
  constructor(gameId) {
    this.gameId = gameId;
    this.prefix = `pausenhof-${gameId}-`;
    this.peer = null;
    this.isHost = false;
    this.conns = new Map(); // nur Host: id -> conn
    this.hostConn = null;
    this.code = null;
    this.isPublic = false;
    this.getInfo = () => ({});
    this.onClientMessage = () => {};
    this.onClientJoin = () => {};
    this.onClientLeave = () => {};
    this.onHostMessage = () => {};
    this.onHostLost = () => {};
  }

  get myId() { return this.peer ? this.peer.id : null; }

  _privateId(code) { return `${this.prefix}p-${code.toUpperCase()}`; }
  _publicId(n) { return `${this.prefix}pub-${n}`; }

  async _becomeHost(peer) {
    this.peer = peer;
    this.isHost = true;
    peer.on('connection', (conn) => {
      conn.on('data', (msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'info?') { conn.send({ t: 'info', ...this.getInfo() }); return; }
        if (msg.t === 'hello' && !this.conns.has(conn.peer)) {
          this.conns.set(conn.peer, conn);
          this.onClientJoin(conn.peer, msg);
          return;
        }
        if (this.conns.has(conn.peer)) this.onClientMessage(conn.peer, msg);
      });
      const drop = () => {
        if (this.conns.get(conn.peer) === conn) {
          this.conns.delete(conn.peer);
          this.onClientLeave(conn.peer);
        }
      };
      conn.on('close', drop);
      conn.on('error', drop);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }

  async createPrivate() {
    for (let i = 0; i < 6; i++) {
      const code = randomCode();
      try {
        const peer = await makePeer(this._privateId(code));
        this.code = code; this.isPublic = false;
        await this._becomeHost(peer);
        return code;
      } catch (e) {
        if (!e || e.type !== 'unavailable-id') throw e;
      }
    }
    throw new Error('Kein freier Lobby-Code gefunden');
  }

  async createPublic() {
    for (let n = 1; n <= PUBLIC_SLOTS; n++) {
      try {
        const peer = await makePeer(this._publicId(n));
        this.code = `Ö${n}`; this.isPublic = true;
        await this._becomeHost(peer);
        return n;
      } catch (e) {
        if (!e || e.type !== 'unavailable-id') throw e;
      }
    }
    throw new Error('Alle öffentlichen Lobbys sind belegt');
  }

  async _joinId(targetId, hello) {
    const peer = await makePeer();
    const conn = await connectTo(peer, targetId, 6000);
    if (!conn) { peer.destroy(); return false; }
    this.peer = peer; this.hostConn = conn; this.isHost = false;
    conn.on('data', (msg) => this.onHostMessage(msg));
    conn.on('close', () => this.onHostLost());
    conn.on('error', () => this.onHostLost());
    conn.send({ t: 'hello', ...hello });
    return true;
  }

  async joinPrivate(code, hello) {
    this.code = code.toUpperCase();
    return this._joinId(this._privateId(code), hello);
  }

  async joinPublic(n, hello) {
    this.code = `Ö${n}`; this.isPublic = true;
    return this._joinId(this._publicId(n), hello);
  }

  // Fragt alle öffentlichen Slots ab. Gibt [{slot, ...info}] zurück.
  static async listPublic(gameId) {
    const prefix = `pausenhof-${gameId}-`;
    const peer = await makePeer();
    const results = await Promise.all(
      Array.from({ length: PUBLIC_SLOTS }, (_, i) => i + 1).map(async (n) => {
        const conn = await connectTo(peer, `${prefix}pub-${n}`, 4000);
        if (!conn) return null;
        const info = await ask(conn, { t: 'info?' });
        try { conn.close(); } catch (e) {}
        return info ? { slot: n, ...info } : null;
      })
    );
    setTimeout(() => peer.destroy(), 500);
    return results.filter(Boolean);
  }

  send(msg) {
    if (this.isHost) this.onClientMessage(this.myId, msg);
    else if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
  }

  sendTo(id, msg) {
    if (id === this.myId) { this.onHostMessage(msg); return; }
    const c = this.conns.get(id);
    if (c && c.open) c.send(msg);
  }

  broadcast(msg) {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
    this.onHostMessage(msg); // Host sieht seine eigene Nachricht auch
  }

  kick(id) {
    const c = this.conns.get(id);
    if (c) { this.conns.delete(id); try { c.close(); } catch (e) {} }
  }

  leave() {
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    this.peer = null; this.conns.clear(); this.hostConn = null;
  }
}
