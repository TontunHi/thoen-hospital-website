package handlers

import (
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/database"
	"thoen-hospital-backend/internal/models"
)

var cidRegex = regexp.MustCompile(`^\d{13}$`)

type AppointmentHandler struct {
	db *database.HosxpDB
}

func NewAppointmentHandler(db *database.HosxpDB) *AppointmentHandler {
	return &AppointmentHandler{db: db}
}

func (h *AppointmentHandler) Search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if !cidRegex.MatchString(q) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "กรุณากรอกเลขประจำตัวประชาชนให้ครบถ้วน 13 หลัก",
		})
		return
	}

	sql := `
		SELECT 
			ap.hn,
			concat(coalesce(pt.pname, ''), coalesce(pt.fname, ''), ' ', coalesce(pt.lname, '')) as ptname,
			ap.nextdate as appoint_date,
			ap.nexttime as appoint_time,
			c.name as clinic_name,
			d.name as doctor_name,
			ap.note as appoint_note,
			ap.app_no
		FROM oapp ap
		LEFT OUTER JOIN patient pt ON ap.hn = pt.hn
		LEFT OUTER JOIN clinic c ON ap.clinic = c.clinic
		LEFT OUTER JOIN doctor d ON ap.doctor = d.code
		WHERE pt.cid = ?
			AND (ap.app_no IS NULL OR ap.app_no != 'C')
		ORDER BY ap.nextdate DESC, ap.nexttime DESC
	`

	var rawRows []models.RawAppointment
	err := h.db.Select(&rawRows, sql, q)
	if err != nil {
		log.Printf("[ERROR] Appointment query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "เกิดข้อผิดพลาดในการดึงข้อมูลนัดหมาย กรุณาลองใหม่อีกครั้งในภายหลัง",
		})
		return
	}

	formatted := make([]models.AppointmentItem, 0, len(rawRows))
	for _, row := range rawRows {
		dateStr := formatAppointDate(row.AppointDate)

		clinicName := "ไม่ระบุห้องตรวจ"
		if row.ClinicName != nil && *row.ClinicName != "" {
			clinicName = *row.ClinicName
		}

		doctorName := "พบแพทย์ประจำห้องตรวจ"
		if row.DoctorName != nil && *row.DoctorName != "" {
			doctorName = *row.DoctorName
		}

		appointNote := "-"
		if row.AppointNote != nil && *row.AppointNote != "" {
			appointNote = *row.AppointNote
		}

		formatted = append(formatted, models.AppointmentItem{
			HN:          row.HN,
			PtName:      MaskThaiPatientName(row.PtName),
			AppointDate: dateStr,
			AppointTime: row.AppointTime,
			ClinicName:  clinicName,
			DoctorName:  doctorName,
			AppointNote: appointNote,
		})
	}

	c.JSON(http.StatusOK, models.AppointmentResponse{
		Success:      true,
		Appointments: formatted,
	})
}

func formatAppointDate(raw any) string {
	if raw == nil {
		return ""
	}
	switch v := raw.(type) {
	case time.Time:
		return v.Format("2006-01-02")
	case []byte:
		return string(v)
	case string:
		if len(v) >= 10 {
			return v[:10]
		}
		return v
	default:
		return fmt.Sprintf("%v", raw)
	}
}

// MaskThaiPatientName masks patient name according to Thailand PDPA standards.
// e.g. "นาย สมชาย ใจดี" -> "นาย สมช** ใจ**"
func MaskThaiPatientName(fullName string) string {
	trimmed := strings.TrimSpace(fullName)
	if trimmed == "" {
		return "ผู้รับบริการ"
	}

	prefixes := []string{
		"เด็กชาย", "เด็กหญิง", "นางสาว", "นาย", "นาง",
		"ด.ช.", "ด.ญ.", "น.ส.", "ด.ต.", "พ.ต.ท.", "พ.ต.อ.", "ร.ต.อ.", "ร.ต.ท.", "ร.ต.ต.",
		"พญ.", "นพ.", "ทพ.", "ทพญ.", "ภก.", "ภญ.", "ผศ.", "รศ.", "ศ.", "ดร.",
	}

	title := ""
	remaining := trimmed
	for _, p := range prefixes {
		if strings.HasPrefix(remaining, p) {
			title = p
			remaining = strings.TrimSpace(strings.TrimPrefix(remaining, p))
			break
		}
	}

	parts := strings.Fields(remaining)
	if len(parts) == 0 {
		return trimmed
	}

	firstRunes := []rune(parts[0])
	var maskedFirst string
	if len(firstRunes) > 3 {
		visibleLen := max(2, int(float64(len(firstRunes))*0.6))
		maskedFirst = string(firstRunes[:visibleLen]) + "**"
	} else if len(firstRunes) > 1 {
		maskedFirst = string(firstRunes[:1]) + "**"
	} else {
		maskedFirst = string(firstRunes)
	}

	var maskedLast string
	if len(parts) > 1 {
		lastRunes := []rune(strings.Join(parts[1:], " "))
		if len(lastRunes) > 3 {
			visibleLen := max(2, int(float64(len(lastRunes))*0.5))
			maskedLast = string(lastRunes[:visibleLen]) + "***"
		} else if len(lastRunes) > 1 {
			maskedLast = string(lastRunes[:1]) + "**"
		} else {
			maskedLast = string(lastRunes) + "*"
		}
	}

	res := make([]string, 0, 3)
	if title != "" {
		res = append(res, title)
	}
	res = append(res, maskedFirst)
	if maskedLast != "" {
		res = append(res, maskedLast)
	}

	return strings.Join(res, " ")
}
