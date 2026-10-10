package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/database"
	"thoen-hospital-backend/internal/models"
)

type LabTrackerHandler struct {
	db *database.HosxpDB
}

func NewLabTrackerHandler(db *database.HosxpDB) *LabTrackerHandler {
	return &LabTrackerHandler{db: db}
}

// GetReport handles GET /api/service/lab-tracker/report
func (h *LabTrackerHandler) GetReport(c *gin.Context) {
	doctorCode := strings.TrimSpace(c.Query("id"))

	var pendingSql, reportedSql string
	var params []any

	if doctorCode != "" && doctorCode != "all" {
		pendingSql = `
			SELECT d.code, d.name, lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
			time(lh.order_time) as order_time, time(lh.receive_time) as receive_time, lh.form_name 
			FROM lab_head lh  
			left outer join patient pt on lh.hn=pt.hn 
			left outer join doctor d on lh.doctor_code=d.code 
			WHERE lh.order_date = CURRENT_DATE() 
				and lh.department = 'OPD' 
				and d.name is not null 
				and lh.report_date is null 
				and d.code = ? 
			GROUP BY lh.hn 
			ORDER BY lh.lab_order_number ASC
		`
		reportedSql = `
			SELECT d.code, d.name, lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
			time(lh.report_time) as report_time, lh.lab_order_number, ovst.ovstost 
			FROM lab_head lh  
			left outer join patient pt on lh.hn=pt.hn 
			left outer join ovst ovst on lh.hn=ovst.hn 
			left outer join doctor d on lh.doctor_code=d.code 
			WHERE lh.order_date = CURRENT_DATE() 
				and lh.department = 'OPD' 
				and d.name is not null 
				and lh.report_date is not null 
				and d.code = ? 
			GROUP BY lh.hn 
			ORDER BY lh.report_time DESC
		`
		params = []any{doctorCode}
	} else {
		pendingSql = `
			SELECT d.code, substring_index(d.name, ' ', 1) as name, lh.hn, 
			concat(pt.pname, pt.fname) as ptname, time(lh.order_time) as order_time,
			time(lh.receive_time) as receive_time, lh.form_name 
			FROM lab_head lh  
			left outer join patient pt on lh.hn=pt.hn 
			left outer join doctor d on lh.doctor_code=d.code 
			WHERE lh.order_date = CURRENT_DATE() 
				and lh.department = 'OPD' 
				and d.name is not null 
				and lh.report_date is null  
			GROUP BY lh.hn 
			ORDER BY lh.lab_order_number ASC
		`
		reportedSql = `
			SELECT d.code, substring_index(d.name, ' ', 1) as name, lh.hn, 
			concat(pt.pname, pt.fname) as ptname, time(lh.report_time) as report_time,
			lh.lab_order_number, ovst.ovstost 
			FROM lab_head lh  
			left outer join patient pt on lh.hn=pt.hn 
			left outer join ovst ovst on lh.hn=ovst.hn 
			left outer join doctor d on lh.doctor_code=d.code 
			WHERE lh.order_date = CURRENT_DATE() 
				and lh.department = 'OPD' 
				and d.name is not null 
				and lh.report_date is not null 
			GROUP BY lh.hn 
			ORDER BY lh.report_time DESC
		`
		params = []any{}
	}

	var pendingRows []models.LabTrackerPendingItem
	var reportedRows []models.LabTrackerReportedItem

	errPending := h.db.Select(&pendingRows, pendingSql, params...)
	errReported := h.db.Select(&reportedRows, reportedSql, params...)

	if errPending != nil || errReported != nil {
		log.Printf("[ERROR] Lab tracker report query failed: pending=%v, reported=%v", errPending, errReported)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "เกิดข้อผิดพลาดในการดึงรายการความคืบหน้าของ LAB",
		})
		return
	}

	senderName := "ทั้งหมด"
	if doctorCode != "" && doctorCode != "all" {
		if len(pendingRows) > 0 {
			senderName = pendingRows[0].DoctorName
		} else if len(reportedRows) > 0 {
			senderName = reportedRows[0].DoctorName
		} else {
			senderName = "ผู้สั่งตรวจ"
		}
	}

	c.JSON(http.StatusOK, models.LabTrackerReportResult{
		Success:    true,
		SenderName: senderName,
		Pending:    pendingRows,
		Reported:   reportedRows,
	})
}

// GetDoctors handles GET /api/service/lab-tracker/doctors
func (h *LabTrackerHandler) GetDoctors(c *gin.Context) {
	opdDoctorsSql := `
		SELECT d.code, d.name, count(distinct(lh.hn)) as cc 
		FROM lab_head lh 
		left outer join doctor d on lh.doctor_code=d.code 
		WHERE lh.order_date = CURRENT_DATE() 
			and lh.department = 'OPD' 
			and d.name is not null 
			and d.provider_type_code in ('01','011','02') 
		GROUP BY lh.doctor_code 
		ORDER BY d.name
	`
	otherStaffSql := `
		SELECT d.code, d.name, count(distinct(lh.hn)) as cc 
		FROM lab_head lh 
		left outer join doctor d on lh.doctor_code=d.code 
		WHERE lh.order_date = CURRENT_DATE() 
			and lh.department = 'OPD' 
			and d.name is not null 
			and d.provider_type_code not in ('01','011','02') 
		GROUP BY lh.doctor_code 
		ORDER BY d.name
	`
	totalOrderedSql := `
		SELECT count(distinct(lh.hn)) as cc 
		FROM lab_head lh 
		left outer join doctor d on lh.doctor_code=d.code 
		WHERE lh.order_date = CURRENT_DATE() 
			and lh.department = 'OPD' 
			and d.name is not null
	`

	var doctors []models.LabTrackerDoctorItem
	var others []models.LabTrackerDoctorItem
	var totalRow struct {
		CC int `db:"cc"`
	}

	_ = h.db.Select(&doctors, opdDoctorsSql)
	_ = h.db.Select(&others, otherStaffSql)
	_ = h.db.Get(&totalRow, totalOrderedSql)

	c.JSON(http.StatusOK, models.LabTrackerDoctorsResult{
		Success:    true,
		Doctors:    doctors,
		Others:     others,
		TotalCount: totalRow.CC,
	})
}

// GetDetail handles GET /api/service/lab-tracker/detail
func (h *LabTrackerHandler) GetDetail(c *gin.Context) {
	hn := strings.TrimSpace(c.Query("hn"))
	if hn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเลข HN"})
		return
	}

	reportedSql := `
		SELECT lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
		l.lab_items_name, lo.lab_order_result, lh.form_name, l.lab_items_normal_value 
		FROM lab_head lh 
		left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
		left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
		left outer join patient pt on lh.hn=pt.hn 
		WHERE lh.hn = ? 
			and lh.order_date = CURRENT_DATE() 
			and lo.confirm = 'Y'
	`
	pendingSql := `
		SELECT lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
		l.lab_items_name, l.items_is_outlab, lh.form_name, l.lab_items_normal_value 
		FROM lab_head lh 
		left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
		left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
		left outer join patient pt on lh.hn=pt.hn 
		WHERE lh.hn = ? 
			and lh.order_date = CURRENT_DATE() 
			and lo.confirm = 'N' 
			and lh.report_date is null
	`

	type reportedRow struct {
		models.LabTrackerDetailReported
		PtName string `db:"ptname"`
	}
	type pendingRow struct {
		models.LabTrackerDetailPending
		PtName string `db:"ptname"`
	}

	var repRows []reportedRow
	var pendRows []pendingRow

	_ = h.db.Select(&repRows, reportedSql, hn)
	_ = h.db.Select(&pendRows, pendingSql, hn)

	patientName := "ไม่ระบุชื่อ"
	if len(repRows) > 0 {
		patientName = repRows[0].PtName
	} else if len(pendRows) > 0 {
		patientName = pendRows[0].PtName
	}

	reportedItems := make([]models.LabTrackerDetailReported, len(repRows))
	for i, r := range repRows {
		reportedItems[i] = r.LabTrackerDetailReported
	}

	pendingItems := make([]models.LabTrackerDetailPending, len(pendRows))
	for i, p := range pendRows {
		pendingItems[i] = p.LabTrackerDetailPending
	}

	c.JSON(http.StatusOK, models.LabTrackerDetailResult{
		Success:     true,
		HN:          hn,
		PatientName: patientName,
		Reported:    reportedItems,
		Pending:     pendingItems,
	})
}
