export interface Actor {
  id?: number | null
  name?: string | null
  username?: string | null
  role?: string | null
}

export interface OverdueNotificationDetail {
  requestId: number
  requestNo: string
  requesterId: number
  requesterName: string
  requesterDept?: string | null
  overdueDays: number
  expectedReturnDate: string
  remainingItemsCount: number
  status: 'SENT' | 'SKIPPED_NO_TELEGRAM' | 'FAILED'
  error?: string
}

export interface OverdueNotificationResult {
  success: boolean
  totalOverdue: number
  sentCount: number
  skippedNoTelegramCount: number
  failedCount: number
  timestamp: string
  details: OverdueNotificationDetail[]
}

export interface CreateMaterialInput {
  name: string
  category?: string
  materialType?: 'REUSABLE' | 'CONSUMABLE'
  totalQty: number
  availableQty?: number
  unit?: string
  location?: string | null
  imageUrl?: string | null
  notes?: string | null
  isActive?: boolean
}

export interface UpdateMaterialInput extends Partial<CreateMaterialInput> {}

export interface BorrowBasketItemInput {
  itemType: 'ASSET' | 'MATERIAL'
  assetId?: number | null
  materialId?: number | null
  itemName: string
  itemCode?: string | null
  quantity: number
}

export interface CreateBorrowRequestInput {
  purpose: string
  location?: string | null
  borrowDate: Date | string
  expectedReturnDate?: Date | string | null
  phone?: string | null
  notes?: string | null
  items: BorrowBasketItemInput[]
}

export interface ItemReturnInput {
  itemId: number
  returnedQty: number
  condition: 'NORMAL' | 'DAMAGED' | 'LOST'
  notes?: string | null
}

export interface BorrowDashboardStats {
  totalItems: number
  availableItems: number
  borrowedItems: number
  overdueRequests: number
}

export function mapDbRowToMaterial(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    materialType: row.material_type || row.materialType,
    totalQty: row.total_qty !== undefined ? Number(row.total_qty) : Number(row.totalQty || 0),
    availableQty: row.available_qty !== undefined ? Number(row.available_qty) : Number(row.availableQty || 0),
    unit: row.unit,
    location: row.location,
    imageUrl: row.image_url || row.imageUrl,
    notes: row.notes,
    isActive: Boolean(row.is_active !== undefined ? row.is_active : row.isActive),
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  }
}

export function mapDbRowToItem(row: any) {
  return {
    id: row.id,
    requestId: row.request_id || row.requestId,
    itemType: row.item_type || row.itemType,
    assetId: row.asset_id || row.assetId,
    materialId: row.material_id || row.materialId,
    itemName: row.item_name || row.itemName,
    itemCode: row.item_code || row.itemCode,
    quantity: Number(row.quantity || 0),
    returnedQty: Number(row.returned_qty !== undefined ? row.returned_qty : (row.returnedQty || 0)),
    status: row.status,
    returnCondition: row.return_condition || row.returnCondition,
    returnNotes: row.return_notes || row.returnNotes,
    returnedAt: row.returned_at || row.returnedAt,
    inspectedById: row.inspected_by_id || row.inspectedById,
    inspectedByName: row.inspected_by_name || row.inspectedByName,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    asset: row.asset || null,
    material: row.material || null,
    imageUrl:
      row.imageUrl ||
      row.asset_image_url ||
      row.mat_image_url ||
      row.asset?.imageUrl ||
      row.material?.imageUrl ||
      null,
  }
}

export function mapDbRowToRequest(row: any, items: any[] = []) {
  return {
    id: row.id,
    requestNo: row.request_no || row.requestNo,
    requesterId: row.requester_id || row.requesterId,
    requesterName: row.requester_name || row.requesterName,
    requesterDept: row.requester_dept || row.requesterDept,
    purpose: row.purpose,
    location: row.location,
    borrowDate: row.borrow_date || row.borrowDate,
    expectedReturnDate: row.expected_return_date || row.expectedReturnDate,
    actualReturnDate: row.actual_return_date || row.actualReturnDate,
    phone: row.phone,
    notes: row.notes,
    status: row.status,
    approvedById: row.approved_by_id || row.approvedById,
    approvedByName: row.approved_by_name || row.approvedByName,
    approvedAt: row.approved_at || row.approvedAt,
    rejectReason: row.reject_reason || row.rejectReason,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    items: items.map(mapDbRowToItem),
  }
}
