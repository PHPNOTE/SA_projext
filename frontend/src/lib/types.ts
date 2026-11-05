export type UserRole = 'FRONT_DESK' | 'MECHANIC' | 'WAREHOUSE' | 'SALES' | 'MANAGER';

export type QueueClass = 'NORMAL' | 'PRIORITY';

export type RepairStatus =
  | 'QUEUED'
  | 'IN_DIAGNOSIS'
  | 'AWAITING_APPROVAL'
  | 'ON_HOLD'
  | 'IN_REPAIR'
  | 'QC'
  | 'AWAITING_PAYMENT'
  | 'COMPLETED'
  | 'CANCELLED';

export type EstimateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'DECLINED';

export type EstimateLineType = 'LABOR' | 'PART';

export type PartRequestStatus = 'RESERVED' | 'BACKORDERED' | 'ISSUED' | 'RETURNED' | 'CANCELLED';

export type StockMovementType = 'RECEIPT' | 'RESERVE' | 'RELEASE' | 'ISSUE' | 'RETURN' | 'ADJUST';

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export type SaleOrderStatus = 'QUOTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type InvoiceStatus = 'ISSUED' | 'VOID';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface Vehicle {
  id: number;
  customerId: number;
  licensePlate: string;
  brand: string;
  model: string;
  year?: number;
  mileage: number;
}

export interface RepairBay {
  id: number;
  bayNumber: string;
  name: string;
  bayType: string;
  isOccupied: boolean;
  isActive: boolean;
  currentRepairId?: number | null;
}

export interface RepairOrder {
  id: number;
  roNumber: string;
  ticketNumber: string;
  queueClass: QueueClass;
  status: RepairStatus;
  customerId: number;
  customerName: string;
  customerPhone: string;
  vehicleId: number;
  licensePlate: string;
  vehicleModel: string;
  mileage: number;
  symptoms: string;
  priorityReason?: string;
  assignedBayId?: number | null;
  assignedBayNumber?: string | null;
  assignedMechanicId?: number | null;
  assignedMechanicName?: string | null;
  insurerName?: string | null;
  insuranceClaimNo?: string | null;
  insuranceDocsReceived?: boolean;
  insuranceCoveredAmount?: number;
  queuedAt: string;
  createdAt: string;
  completedAt?: string | null;
  subtotal?: number;
  laborTotal?: number;
  partsTotal?: number;
}

export interface Part {
  id: number;
  partCode: string;
  name: string;
  category: string;
  description?: string;
  shelfLocation: string;
  unitPrice: number;
  costPrice: number;
  onHand: number;
  reserved: number;
  reorderLevel: number;
  isActive: boolean;
}

export interface Estimate {
  id: number;
  repairId: number;
  estimateNumber: string;
  revisionNumber: number;
  status: EstimateStatus;
  lines: EstimateLine[];
  subtotal: number;
  createdBy: number;
  createdAt: string;
}

export interface EstimateLine {
  id: number;
  estimateId: number;
  lineType: EstimateLineType;
  partId?: number | null;
  partName?: string | null;
  partCode?: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PartRequest {
  id: number;
  requestNumber: string;
  repairId?: number | null;
  estimateLineId?: number | null;
  partId: number;
  partCode: string;
  partName: string;
  qtyRequested: number;
  qtyIssued: number;
  qtyReturned: number;
  status: PartRequestStatus;
  createdAt: string;
}

export interface StockMovement {
  id: number;
  partId: number;
  partCode: string;
  partName: string;
  movementType: StockMovementType;
  deltaOnHand: number;
  deltaReserved: number;
  reason?: string;
  partRequestId?: number;
  poLineId?: number;
  userName?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  expectedDate?: string;
  totalCost: number;
  createdAt: string;
  lines: PoLine[];
}

export interface PoLine {
  id: number;
  poId: number;
  partId: number;
  partCode: string;
  partName: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
}

export interface SaleOrder {
  id: number;
  saleNumber: string;
  customerName?: string;
  customerPhone?: string;
  status: SaleOrderStatus;
  subtotal: number;
  createdAt: string;
  lines: SaleOrderLine[];
}

export interface SaleOrderLine {
  id: number;
  saleId: number;
  partId: number;
  partCode: string;
  partName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  repairId?: number | null;
  roNumber?: string | null;
  saleId?: number | null;
  saleNumber?: string | null;
  customerName: string;
  customerPhone: string;
  subtotal: number;
  vatAmount: number; // 7% VAT
  totalWithVat: number;
  insuranceCovered: number;
  customerDue: number;
  status: InvoiceStatus;
  issuedAt: string;
  lines: InvoiceLine[];
  payments: Payment[];
}

export interface InvoiceLine {
  id: number;
  invoiceId: number;
  partId?: number | null;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Payment {
  id: number;
  invoiceId: number;
  payerType: 'CUSTOMER' | 'INSURER';
  amount: number;
  method: string;
  paidAt: string;
  receiptNumber?: string;
}

export interface RepairSummaryReport {
  startDate: string;
  endDate: string;
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  cancelledJobs: number;
  avgTurnaroundHours: number;
  totalLaborRevenue: number;
  totalPartsRevenue: number;
  totalRevenue: number;
  records: RepairOrder[];
}

export interface InventoryUsageReport {
  generatedAt: string;
  categoryFilter?: string;
  statusFilter?: string;
  totalValuation: number;
  totalItems: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  topConsumedParts: {
    partCode: string;
    partName: string;
    consumedQty: number;
    consumedValue: number;
  }[];
  records: (Part & {
    stockStatus: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    suggestedReorderQty: number;
  })[];
}
