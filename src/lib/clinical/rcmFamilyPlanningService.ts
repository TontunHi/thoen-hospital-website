export * from './family-planning/typesAndHelpers'
import {
  NEW_ECLAIM_ADP_CODES,
  KRUNGTHAI_ADP_CODES,
  IUD_ADP_CODES,
} from './family-planning/typesAndHelpers'
import {
  checkAdpMapping,
  checkFamilyPlanningAdpMapping,
  getFamilyPlanningReport,
  getFamilyPlanning91Report,
} from './family-planning/service91Report'
import {
  getFamilyPlanning93Report,
} from './family-planning/service93Report'
import {
  checkIudAdpMapping,
  getIudReport,
} from './family-planning/iudReport'
import {
  checkFamilyPlanning932AdpMapping,
  getFamilyPlanning932Report,
} from './family-planning/service932Report'

export class RcmFamilyPlanningService {
  static readonly NEW_ECLAIM_ADP_CODES = NEW_ECLAIM_ADP_CODES
  static readonly KRUNGTHAI_ADP_CODES = KRUNGTHAI_ADP_CODES
  static readonly IUD_ADP_CODES = IUD_ADP_CODES

  static checkAdpMapping = checkAdpMapping
  static checkFamilyPlanningAdpMapping = checkFamilyPlanningAdpMapping
  static getFamilyPlanningReport = getFamilyPlanningReport
  static getFamilyPlanning91Report = getFamilyPlanning91Report
  static getFamilyPlanning93Report = getFamilyPlanning93Report
  static checkIudAdpMapping = checkIudAdpMapping
  static getIudReport = getIudReport
  static checkFamilyPlanning932AdpMapping = checkFamilyPlanning932AdpMapping
  static getFamilyPlanning932Report = getFamilyPlanning932Report
}
