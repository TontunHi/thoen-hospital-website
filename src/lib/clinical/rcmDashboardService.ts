export * from './rcm-dashboard/typesAndHelpers'
import {
  getSssDentalReport,
  getOpdDoctorSummary,
  getOpdDetailedReport,
  getOpdDepartmentSummary,
} from './rcm-dashboard/opdReports'
import {
  getIpdReport,
  getIpdDepartmentAdjrw,
  getIpdDoctorChartSummary,
  formatTelegramChartSummary,
} from './rcm-dashboard/ipdReports'
import { getInvoiceSummary, getInvoiceDetails } from './rcm-dashboard/invoiceReports'
import {
  getPalliativeCareReport,
  getPalliativeCarePc1Report,
  getVnClinicalDetails,
} from './rcm-dashboard/palliativeAndVnReports'

export class RcmDashboardService {
  static getSssDentalReport = getSssDentalReport
  static getOpdDoctorSummary = getOpdDoctorSummary
  static getOpdDetailedReport = getOpdDetailedReport
  static getIpdReport = getIpdReport
  static getIpdDepartmentAdjrw = getIpdDepartmentAdjrw
  static getIpdDoctorChartSummary = getIpdDoctorChartSummary
  static formatTelegramChartSummary = formatTelegramChartSummary
  static getOpdDepartmentSummary = getOpdDepartmentSummary
  static getInvoiceSummary = getInvoiceSummary
  static getInvoiceDetails = getInvoiceDetails
  static getPalliativeCareReport = getPalliativeCareReport
  static getPalliativeCarePc1Report = getPalliativeCarePc1Report
  static getVnClinicalDetails = getVnClinicalDetails
}
