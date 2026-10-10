package handlers

import (
	"log"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/cache"
	"thoen-hospital-backend/internal/database"
	"thoen-hospital-backend/internal/models"
)

var digitsRegex = regexp.MustCompile(`\D`)

var WardSectionsConfig = []struct {
	ID          string
	Title       string
	ShortTitle  string
	Floor       string
	BadgeColor  string
	AccentColor string
}{
	{
		ID:          "w1",
		Title:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยสามัญ เตียง 1 - 20",
		ShortTitle:  "สามัญ 1-20",
		Floor:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 3",
		BadgeColor:  "badge-emerald",
		AccentColor: "#10b981",
	},
	{
		ID:          "w2",
		Title:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยสามัญ เตียง 21 - 40",
		ShortTitle:  "สามัญ 21-40",
		Floor:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 3",
		BadgeColor:  "badge-teal",
		AccentColor: "#14b8a6",
	},
	{
		ID:          "w3",
		Title:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องแยก",
		ShortTitle:  "ห้องแยก",
		Floor:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 3",
		BadgeColor:  "badge-cyan",
		AccentColor: "#06b6d4",
	},
	{
		ID:          "icu",
		Title:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยวิกฤต (ICU)",
		ShortTitle:  "ICU",
		Floor:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 3",
		BadgeColor:  "badge-rose",
		AccentColor: "#f43f5e",
	},
	{
		ID:          "special",
		Title:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 4 ห้องพิเศษ",
		ShortTitle:  "ห้องพิเศษ",
		Floor:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 4",
		BadgeColor:  "badge-purple",
		AccentColor: "#a855f7",
	},
	{
		ID:          "lr",
		Title:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 5 ห้องคลอด",
		ShortTitle:  "ห้องคลอด",
		Floor:       "อาคารร่มโพธิ์-ร่มไทร ชั้น 5",
		BadgeColor:  "badge-amber",
		AccentColor: "#f59e0b",
	},
	{
		ID:          "surgery",
		Title:       "หอผู้ป่วยศัลยกรรม อาคารร่มบุญ",
		ShortTitle:  "ศัลยกรรม ร่มบุญ",
		Floor:       "อาคารร่มบุญ",
		BadgeColor:  "badge-orange",
		AccentColor: "#f97316",
	},
}

var OccupancyWardConfig = []struct {
	WardCode string
	Name     string
	Beds     int
}{
	{WardCode: "06", Name: "ชั้น 3 Ward", Beds: 44},
	{WardCode: "05", Name: "ชั้น 3 ICU", Beds: 8},
	{WardCode: "04", Name: "ชั้น 4 ห้องพิเศษ", Beds: 21},
	{WardCode: "02", Name: "ชั้น 5 ห้องคลอด", Beds: 8},
	{WardCode: "09", Name: "อาคารหอผู้ป่วยในร่มบุญ", Beds: 22},
}

const TotalHospitalBeds = 81

type WardHandler struct {
	db    *database.HosxpDB
	cache *cache.MemoryCache
}

func NewWardHandler(db *database.HosxpDB, cache *cache.MemoryCache) *WardHandler {
	return &WardHandler{db: db, cache: cache}
}

func resolveWardGroupId(wardCode, bedno string) string {
	ward := strings.TrimSpace(wardCode)
	bed := strings.TrimSpace(bedno)

	if ward == "06" {
		if strings.HasPrefix(bed, "Wย") {
			return "w3"
		}
		numStr := digitsRegex.ReplaceAllString(bed, "")
		digits, err := strconv.Atoi(numStr)
		if err == nil {
			if digits >= 1 && digits <= 20 {
				return "w1"
			} else if digits >= 21 && digits <= 40 {
				return "w2"
			}
		}
		return "w1"
	} else if ward == "05" {
		return "icu"
	} else if ward == "04" {
		return "special"
	} else if ward == "02" {
		return "lr"
	} else if ward == "09" {
		return "surgery"
	}
	return "other"
}

func round2(val float64) float64 {
	return math.Round(val*100) / 100
}

// GetWardStatus handles GET /api/service/ward-status
func (h *WardHandler) GetWardStatus(c *gin.Context) {
	cacheKey := "ipd-ward-status-data"
	if cached, ok := h.cache.Get(cacheKey); ok {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    cached,
		})
		return
	}

	sql := `
		SELECT 
			pt.hn,
			TRIM(CONCAT(COALESCE(pt.pname, ''), ' ', COALESCE(pt.fname, ''))) AS ptname,
			COALESCE(TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()), 0) AS age,
			COALESCE(DATE_FORMAT(an.regdate, '%Y-%m-%d'), '') AS regdate,
			COALESCE(DATEDIFF(CURRENT_DATE(), an.regdate), 0) AS admit_days,
			COALESCE(p.bedno, '-') AS bedno,
			COALESCE(an.ward, '') AS ward
		FROM an_stat an
		LEFT OUTER JOIN patient pt ON an.hn = pt.hn
		LEFT OUTER JOIN iptadm p ON an.an = p.an
		WHERE an.dchdate IS NULL
			AND an.ward IN ('02', '04', '05', '06', '09')
		ORDER BY p.bedno ASC
	`

	var rows []models.WardPatientRecord
	if err := h.db.Select(&rows, sql); err != nil {
		log.Printf("[ERROR] Ward status query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "เกิดข้อผิดพลาดในการดึงข้อมูลสถานะผู้ป่วยนอนรักษาพยาบาล",
		})
		return
	}

	groups := make(map[string][]models.WardPatientRecord)
	for _, sec := range WardSectionsConfig {
		groups[sec.ID] = []models.WardPatientRecord{}
	}

	for i := range rows {
		groupId := resolveWardGroupId(rows[i].Ward, rows[i].BedNo)
		rows[i].WardGroup = groupId
		if rows[i].AdmitDays < 0 {
			rows[i].AdmitDays = 0
		}
		if rows[i].BedNo == "" {
			rows[i].BedNo = "-"
		}
		if _, ok := groups[groupId]; ok {
			groups[groupId] = append(groups[groupId], rows[i])
		}
	}

	sections := make([]models.WardSectionConfig, len(WardSectionsConfig))
	for i, sec := range WardSectionsConfig {
		sections[i] = models.WardSectionConfig{
			ID:          sec.ID,
			Title:       sec.Title,
			ShortTitle:  sec.ShortTitle,
			Floor:       sec.Floor,
			BadgeColor:  sec.BadgeColor,
			AccentColor: sec.AccentColor,
			Patients:    groups[sec.ID],
		}
	}

	res := models.WardRosterResponse{
		TotalPatients: len(rows),
		UpdatedAt:     time.Now().UTC().Format(time.RFC3339Nano),
		Sections:      sections,
	}

	h.cache.Set(cacheKey, res, 10*time.Second)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    res,
	})
}

// GetBedOccupancy handles GET /api/service/bed-occupancy
func (h *WardHandler) GetBedOccupancy(c *gin.Context) {
	cacheKey := "bed-occupancy-data"
	if cached, ok := h.cache.Get(cacheKey); ok {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    cached,
		})
		return
	}

	// 1. OPD patient count today
	var opdResult []struct {
		Count int `db:"opdCount"`
	}
	_ = h.db.Select(&opdResult, "SELECT COUNT(DISTINCT o.hn) AS opdCount FROM ovst o WHERE o.vstdate = CURRENT_DATE")
	opdCount := 0
	if len(opdResult) > 0 {
		opdCount = opdResult[0].Count
	}

	// 2a. Ward occupancy
	var wardOccResult []struct {
		Ward  string `db:"ward"`
		Count int    `db:"occupiedBeds"`
	}
	_ = h.db.Select(&wardOccResult, `
		SELECT i.ward, COUNT(i.an) AS occupiedBeds
		FROM ipt i
		WHERE i.dchtype IS NULL
			AND i.ward IN ('02', '04', '05', '06', '09')
		GROUP BY i.ward
	`)
	occupancyByWard := make(map[string]int)
	for _, r := range wardOccResult {
		occupancyByWard[r.Ward] = r.Count
	}

	// 2b. VIP room distinct bedno
	var vipBedResult []struct {
		Count int `db:"occupiedBeds"`
	}
	_ = h.db.Select(&vipBedResult, `
		SELECT COUNT(DISTINCT b.bedno) AS occupiedBeds
		FROM ipt i
		LEFT OUTER JOIN iptadm b ON i.an = b.an
		WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'
	`)
	vipRoomCount := 0
	if len(vipBedResult) > 0 {
		vipRoomCount = vipBedResult[0].Count
	}

	// 2b-extra. VIP person count
	var vipPersonResult []struct {
		Count int `db:"personCount"`
	}
	_ = h.db.Select(&vipPersonResult, `
		SELECT COUNT(b.bedno) AS personCount
		FROM ipt i
		LEFT OUTER JOIN iptadm b ON i.an = b.an
		WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'
	`)
	vipPersonCount := 0
	if len(vipPersonResult) > 0 {
		vipPersonCount = vipPersonResult[0].Count
	}

	// 2c. Labor room pre-delivery (C0%)
	var deliveryPreResult []struct {
		Count int `db:"occupiedBeds"`
	}
	_ = h.db.Select(&deliveryPreResult, `
		SELECT COUNT(DISTINCT ip.bedno) AS occupiedBeds
		FROM ipt i
		LEFT OUTER JOIN iptadm ip ON i.an = ip.an
		WHERE i.dchtype IS NULL
			AND i.ward = '02'
			AND ip.bedno <> ''
			AND ip.bedno LIKE 'C0%'
	`)
	preDeliveryOccupied := 0
	if len(deliveryPreResult) > 0 {
		preDeliveryOccupied = deliveryPreResult[0].Count
	}

	// 2d. Labor room post-delivery (CP%)
	var deliveryPostResult []struct {
		Count int `db:"occupiedBeds"`
	}
	_ = h.db.Select(&deliveryPostResult, `
		SELECT COUNT(DISTINCT ip.bedno) AS occupiedBeds
		FROM ipt i
		LEFT OUTER JOIN iptadm ip ON i.an = ip.an
		WHERE i.dchtype IS NULL
			AND i.ward = '02'
			AND ip.bedno <> ''
			AND ip.bedno LIKE 'CP%'
	`)
	postDeliveryOccupied := 0
	if len(deliveryPostResult) > 0 {
		postDeliveryOccupied = deliveryPostResult[0].Count
	}

	// 3a. Admit today per ward
	var admitResult []struct {
		Ward  string `db:"ward"`
		Count int    `db:"admitCount"`
	}
	_ = h.db.Select(&admitResult, `
		SELECT i.ward, COUNT(i.an) AS admitCount
		FROM ipt i
		WHERE i.regdate = CURRENT_DATE
			AND i.ward IN ('02', '04', '05', '06', '09')
		GROUP BY i.ward
	`)
	admitByWard := make(map[string]int)
	for _, r := range admitResult {
		admitByWard[r.Ward] = r.Count
	}

	// 3b. Discharge today per ward
	var dischargeResult []struct {
		Ward  string `db:"ward"`
		Count int    `db:"dischargeCount"`
	}
	_ = h.db.Select(&dischargeResult, `
		SELECT i.ward, COUNT(i.an) AS dischargeCount
		FROM ipt i
		WHERE i.dchdate = CURRENT_DATE
			AND i.ward IN ('02', '04', '05', '06', '09')
		GROUP BY i.ward
	`)
	dischargeByWard := make(map[string]int)
	for _, r := range dischargeResult {
		dischargeByWard[r.Ward] = r.Count
	}

	// 4a. Occupancy rate overall
	var overallRateResult []struct {
		TotalAdmDays *int `db:"totalAdmDays"`
		DaysInMonth  *int `db:"daysInMonth"`
	}
	_ = h.db.Select(&overallRateResult, `
		SELECT
			SUM(admdate) AS totalAdmDays,
			DAY(LAST_DAY(CURRENT_DATE)) AS daysInMonth
		FROM an_stat
		WHERE dchdate BETWEEN
			DATE_ADD(DATE_ADD(LAST_DAY(CURRENT_DATE), INTERVAL 1 DAY), INTERVAL -1 MONTH)
			AND LAST_DAY(CURRENT_DATE)
	`)
	totalAdmDays := 0
	daysInMonth := 30
	if len(overallRateResult) > 0 {
		if overallRateResult[0].TotalAdmDays != nil {
			totalAdmDays = *overallRateResult[0].TotalAdmDays
		}
		if overallRateResult[0].DaysInMonth != nil {
			daysInMonth = *overallRateResult[0].DaysInMonth
		}
	}

	// 4b. Occupancy rate by ward
	var wardRateResult []struct {
		Ward         string `db:"ward"`
		TotalAdmDays *int   `db:"totalAdmDays"`
	}
	_ = h.db.Select(&wardRateResult, `
		SELECT
			ward,
			SUM(admdate) AS totalAdmDays,
			DAY(CURRENT_DATE) AS daysSoFar
		FROM an_stat
		WHERE ward IN ('02', '04', '05', '06', '09')
			AND dchdate BETWEEN
				DATE_ADD(DATE_ADD(LAST_DAY(CURRENT_DATE), INTERVAL 1 DAY), INTERVAL -1 MONTH)
				AND LAST_DAY(CURRENT_DATE)
		GROUP BY ward
	`)
	occupancyRateByWard := make(map[string]int)
	for _, r := range wardRateResult {
		if r.TotalAdmDays != nil {
			occupancyRateByWard[r.Ward] = *r.TotalAdmDays
		}
	}

	// 6. ICU on ventilator
	var icuVentResult []struct {
		Count int `db:"onVentilator"`
	}
	_ = h.db.Select(&icuVentResult, `
		SELECT COUNT(i.an) AS onVentilator
		FROM ipt i
		LEFT OUTER JOIN opitemrece o
			ON i.an = o.an
			AND o.rxdate = CURRENT_DATE
			AND o.icode IN ('3002054', '3002024', '3002025')
		WHERE i.dchtype IS NULL
			AND i.ward = '05'
			AND o.rxdate IS NOT NULL
	`)
	onVentilator := 0
	if len(icuVentResult) > 0 {
		onVentilator = icuVentResult[0].Count
	}

	// 5. Specialty breakdown
	var spcltyRows []struct {
		Ward  string  `db:"ward"`
		Count int     `db:"patientCount"`
		Name  *string `db:"specialtyName"`
	}
	_ = h.db.Select(&spcltyRows, `
		SELECT i.ward, COUNT(i.an) AS patientCount, s.name AS specialtyName
		FROM ipt i
		LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
		WHERE i.dchdate IS NULL AND i.ward IN ('02', '04', '05', '06', '09')
		GROUP BY i.ward, i.spclty
	`)
	specialtiesByWard := make(map[string][]models.SpecialtyBreakdown)
	for _, r := range spcltyRows {
		if r.Count > 0 {
			name := "ไม่ระบุ"
			if r.Name != nil && *r.Name != "" {
				name = *r.Name
			}
			specialtiesByWard[r.Ward] = append(specialtiesByWard[r.Ward], models.SpecialtyBreakdown{
				Name:  name,
				Count: r.Count,
			})
		}
	}

	// 7a. ICNP classification
	// Standard wards: 06, 05, 02, 09
	var icnpRows []struct {
		Ward  string  `db:"ward"`
		Count int     `db:"can"`
		Name  *string `db:"icnpName"`
	}
	_ = h.db.Select(&icnpRows, `
		SELECT ii.ward, COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
		FROM ipt_icnp i
		LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
		LEFT OUTER JOIN ipt ii ON i.an = ii.an
		WHERE ii.dchdate IS NULL AND ii.ward IN ('02', '05', '06', '09') AND ic.icnp_classification_name IS NOT NULL
		GROUP BY ii.ward, i.icnp_classification_id
		ORDER BY i.icnp_classification_id DESC
	`)
	icnpByWard := make(map[string][]models.IcnpClassification)
	for _, r := range icnpRows {
		if r.Count > 0 && r.Name != nil && *r.Name != "" {
			icnpByWard[r.Ward] = append(icnpByWard[r.Ward], models.IcnpClassification{
				Name:  *r.Name,
				Count: r.Count,
			})
		}
	}

	// VIP ward 04 ICNP
	var vipIcnpRows []struct {
		Count int     `db:"can"`
		Name  *string `db:"icnpName"`
	}
	_ = h.db.Select(&vipIcnpRows, `
		SELECT COUNT(b.bedno) AS can, ic.icnp_classification_name AS icnpName
		FROM ipt i
		LEFT OUTER JOIN ward w ON i.ward = w.ward
		LEFT OUTER JOIN ipt_icnp ii ON i.an = ii.an
		LEFT OUTER JOIN icnp_classification ic ON ii.icnp_classification_id = ic.icnp_classification_id
		LEFT OUTER JOIN iptadm b ON ii.an = b.an
		WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%' AND ic.icnp_classification_name IS NOT NULL
		GROUP BY ii.icnp_classification_id
		ORDER BY ic.icnp_classification_id DESC
	`)
	for _, r := range vipIcnpRows {
		if r.Count > 0 && r.Name != nil && *r.Name != "" {
			icnpByWard["04"] = append(icnpByWard["04"], models.IcnpClassification{
				Name:  *r.Name,
				Count: r.Count,
			})
		}
	}

	// 7b. Unclassified beds
	var unclassifiedRows []struct {
		Ward  string  `db:"ward"`
		BedNo *string `db:"bedno"`
	}
	_ = h.db.Select(&unclassifiedRows, `
		SELECT DISTINCT i.bedno, a.ward
		FROM iptadm i
		LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
		LEFT OUTER JOIN an_stat a ON a.an = i.an
		WHERE a.dchdate IS NULL AND a.ward IN ('02', '04', '05', '06', '09')
			AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
		ORDER BY i.bedno ASC
	`)
	unclassifiedByWard := make(map[string][]string)
	for _, r := range unclassifiedRows {
		if r.BedNo != nil {
			bed := strings.TrimSpace(*r.BedNo)
			if bed != "" {
				unclassifiedByWard[r.Ward] = append(unclassifiedByWard[r.Ward], bed)
			}
		}
	}

	// Build wards output
	wards := make([]models.WardOccupancy, len(OccupancyWardConfig))
	totalOccupied := 0
	totalAdmitToday := 0
	totalDischargeToday := 0

	for i, cfg := range OccupancyWardConfig {
		occupied := 0
		if cfg.WardCode == "04" {
			occupied = vipRoomCount
		} else {
			occupied = occupancyByWard[cfg.WardCode]
		}

		remaining := cfg.Beds - occupied
		if remaining < 0 {
			remaining = 0
		}

		var usagePercent float64 = 0
		if cfg.Beds > 0 {
			usagePercent = round2((float64(occupied) * 100) / float64(cfg.Beds))
		}

		var wardOccRate *float64
		wardAdmDays := occupancyRateByWard[cfg.WardCode]
		if cfg.Beds > 0 && daysInMonth > 0 {
			rate := round2((float64(wardAdmDays) * 100) / float64(cfg.Beds*daysInMonth))
			wardOccRate = &rate
		}

		specialties := specialtiesByWard[cfg.WardCode]
		if specialties == nil {
			specialties = []models.SpecialtyBreakdown{}
		}

		icnpList := icnpByWard[cfg.WardCode]
		if icnpList == nil {
			icnpList = []models.IcnpClassification{}
		}

		unclassifiedList := unclassifiedByWard[cfg.WardCode]
		if unclassifiedList == nil {
			unclassifiedList = []string{}
		}

		admitCount := admitByWard[cfg.WardCode]
		dischargeCount := dischargeByWard[cfg.WardCode]

		ward := models.WardOccupancy{
			ID:                  cfg.WardCode,
			Name:                cfg.Name,
			TotalBeds:           cfg.Beds,
			OccupiedBeds:        occupied,
			RemainingBeds:       remaining,
			UsagePercent:        usagePercent,
			OccupancyRate:       wardOccRate,
			AdmitToday:          admitCount,
			DischargeToday:      dischargeCount,
			Specialties:         specialties,
			IcnpClassifications: icnpList,
			UnclassifiedBeds:    unclassifiedList,
		}

		if cfg.WardCode == "05" {
			icuOccupied := occupancyByWard["05"]
			ciCount := icuOccupied - onVentilator
			if ciCount < 0 {
				ciCount = 0
			}
			ward.Extra = &models.WardExtra{
				OnVentilator: &onVentilator,
				CiCount:      &ciCount,
			}
		} else if cfg.WardCode == "04" {
			ward.Extra = &models.WardExtra{
				VipPersons: &vipPersonCount,
			}
		} else if cfg.WardCode == "02" {
			preRem := 4 - preDeliveryOccupied
			if preRem < 0 {
				preRem = 0
			}
			postRem := 4 - postDeliveryOccupied
			if postRem < 0 {
				postRem = 0
			}
			ward.Extra = &models.WardExtra{
				PreDelivery: &models.DeliveryRoomDetail{
					Beds:         4,
					Occupied:     preDeliveryOccupied,
					Remaining:    preRem,
					UsagePercent: round2((float64(preDeliveryOccupied) * 100) / 4),
				},
				PostDelivery: &models.DeliveryRoomDetail{
					Beds:         4,
					Occupied:     postDeliveryOccupied,
					Remaining:    postRem,
					UsagePercent: round2((float64(postDeliveryOccupied) * 100) / 4),
				},
			}
		}

		wards[i] = ward
		totalOccupied += occupied
		totalAdmitToday += admitCount
		totalDischargeToday += dischargeCount
	}

	totalRemaining := TotalHospitalBeds - totalOccupied
	if totalRemaining < 0 {
		totalRemaining = 0
	}

	var totalUsagePercent float64 = 0
	var overallOccupancyRate float64 = 0
	if TotalHospitalBeds > 0 {
		totalUsagePercent = round2((float64(totalOccupied) * 100) / float64(TotalHospitalBeds))
		if daysInMonth > 0 {
			overallOccupancyRate = round2((float64(totalAdmDays) * 100) / float64(TotalHospitalBeds*daysInMonth))
		}
	}

	data := models.BedOccupancyData{
		OpdPatientCount:   opdCount,
		TotalBeds:         TotalHospitalBeds,
		TotalOccupied:     totalOccupied,
		TotalRemaining:    totalRemaining,
		TotalUsagePercent: totalUsagePercent,
		OccupancyRate:     overallOccupancyRate,
		OccupancyFormula: models.OccupancyFormula{
			TotalAdmDays: totalAdmDays,
			DaysInMonth:  daysInMonth,
		},
		TotalAdmitToday:     totalAdmitToday,
		TotalDischargeToday: totalDischargeToday,
		Wards:               wards,
		UpdatedAt:           time.Now().UTC().Format(time.RFC3339Nano),
	}

	h.cache.Set(cacheKey, data, 10*time.Second)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}
