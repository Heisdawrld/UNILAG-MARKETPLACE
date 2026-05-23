import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DeliveryOrderStatus, DeliveryCategory, UrgencyLevel, TransportMode } from '@/lib/delivery-types'

export interface IncomingDeliveryRequest {
  orderId: string; customerPrice: number; category: DeliveryCategory; urgency: UrgencyLevel
  title: string; pickupLat: number; pickupLng: number; pickupAddress: string
  dropoffLat: number; dropoffLng: number; dropoffAddress: string
  estimatedDistanceMeters: number; estimatedDurationMinutes: number; surgeMultiplier: number; receivedAt: number
}

export interface ActiveDelivery {
  orderId: string; status: DeliveryOrderStatus; customerUsername: string; customerPhone: string | null
  customerAvatar: string | null; pickupLat: number; pickupLng: number; pickupAddress: string
  dropoffLat: number; dropoffLng: number; dropoffAddress: string; pickupCode: string
  finalPrice: number | null; estimatedDistanceMeters: number | null; estimatedDurationMinutes: number | null; assignedAt: string
}

export interface DeliveryEarnings {
  today: number; week: number; month: number; totalDeliveries: number; avgRating: number; pendingPayout: number
}

export interface DeliveryHistoryItem {
  id: string; title: string; category: DeliveryCategory; finalPrice: number
  status: DeliveryOrderStatus; completedAt: string | null; customerRating: number | null
  customerReview: string | null; estimatedDistanceMeters: number | null
}

export type RunnerView = 'dashboard' | 'request' | 'active' | 'earnings' | 'history'

interface RunnerState {
  isSocketConnected: boolean; setSocketConnected: (connected: boolean) => void
  isOnline: boolean; setIsOnline: (online: boolean) => void
  transportMode: TransportMode; setTransportMode: (mode: TransportMode) => void
  currentLat: number | null; currentLng: number | null; currentHeading: number | null
  currentSpeed: number | null; locationUpdatedAt: number | null
  setLocation: (lat: number, lng: number, heading?: number | null, speed?: number | null) => void
  gpsAccuracy: number | null; setGpsAccuracy: (accuracy: number | null) => void
  incomingRequests: IncomingDeliveryRequest[]; addIncomingRequest: (request: IncomingDeliveryRequest) => void
  removeIncomingRequest: (orderId: string) => void; clearIncomingRequests: () => void
  currentRequestId: string | null; setCurrentRequestId: (id: string | null) => void
  activeDelivery: ActiveDelivery | null; setActiveDelivery: (delivery: ActiveDelivery | null) => void
  updateActiveDeliveryStatus: (status: DeliveryOrderStatus) => void
  currentView: RunnerView; setCurrentView: (view: RunnerView) => void
  earnings: DeliveryEarnings; setEarnings: (earnings: DeliveryEarnings) => void
  deliveryHistory: DeliveryHistoryItem[]; setDeliveryHistory: (history: DeliveryHistoryItem[]) => void
  addHistoryItem: (item: DeliveryHistoryItem) => void
  totalCompleted: number; runnerRating: number; setStats: (completed: number, rating: number) => void
  rejectedOrderIds: string[]; addRejectedOrderId: (id: string) => void
  missedCount: number; incrementMissed: () => void; resetMissed: () => void
}

export const useRunnerStore = create<RunnerState>()(
  persist(
    (set, get) => ({
      isSocketConnected: false, setSocketConnected: (connected) => set({ isSocketConnected: connected }),
      isOnline: false, setIsOnline: (online) => set({ isOnline: online }),
      transportMode: 'walking', setTransportMode: (mode) => set({ transportMode: mode }),
      currentLat: null, currentLng: null, currentHeading: null, currentSpeed: null, locationUpdatedAt: null, gpsAccuracy: null,
      setLocation: (lat, lng, heading, speed) => set({ currentLat: lat, currentLng: lng, currentHeading: heading ?? null, currentSpeed: speed ?? null, locationUpdatedAt: Date.now() }),
      setGpsAccuracy: (accuracy) => set({ gpsAccuracy: accuracy }),
      incomingRequests: [],
      addIncomingRequest: (request) => { const state = get(); if (state.incomingRequests.some(r => r.orderId === request.orderId)) return; if (state.rejectedOrderIds.includes(request.orderId)) return; set({ incomingRequests: [...state.incomingRequests, request] }) },
      removeIncomingRequest: (orderId) => { const state = get(); set({ incomingRequests: state.incomingRequests.filter(r => r.orderId !== orderId) }) },
      clearIncomingRequests: () => set({ incomingRequests: [] }),
      currentRequestId: null, setCurrentRequestId: (id) => set({ currentRequestId: id }),
      activeDelivery: null, setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),
      updateActiveDeliveryStatus: (status) => { const state = get(); if (state.activeDelivery) set({ activeDelivery: { ...state.activeDelivery, status } }) },
      currentView: 'dashboard', setCurrentView: (view) => set({ currentView: view }),
      earnings: { today: 0, week: 0, month: 0, totalDeliveries: 0, avgRating: 0, pendingPayout: 0 }, setEarnings: (earnings) => set({ earnings }),
      deliveryHistory: [], setDeliveryHistory: (history) => set({ deliveryHistory: history }),
      addHistoryItem: (item) => { const state = get(); set({ deliveryHistory: [item, ...state.deliveryHistory].slice(0, 100) }) },
      totalCompleted: 0, runnerRating: 0, setStats: (completed, rating) => set({ totalCompleted: completed, runnerRating: rating }),
      rejectedOrderIds: [], addRejectedOrderId: (id) => { const state = get(); set({ rejectedOrderIds: [...state.rejectedOrderIds, id].slice(-50) }) },
      missedCount: 0, incrementMissed: () => set((state) => ({ missedCount: state.missedCount + 1 })), resetMissed: () => set({ missedCount: 0 }),
    }),
    { name: 'unilag-runner-store', storage: createJSONStorage(() => localStorage), partialize: (state) => ({ transportMode: state.transportMode, totalCompleted: state.totalCompleted, runnerRating: state.runnerRating, rejectedOrderIds: state.rejectedOrderIds, missedCount: state.missedCount, earnings: state.earnings }) }
  )
)
