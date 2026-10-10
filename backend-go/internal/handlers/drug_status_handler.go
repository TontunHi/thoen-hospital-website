package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/cache"
	"thoen-hospital-backend/internal/database"
	"thoen-hospital-backend/internal/models"
)

type DrugStatusHandler struct {
	db    *database.HosxpDB
	cache *cache.MemoryCache
}

func NewDrugStatusHandler(db *database.HosxpDB, cache *cache.MemoryCache) *DrugStatusHandler {
	return &DrugStatusHandler{db: db, cache: cache}
}

// GetDrugStatus handles GET /api/service/status-drug
func (h *DrugStatusHandler) GetDrugStatus(c *gin.Context) {
	cacheKey := "drug-dispense-status-data"
	if cached, ok := h.cache.Get(cacheKey); ok {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    cached,
		})
		return
	}

	queryPaid := `
		SELECT 
			pt.hn,
			TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''), ' ', COALESCE(pt.lname, ''))) AS ptname,
			TIME_FORMAT(st.service7, '%H:%i:%s') AS service_time,
			TIMEDIFF(CURRENT_TIME(), st.service7) AS timelast,
			COALESCE(k.department, 'ไม่ระบุ') AS department
		FROM opitemrece o
		LEFT OUTER JOIN patient pt ON o.hn = pt.hn
		LEFT OUTER JOIN service_time st ON o.vn = st.vn
		LEFT OUTER JOIN kskdepartment k ON o.dep_code = k.depcode
		WHERE o.vstdate = CURRENT_DATE()
			AND o.icode LIKE '1%'
			AND (st.service6 IS NULL AND st.service7 IS NOT NULL)
			AND o.vn IS NOT NULL
			AND (st.service12_dep IS NULL OR st.service12_dep NOT IN ('028', '029', '042', '037', '045', '098'))
		GROUP BY o.hn, pt.pname, pt.fname, pt.lname, st.service7, k.department
		ORDER BY TIMEDIFF(CURRENT_TIME(), st.service7) DESC
	`

	queryPrinted := `
		SELECT 
			pt.hn,
			TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''), ' ', COALESCE(pt.lname, ''))) AS ptname,
			TIME_FORMAT(st.service6, '%H:%i:%s') AS service_time,
			TIMEDIFF(CURRENT_TIME(), st.service6) AS timelast
		FROM opitemrece o
		LEFT OUTER JOIN patient pt ON o.hn = pt.hn
		LEFT OUTER JOIN service_time st ON o.vn = st.vn
		WHERE o.vstdate = CURRENT_DATE()
			AND o.icode LIKE '1%'
			AND (st.service6 IS NOT NULL AND st.service7 IS NOT NULL AND st.service16 IS NULL)
		GROUP BY o.hn, pt.pname, pt.fname, pt.lname, st.service6
		ORDER BY TIMEDIFF(CURRENT_TIME(), st.service6) DESC
	`

	var paidList []models.PaidDrugPatient
	if err := h.db.Select(&paidList, queryPaid); err != nil {
		log.Printf("[ERROR] Paid drug patients query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "เกิดข้อผิดพลาดในการดึงข้อมูลสถานะการจ่ายยา",
		})
		return
	}

	var printedList []models.PrintedDrugPatient
	if err := h.db.Select(&printedList, queryPrinted); err != nil {
		log.Printf("[ERROR] Printed drug patients query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "เกิดข้อผิดพลาดในการดึงข้อมูลสถานะการจ่ายยา",
		})
		return
	}

	if paidList == nil {
		paidList = []models.PaidDrugPatient{}
	}
	if printedList == nil {
		printedList = []models.PrintedDrugPatient{}
	}

	data := models.DrugStatusData{
		PaidPatients:    paidList,
		PrintedPatients: printedList,
		UpdatedAt:       time.Now().UTC().Format(time.RFC3339Nano),
	}

	h.cache.Set(cacheKey, data, 10*time.Second)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// GetAppointmentMismatch handles GET /api/service/appointment-mismatch
func (h *DrugStatusHandler) GetAppointmentMismatch(c *gin.Context) {
	cacheKey := "appointment-mismatch-data"
	if cached, ok := h.cache.Get(cacheKey); ok {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    cached,
		})
		return
	}

	sql := `
		SELECT 
			o.hn,
			COALESCE(DATE_FORMAT(o.vstdate, '%Y-%m-%d'), '') AS vstdate,
			COALESCE(DATE_FORMAT(o.nextdate, '%Y-%m-%d'), '') AS nextdate,
			COALESCE(TRIM(k.department), '') AS department,
			COALESCE(TRIM(o.app_user), '') AS app_user
		FROM oapp o
		LEFT OUTER JOIN kskdepartment k ON o.depcode = k.depcode
		WHERE o.nextdate > CURRENT_DATE
			AND (k.depcode_active IS NULL OR k.depcode_active = '')
		ORDER BY o.app_user
	`

	var rows []models.AppointmentMismatchRecord
	if err := h.db.Select(&rows, sql); err != nil {
		log.Printf("[ERROR] Appointment mismatch query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "เกิดข้อผิดพลาดในการดึงข้อมูลรายการนัดผิดห้องตรวจ",
		})
		return
	}

	if rows == nil {
		rows = []models.AppointmentMismatchRecord{}
	}

	data := models.AppointmentMismatchData{
		TotalMismatches: len(rows),
		UpdatedAt:       time.Now().UTC().Format(time.RFC3339Nano),
		Mismatches:      rows,
	}

	h.cache.Set(cacheKey, data, 10*time.Second)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}
