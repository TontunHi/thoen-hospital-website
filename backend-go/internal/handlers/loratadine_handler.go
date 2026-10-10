package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/database"
	"thoen-hospital-backend/internal/models"
)

type LoratadineHandler struct {
	db *database.HosxpDB
}

func NewLoratadineHandler(db *database.HosxpDB) *LoratadineHandler {
	return &LoratadineHandler{db: db}
}

func (h *LoratadineHandler) GetDispenseSummary(c *gin.Context) {
	ageFilter := c.DefaultQuery("age", "adult")

	ageClause := ""
	if ageFilter == "adult" {
		ageClause = "AND (YEAR(o.vstdate) - YEAR(p.birthday)) > 19"
	}

	sql := fmt.Sprintf(`
		SELECT 
			o.hn,
			coalesce(YEAR(o.vstdate) - YEAR(p.birthday), 0) AS age,
			CONCAT(coalesce(p.pname, ''), coalesce(p.fname, ''), ' ', coalesce(p.lname, '')) AS fullname,
			IF(o.vn IS NULL, 'IPD', 'OPD') AS status,
			coalesce(o.vstdate, '') AS vstdate,
			coalesce(o.rxdate, '') AS rxdate,
			coalesce(TIME_FORMAT(o.rxtime, '%%H:%%i:%%s'), '-') AS rxtime,
			o.qty,
			COALESCE(d.name, 'ไม่ระบุผู้สั่งตรวจ/จ่ายยา') AS doctor_name,
			COALESCE(k.department, 'ไม่ระบุแผนก') AS department
		FROM opitemrece o
		LEFT JOIN patient p ON o.hn = p.hn
		LEFT JOIN doctor d ON o.doctor = d.code
		LEFT JOIN kskdepartment k ON o.dep_code = k.depcode
		WHERE o.icode = '1460211'
			AND o.vstdate = CURDATE()
			%s
		ORDER BY o.rxtime DESC
	`, ageClause)

	var items []models.LoratadineItem
	err := h.db.Select(&items, sql)
	if err != nil {
		log.Printf("[ERROR] Loratadine dispense query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "เกิดข้อผิดพลาดในการดึงข้อมูลการจ่ายยาจากระบบหลัก",
		})
		return
	}

	totalQty := 0
	opdCount := 0
	ipdCount := 0
	adultCount := 0

	for i := range items {
		qtyNum := parseQty(items[i].Qty)
		totalQty += qtyNum

		if items[i].Status == "OPD" {
			opdCount++
		} else if items[i].Status == "IPD" {
			ipdCount++
		}

		if items[i].Age > 19 {
			adultCount++
		}

		if len(items[i].Rxtime) >= 5 && items[i].Rxtime != "-" {
			items[i].Rxtime = items[i].Rxtime[:5] + " น."
		}
	}

	summary := models.LoratadineSummary{
		TotalCount: len(items),
		TotalQty:   totalQty,
		OpdCount:   opdCount,
		IpdCount:   ipdCount,
		AdultCount: adultCount,
	}

	c.JSON(http.StatusOK, models.LoratadineResponse{
		Success: true,
		Items:   items,
		Summary: summary,
	})
}

func parseQty(raw any) int {
	if raw == nil {
		return 0
	}
	switch v := raw.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case []byte:
		n, _ := strconv.Atoi(string(v))
		return n
	case string:
		n, _ := strconv.Atoi(v)
		return n
	default:
		return 0
	}
}
