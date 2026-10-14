import { EventEmitter } from 'events'

export interface BridgeCardPayload {
  cid: string
  titleTh?: string
  firstNameTh?: string
  lastNameTh?: string
  fullNameTh?: string
  titleEn?: string
  firstNameEn?: string
  lastNameEn?: string
  fullNameEn?: string
  birthDate?: string
  gender?: string
  address?: string
  photo?: string
  issuer?: string
  issueDate?: string
  expireDate?: string
  rawPayload?: Record<string, any>
}

export interface BridgePushRequest {
  station: string
  action: 'heartbeat' | 'card_read' | 'card_removed'
  reader?: string
  cardPresent?: boolean
  card?: BridgeCardPayload
}

export interface BridgeStationState {
  station: string
  reader: string
  online: boolean
  cardPresent: boolean
  lastHeartbeat: number
  lastCard?: BridgeCardPayload | null
}

const DEFAULT_SECRET = process.env.SMARTCARD_BRIDGE_SECRET || 'thoen-smartcard-bridge-secret-2026'
const STATION_OFFLINE_TIMEOUT_MS = 8000

export class SmartCardBridgeHub extends EventEmitter {
  private stations: Map<string, BridgeStationState> = new Map()
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.setMaxListeners(200)
    // Periodic liveness monitor for stations
    this.cleanupTimer = setInterval(() => this.checkStationTimeouts(), 3000)
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  public verifyToken(token: string | null | undefined): boolean {
    if (!token) return false
    return token === DEFAULT_SECRET
  }

  public getStationState(stationId: string): BridgeStationState {
    const station = stationId.trim() || '1'
    const state = this.stations.get(station)
    if (!state) {
      return {
        station,
        reader: 'None',
        online: false,
        cardPresent: false,
        lastHeartbeat: 0,
        lastCard: null,
      }
    }

    const isAlive = Date.now() - state.lastHeartbeat < STATION_OFFLINE_TIMEOUT_MS
    return {
      ...state,
      online: isAlive,
    }
  }

  public handlePush(payload: BridgePushRequest): { success: boolean; error?: string } {
    const station = (payload.station || '1').trim()
    const now = Date.now()
    const prev = this.stations.get(station)

    const updatedState: BridgeStationState = {
      station,
      reader: payload.reader || prev?.reader || 'Generic PC/SC Card Reader',
      online: true,
      cardPresent: typeof payload.cardPresent === 'boolean' ? payload.cardPresent : (prev?.cardPresent ?? false),
      lastHeartbeat: now,
      lastCard: payload.card || prev?.lastCard || null,
    }

    if (payload.action === 'card_removed') {
      updatedState.cardPresent = false
      updatedState.lastCard = null
    } else if (payload.action === 'card_read' && payload.card) {
      updatedState.cardPresent = true
      updatedState.lastCard = payload.card
    }

    this.stations.set(station, updatedState)

    // Broadcast SSE events by station
    if (payload.action === 'card_read' && payload.card) {
      this.emit(`station:${station}`, 'card', payload.card)
    } else if (payload.action === 'card_removed') {
      this.emit(`station:${station}`, 'card_removed', { station })
    }

    // Always emit status update
    this.emit(`station:${station}`, 'status', {
      online: true,
      reader: updatedState.reader,
      cardPresent: updatedState.cardPresent,
    })

    return { success: true }
  }

  public subscribe(
    stationId: string,
    listener: (event: string, data: any) => void
  ): () => void {
    const station = (stationId || '1').trim()
    const eventName = `station:${station}`

    const handler = (event: string, data: any) => {
      listener(event, data)
    }

    this.on(eventName, handler)

    // Immediately emit current state to newly connected client
    const current = this.getStationState(station)
    listener('status', {
      online: current.online,
      reader: current.reader,
      cardPresent: current.cardPresent,
    })

    return () => {
      this.off(eventName, handler)
    }
  }

  private checkStationTimeouts(): void {
    const now = Date.now()
    for (const [station, state] of this.stations.entries()) {
      if (state.online && now - state.lastHeartbeat >= STATION_OFFLINE_TIMEOUT_MS) {
        state.online = false
        state.cardPresent = false
        this.emit(`station:${station}`, 'status', {
          online: false,
          reader: state.reader,
          cardPresent: false,
        })
      }
    }
  }
}

declare global {
  var __smartCardBridgeHub: SmartCardBridgeHub | undefined
}

export const smartCardBridgeHub =
  globalThis.__smartCardBridgeHub || (globalThis.__smartCardBridgeHub = new SmartCardBridgeHub())
