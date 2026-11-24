import { apiGateway } from '@/lib/apiGateway'

export interface RcmDashboardGatewayAdapter {
  getRcmSssDentalRaw: typeof apiGateway.clinical.getRcmSssDentalRaw
  getRcmOpdDoctorSummaryRaw: typeof apiGateway.clinical.getRcmOpdDoctorSummaryRaw
  getRcmOpdDetailedRaw: typeof apiGateway.clinical.getRcmOpdDetailedRaw
  getRcmOpdDepartmentSummaryRaw: typeof apiGateway.clinical.getRcmOpdDepartmentSummaryRaw
  getRcmIpdReportRaw: typeof apiGateway.clinical.getRcmIpdReportRaw
  getRcmIpdDepartmentAdjrwRaw: typeof apiGateway.clinical.getRcmIpdDepartmentAdjrwRaw
  getRcmIpdDoctorChartSummaryRaw: typeof apiGateway.clinical.getRcmIpdDoctorChartSummaryRaw
  getRcmPalliativeCareRaw: typeof apiGateway.clinical.getRcmPalliativeCareRaw
  getRcmPalliativeCarePc1Raw: typeof apiGateway.clinical.getRcmPalliativeCarePc1Raw
  getRcmVnClinicalDetailsRaw: typeof apiGateway.clinical.getRcmVnClinicalDetailsRaw
}

export const defaultRcmDashboardGateway: RcmDashboardGatewayAdapter = {
  getRcmSssDentalRaw: (p) => apiGateway.clinical.getRcmSssDentalRaw(p),
  getRcmOpdDoctorSummaryRaw: (p) => apiGateway.clinical.getRcmOpdDoctorSummaryRaw(p),
  getRcmOpdDetailedRaw: (p) => apiGateway.clinical.getRcmOpdDetailedRaw(p),
  getRcmOpdDepartmentSummaryRaw: (p) => apiGateway.clinical.getRcmOpdDepartmentSummaryRaw(p),
  getRcmIpdReportRaw: (p) => apiGateway.clinical.getRcmIpdReportRaw(p),
  getRcmIpdDepartmentAdjrwRaw: (p) => apiGateway.clinical.getRcmIpdDepartmentAdjrwRaw(p),
  getRcmIpdDoctorChartSummaryRaw: (p) => apiGateway.clinical.getRcmIpdDoctorChartSummaryRaw(p),
  getRcmPalliativeCareRaw: (p) => apiGateway.clinical.getRcmPalliativeCareRaw(p),
  getRcmPalliativeCarePc1Raw: (p) => apiGateway.clinical.getRcmPalliativeCarePc1Raw(p),
  getRcmVnClinicalDetailsRaw: (vn) => apiGateway.clinical.getRcmVnClinicalDetailsRaw(vn),
}
