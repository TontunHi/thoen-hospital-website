export * from './cervical-cancer/typesAndHelpers'
import {
  lookupPersonsByCids,
  getTargetPopulationReport,
} from './cervical-cancer/targetPopulationReport'
import { getScreenedRecipientsReport } from './cervical-cancer/screenedRecipientsReport'
import {
  check1B004NAdpMapping,
  getService1B004NReport,
  check1B004PAdpMapping,
  getService1B004PReport,
} from './cervical-cancer/service1B004Reports'
import {
  check1B004_0NAdpMapping,
  getService1B004_0NReport,
  check1B005AdpMapping,
  getService1B005Report,
} from './cervical-cancer/service1B004_0NAnd1B005Reports'

export class RcmCervicalCancerService {
  static lookupPersonsByCids = lookupPersonsByCids
  static getTargetPopulationReport = getTargetPopulationReport
  static getScreenedRecipientsReport = getScreenedRecipientsReport
  static check1B004NAdpMapping = check1B004NAdpMapping
  static getService1B004NReport = getService1B004NReport
  static check1B004PAdpMapping = check1B004PAdpMapping
  static getService1B004PReport = getService1B004PReport
  static check1B004_0NAdpMapping = check1B004_0NAdpMapping
  static getService1B004_0NReport = getService1B004_0NReport
  static check1B005AdpMapping = check1B005AdpMapping
  static getService1B005Report = getService1B005Report
}
