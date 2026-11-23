import type {
  RawOrderLineInput,
  ExtractedSpatialMetadata,
  SpatialProvenance,
  OrderSpatialContext,
} from '@/types/order-intake';

export type { OrderSpatialContext };

export class SpatialExtractionEngine {
  private static readonly ROOM_FLOOR_MAP: Record<string, string> = {
    woonkamer: 'Begane grond',
    living: 'Begane grond',
    keuken: 'Begane grond',
    hal: 'Begane grond',
    entree: 'Begane grond',
    gang: 'Begane grond',
    toilet: 'Begane grond',
    bijkeuken: 'Begane grond',
    eetkamer: 'Begane grond',
    serre: 'Begane grond',
    garage: 'Begane grond',
    slaapkamer: '1e verdieping',
    'slaapkamer 1': '1e verdieping',
    'slaapkamer 2': '1e verdieping',
    'slaapkamer 3': '1e verdieping',
    badkamer: '1e verdieping',
    overloop: '1e verdieping',
    kantoor: '1e verdieping',
    werkkamer: '1e verdieping',
    zolder: 'Zolder',
    vliering: 'Zolder',
    souterrain: 'Kelder',
    kelder: 'Kelder',
  };

  public buildOrderContext(lines: RawOrderLineInput[]): OrderSpatialContext {
    const orderFloors = new Set<string>();
    const orderRooms = new Set<string>();
    const existingPositionsByRoom = new Map<string, string[]>();

    for (const line of lines) {
      if (line.etage_name && String(line.etage_name).trim()) {
        orderFloors.add(String(line.etage_name).trim());
      }
      if (line.room_name && String(line.room_name).trim()) {
        const r = String(line.room_name).trim();
        orderRooms.add(r);
        if (line.position_id && String(line.position_id).trim()) {
          if (!existingPositionsByRoom.has(r)) {
            existingPositionsByRoom.set(r, []);
          }
          existingPositionsByRoom.get(r)!.push(String(line.position_id).trim());
        }
      }
      if (line.notes && typeof line.notes === 'string') {
        const notesHints = this.extractSpatialFromNotes(line.notes);
        if (notesHints.etage_name) {
          orderFloors.add(notesHints.etage_name);
        }
        if (notesHints.room_name) {
          orderRooms.add(notesHints.room_name);
          if (notesHints.position_id) {
            if (!existingPositionsByRoom.has(notesHints.room_name)) {
              existingPositionsByRoom.set(notesHints.room_name, []);
            }
            existingPositionsByRoom.get(notesHints.room_name)!.push(notesHints.position_id);
          }
        }
      }
    }

    return {
      orderFloors,
      orderRooms,
      existingPositionsByRoom,
    };
  }

  public extractSpatialMetadata(
    line: RawOrderLineInput,
    groupCode: string,
    orderContext?: OrderSpatialContext
  ): ExtractedSpatialMetadata {
    const notesHints = line.notes ? this.extractSpatialFromNotes(line.notes) : {};

    let roomName: string | null = line.room_name?.trim() || notesHints.room_name || null;
    let roomSource: SpatialProvenance | undefined = line.room_name?.trim()
      ? 'EXPLICIT'
      : notesHints.room_source;

    let windowName: string | null = line.window_name?.trim() || notesHints.window_name || null;
    let posSource: SpatialProvenance | undefined = line.window_name?.trim()
      ? 'EXPLICIT'
      : notesHints.pos_source;

    let positionId: string | null = line.position_id?.trim() || notesHints.position_id || null;
    const clusterName: string | null = line.cluster_name?.trim() || notesHints.cluster_name || null;
    const clusterSource: SpatialProvenance | undefined = line.cluster_name?.trim()
      ? 'EXPLICIT'
      : notesHints.cluster_source;

    let etageName: string | null = line.etage_name ? String(line.etage_name).trim() : notesHints.etage_name || null;
    let etageSource: SpatialProvenance | undefined = line.etage_name
      ? 'EXPLICIT'
      : notesHints.etage_source;

    // Disambiguation using orderContext:
    if (!roomName && windowName && orderContext && orderContext.orderRooms.size === 1) {
      roomName = Array.from(orderContext.orderRooms)[0];
      roomSource = 'INFERRED';
    }

    // Infer floor if room is known but floor missing
    if (roomName && !etageName) {
      const inferred = this.inferFloorForRoom(roomName, orderContext?.orderFloors);
      if (inferred.etage_name) {
        etageName = inferred.etage_name;
        etageSource = inferred.etage_source;
      }
    }

    // Infer position if room is known but position missing
    if (roomName && !positionId) {
      const existingPositions = orderContext?.existingPositionsByRoom.get(roomName) || [];
      const inferredPos = this.inferPositionForRoom(roomName, groupCode, existingPositions);
      positionId = inferredPos.position_id;
      if (!windowName) {
        windowName = inferredPos.window_name;
        posSource = inferredPos.pos_source;
      }
      if (orderContext) {
        if (!orderContext.existingPositionsByRoom.has(roomName)) {
          orderContext.existingPositionsByRoom.set(roomName, []);
        }
        orderContext.existingPositionsByRoom.get(roomName)!.push(positionId);
      }
    }

    // Buffer position for physical unassigned material lines
    if (!positionId) {
      positionId = `pos_onbekend_${line.line_number}`;
      windowName = windowName || 'Pos. N.t.b.';
      posSource = 'INFERRED';
    }

    return {
      etage_name: etageName,
      etage_source: etageSource,
      room_name: roomName,
      room_source: roomSource,
      window_name: windowName,
      position_id: positionId,
      pos_source: posSource,
      cluster_name: clusterName,
      cluster_source: clusterSource,
    };
  }

  public extractSpatialFromNotes(notes: string): Partial<ExtractedSpatialMetadata> {
    if (!notes || typeof notes !== 'string') {
      return {
        etage_name: null,
        room_name: null,
        window_name: null,
        cluster_name: null,
      };
    }

    const clean = notes.replace(/^[-–—*#\s]+/, '').trim();
    if (!clean) {
      return {
        etage_name: null,
        room_name: null,
        window_name: null,
        cluster_name: null,
      };
    }

    let etageName: string | null = null;
    let etageSource: SpatialProvenance | undefined = undefined;
    let roomName: string | null = null;
    let roomSource: SpatialProvenance | undefined = undefined;
    let windowName: string | null = null;
    let posSource: SpatialProvenance | undefined = undefined;
    let clusterName: string | null = null;
    let clusterSource: SpatialProvenance | undefined = undefined;

    // 1. Detect Floor patterns
    const floorMatch = clean.match(/(?:(?:op\s+de\s+)?([1-4]e\s+verdieping|begane\s+grond|zolder|kelder|souterrain|vliering))/i);
    if (floorMatch) {
      etageName = this.normalizeFloorName(floorMatch[1].trim());
      etageSource = 'EXPLICIT';
    }

    // 2. Detect Room patterns
    const roomMatch = clean.match(/\b(woonkamer|living|keuken|hal|entree|gang|toilet|bijkeuken|eetkamer|serre|slaapkamer(?:\s+\d+)?|badkamer|overloop|kantoor|werkkamer|zolder|kelder)\b/i);
    if (roomMatch) {
      roomName = this.normalizeRoomName(roomMatch[1].trim());
      roomSource = 'EXPLICIT';
    }

    // 3. Detect Cluster patterns
    const clusterMatch = clean.match(/\b(erker(?:cluster)?|hoekopstelling|gevel|dakkapel)\b/i);
    if (clusterMatch) {
      const rawCluster = clusterMatch[1].toLowerCase();
      if (rawCluster.includes('erker')) {
        clusterName = 'Erkercluster';
      } else if (rawCluster.includes('hoek')) {
        clusterName = 'Hoekopstelling';
      } else {
        clusterName = clusterMatch[1];
      }
      clusterSource = 'EXPLICIT';
    }

    // 4. Detect Window / Position patterns
    const windowMatch = clean.match(/\b(raam\s+(?:links|rechts|voorzijde|achterzijde|midden|\d+)|voorzijde|achterzijde|zijraam(?:\s+\d+)?|schuifpui|balkondeur|dakraam|lichtkoepel|erker\s+raam\s+\d+|raam\s+\d+)\b/i);
    if (windowMatch) {
      const matched = windowMatch[1].trim();
      if (clean.toLowerCase().includes('erker raam')) {
        const erkerNum = clean.match(/erker\s+raam\s+(\d+)/i);
        windowName = erkerNum ? `Raam ${erkerNum[1]}` : this.formatWindowName(matched);
      } else {
        windowName = this.formatWindowName(matched);
      }
      posSource = 'EXPLICIT';
    } else if (clean.match(/\bpos(?:itie)?\.?\s*(\d+)\b/i)) {
      const numMatch = clean.match(/\bpos(?:itie)?\.?\s*(\d+)\b/i)!;
      windowName = `Pos. ${numMatch[1].padStart(2, '0')}`;
      posSource = 'EXPLICIT';
    }

    // Infer floor if room explicit but floor absent
    if (roomName && !etageName) {
      const inferred = this.inferFloorForRoom(roomName);
      if (inferred.etage_name) {
        etageName = inferred.etage_name;
        etageSource = inferred.etage_source;
      }
    }

    return {
      etage_name: etageName,
      etage_source: etageSource,
      room_name: roomName,
      room_source: roomSource,
      window_name: windowName,
      pos_source: posSource,
      cluster_name: clusterName,
      cluster_source: clusterSource,
    };
  }

  public inferFloorForRoom(
    roomName: string,
    orderFloors?: Set<string>
  ): { etage_name: string | null; etage_source: SpatialProvenance } {
    const lower = roomName.toLowerCase().trim();
    for (const [key, floor] of Object.entries(SpatialExtractionEngine.ROOM_FLOOR_MAP)) {
      if (lower.startsWith(key) || lower.includes(key)) {
        return { etage_name: floor, etage_source: 'INFERRED' };
      }
    }

    if (orderFloors && orderFloors.size === 1) {
      return { etage_name: Array.from(orderFloors)[0], etage_source: 'INFERRED' };
    }

    return { etage_name: null, etage_source: 'INFERRED' };
  }

  public inferPositionForRoom(
    roomName: string,
    groupCode: string,
    existingPositions?: string[]
  ): { position_id: string; window_name: string; pos_source: SpatialProvenance } {
    const slug = roomName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const existing = existingPositions || [];

    let idx = 1;
    let candidateId = `pos_${slug}_${String(idx).padStart(2, '0')}`;
    while (existing.includes(candidateId)) {
      idx++;
      candidateId = `pos_${slug}_${String(idx).padStart(2, '0')}`;
    }

    return {
      position_id: candidateId,
      window_name: `Pos. ${String(idx).padStart(2, '0')} (N.t.b.)`,
      pos_source: 'INFERRED',
    };
  }

  private normalizeFloorName(floor: string): string {
    const lower = floor.toLowerCase().trim();
    if (lower.includes('begane') || lower.includes('bg')) return 'Begane grond';
    if (lower.includes('1e') || lower.includes('eerste')) return '1e verdieping';
    if (lower.includes('2e') || lower.includes('tweede')) return '2e verdieping';
    if (lower.includes('3e') || lower.includes('derde')) return '3e verdieping';
    if (lower.includes('zolder') || lower.includes('vliering')) return 'Zolder';
    if (lower.includes('kelder') || lower.includes('souterrain')) return 'Kelder';
    return this.capitalizeWords(floor);
  }

  private normalizeRoomName(room: string): string {
    const lower = room.toLowerCase().trim();
    if (lower === 'woonkamer' || lower === 'living') return 'Woonkamer';
    if (lower === 'keuken') return 'Keuken';
    if (lower === 'hal' || lower === 'entree') return 'Hal';
    if (lower === 'toilet') return 'Toilet';
    if (lower === 'badkamer') return 'Badkamer';
    if (lower === 'overloop') return 'Overloop';
    if (lower === 'zolder') return 'Zolder';
    if (lower === 'kelder') return 'Kelder';
    return this.capitalizeWords(room);
  }

  private formatWindowName(str: string): string {
    const parts = str.split(/\s+/);
    if (parts.length === 0) return '';
    const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const rest = parts.slice(1).map((w) => {
      if (/^\d+$/.test(w)) return w;
      return w.toLowerCase();
    });
    return [first, ...rest].join(' ');
  }

  private capitalizeWords(str: string): string {
    return str
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}
