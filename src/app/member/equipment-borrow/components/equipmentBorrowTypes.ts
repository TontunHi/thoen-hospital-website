export interface BorrowDashboardStats {
  totalItems: number
  availableItems: number
  borrowedItems: number
  overdueRequests: number
}

export interface CurrentUser {
  id: number
  username: string
  name: string
  role: string
  department?: string | null
  isAdmin: boolean
  canManageBorrow: boolean
}

export interface CatalogItem {
  id: number
  itemType: 'ASSET' | 'MATERIAL'
  name: string
  code: string
  category: string
  subType?: string
  availableQty: number
  unit: string
  location?: string | null
  imageUrl?: string | null
}

export interface BasketItem {
  id: number
  itemType: 'ASSET' | 'MATERIAL'
  name: string
  code: string
  quantity: number
  maxQty: number
  unit: string
  imageUrl?: string | null
}

export interface BorrowItemDetail {
  id: number
  itemType: 'ASSET' | 'MATERIAL'
  itemName: string
  itemCode?: string | null
  quantity: number
  returnedQty: number
  status: string
  returnCondition?: string | null
  returnNotes?: string | null
  returnedAt?: string | null
  imageUrl?: string | null
}

export interface BorrowRequestRecord {
  id: number
  requestNo: string
  requesterId: number
  requesterName: string
  requesterDept?: string | null
  purpose: string
  location?: string | null
  borrowDate: string
  expectedReturnDate?: string | null
  actualReturnDate?: string | null
  phone?: string | null
  notes?: string | null
  status: 'PENDING' | 'APPROVED' | 'PARTIAL_RETURNED' | 'RETURNED' | 'REJECTED' | 'CANCELLED'
  approvedByName?: string | null
  approvedAt?: string | null
  rejectReason?: string | null
  createdAt: string
  items: BorrowItemDetail[]
}

export interface MaterialRecord {
  id: number
  name: string
  category: string
  materialType: 'REUSABLE' | 'CONSUMABLE'
  totalQty: number
  availableQty: number
  unit: string
  location?: string | null
  imageUrl?: string | null
  notes?: string | null
  isActive: boolean
}

export interface LoanableAssetRecord {
  id: number
  articleNum: string
  name: string
  brand?: string | null
  category: string
  isLoanable: boolean
  status: string
  locationFullName?: string | null
  imageUrl?: string | null
}

export interface MaterialFormState {
  name: string
  category: string
  materialType: 'REUSABLE' | 'CONSUMABLE'
  totalQty: number
  unit: string
  location: string
  imageUrl: string | null
  notes: string
  isActive: boolean
}
