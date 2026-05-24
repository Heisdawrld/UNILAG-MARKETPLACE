import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DeliveryOrderStatus, DeliveryCategory, UrgencyLevel, TransportMode } from '@/lib/delivery-types'
import { DELIVERY_CATEGORY_BASELINES, URGENCY_MULTIPLIERS } from '@/lib/delivery-types'

// ── Types ──

export interface DeliveryOfferFromRunner {
  offerId: string; orderId: string; runnerId: string; runnerUsername: string
  runnerAvatar: string | null; runnerRating: number; runnerTasksCompleted: number
  runnerTransportMode: TransportMode; runnerPrice: number
  estimatedArrivalMinutes: number | null; message: string | null; expiresAt: string
  receivedAt: number
}

export interface CustomerActiveDelivery {
  orderId: string; status: DeliveryOrderStatus
  pickupLat: number; pickupLng: number; pickupAddress: string
  dropoffLat: number; dropoffLng: number; dropoffAddress: string
  pickupCode: string; customerPrice: number; finalPrice: number | null
  runnerId: string | null; runnerUsername: string | null; runnerAvatar: string | null
  runnerPhone: string | null; runnerTransportMode: TransportMode | null
  estimatedDistanceMeters: number | null; estimatedDurationMinutes: number | null
  createdAt: string; assignedAt: string | null
}

export interface DeliveryFormState {
  pickupLat: number | null; pickupLng: number | null; pickupAddress: string
  dropoffLat: number | null; dropoffLng: number | null; dropoffAddress: string
  category: DeliveryCategory; urgency: UrgencyLevel
  title: string; description: string
  customerPrice: number; itemImages: string[]
}

export interface CustomerDeliveryHistoryItem {
  id: string; title: string; category: DeliveryCategory; finalPrice: number | null
  status: DeliveryOrderStatus; completedAt: string | null; runnerRating: number | null
  runnerReview: string | null; estimatedDistanceMeters: number | null
  runnerUsername: string | null
}

export type CustomerDeliveryView = 'form' | 'searching' | 'offers' | 'tracking' | 'completed' | 'history'

// ── UNILAG Landmarks for quick-select ──
export const UNILAG_LANDMARKS: { label: string; lat: number; lng: number }[] = [
  { label: 'Main Gate', lat: 6.5153, lng: 3.3901 },
  { label: 'Jaja Hall', lat: 6.5168, lng: 3.3965 },
  { label: 'Moremi Hall', lat: 6.521, lng: 3.3909 },
  { label: 'New Hall', lat: 6.5202, lng: 3.3978 },
  { label: 'Medical Centre', lat: 6.5185, lng: 3.3862 },
  { label: 'Lagoon Front', lat: 6.5132, lng: 3.4039 },
  { label: 'Sports Centre', lat: 6.5222, lng: 3.3941 },
  { label: 'Faculty of Arts', lat: 6.5171, lng: 3.3941 },
  { label: 'Faculty of Science', lat: 6.5195, lng: 3.3960 },
  { label: 'Faculty of Law', lat: 6.5178, lng: 3.3925 },
]

// ── Store ──

interface CustomerDeliveryState {
  // Connection
  isSocketConnected: boolean; setSocketConnected: (connected: boolean) => void

  // Current view
  currentView: CustomerDeliveryView; setCurrentView: (view: CustomerDeliveryView) => void

  // Delivery form
  form: DeliveryFormState
  updateForm: (updates: Partial<DeliveryFormState>) => void
  resetForm: () => void
  getSuggestedPrice: () => number

  // Active delivery
  activeDelivery: CustomerActiveDelivery | null
  setActiveDelivery: (delivery: CustomerActiveDelivery | null) => void
  updateActiveDeliveryStatus: (status: DeliveryOrderStatus) => void
  updateRunnerLocation: (lat: number, lng: number, heading: number | null, speed: number | null) => void

  // Runner location for live tracking
  runnerLat: number | null; runnerLng: number | null
  runnerHeading: number | null; runnerSpeed: number | null
  runnerLocationUpdatedAt: number | null
  etaMinutes: number | null; distanceMeters: number | null

  // Offers from runners
  offers: DeliveryOfferFromRunner[]
  addOffer: (offer: DeliveryOfferFromRunner) => void
  removeOffer: (offerId: string) => void
  clearOffers: () => void

  // History
  deliveryHistory: CustomerDeliveryHistoryItem[]
  setDeliveryHistory: (history: CustomerDeliveryHistoryItem[]) => void

  // Search state
  isSearching: boolean; setIsSearching: (searching: boolean) => void
  searchOrderId: string | null; setSearchOrderId: (id: string | null) => void
  searchStartTime: number | null; setSearchStartTime: (time: number | null) => void

  // Rating
  showRatingModal: boolean; setShowRatingModal: (show: boolean) => void
}

const INITIAL_FORM: DeliveryFormState = {
  pickupLat: null, pickupLng: null, pickupAddress: '',
  dropoffLat: null, dropoffLng: null, dropoffAddress: '',
  category: 'other', urgency: 'standard',
  title: '', description: '',
  customerPrice: 1000, itemImages: [],
}

export const useCustomerDeliveryStore = create<CustomerDeliveryState>()(
  persist(
    (set, get) => ({
      isSocketConnected: false, setSocketConnected: (connected) => set({ isSocketConnected: connected }),

      currentView: 'form', setCurrentView: (view) => set({ currentView: view }),

      form: { ...INITIAL_FORM },
      updateForm: (updates) => set((state) => ({ form: { ...state.form, ...updates } })),
      resetForm: () => set({ form: { ...INITIAL_FORM } }),
      getSuggestedPrice: () => {
        const { form } = get()
        const baseline = DELIVERY_CATEGORY_BASELINES[form.category]
        const mid = Math.round((baseline.min + baseline.max) / 2)
        return Math.round(mid * URGENCY_MULTIPLIERS[form.urgency])
      },

      activeDelivery: null, setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),
      updateActiveDeliveryStatus: (status) => {
        const state = get()
        if (state.activeDelivery) set({ activeDelivery: { ...state.activeDelivery, status } })
      },
      updateRunnerLocation: (lat, lng, heading, speed) => set({
        runnerLat: lat, runnerLng: lng, runnerHeading: heading, runnerSpeed: speed, runnerLocationUpdatedAt: Date.now(),
      }),

      runnerLat: null, runnerLng: null, runnerHeading: null, runnerSpeed: null, runnerLocationUpdatedAt: null,
      etaMinutes: null, distanceMeters: null,

      offers: [],
      addOffer: (offer) => {
        const state = get()
        if (state.offers.some(o => o.offerId === offer.offerId)) return
        set({ offers: [...state.offers, offer] })
      },
      removeOffer: (offerId) => set((state) => ({ offers: state.offers.filter(o => o.offerId !== offerId) })),
      clearOffers: () => set({ offers: [] }),

      deliveryHistory: [], setDeliveryHistory: (history) => set({ deliveryHistory: history }),

      isSearching: false, setIsSearching: (searching) => set({ isSearching: searching }),
      searchOrderId: null, setSearchOrderId: (id) => set({ searchOrderId: id }),
      searchStartTime: null, setSearchStartTime: (time) => set({ searchStartTime: time }),

      showRatingModal: false, setShowRatingModal: (show) => set({ showRatingModal: show }),
    }),
    {
      name: 'unilag-customer-delivery-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deliveryHistory: state.deliveryHistory,
        form: state.form,
        // Persist active delivery so it survives PWA background/foreground
        activeDelivery: state.activeDelivery,
        searchOrderId: state.searchOrderId,
      }),
    }
  )
)
