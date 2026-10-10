package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/cache"
	"thoen-hospital-backend/internal/database"
	"thoen-hospital-backend/internal/middleware"
	"thoen-hospital-backend/internal/models"
)

type ERHandler struct {
	db    *database.HosxpDB
	cache *cache.MemoryCache
}

func NewERHandler(db *database.HosxpDB, cache *cache.MemoryCache) *ERHandler {
	return &ERHandler{
		db:    db,
		cache: cache,
	}
}

func (h *ERHandler) GetStatus(c *gin.Context) {
	isTvMode := c.Query("mode") == "tv"

	// Check if user is authenticated staff
	isStaff := false
	if val, exists := c.Get("memberSession"); exists {
		if session, ok := val.(*middleware.MemberSession); ok {
			role := session.Role
			if role == "doctor" || role == "nurse" || role == "admin" || role == "member" {
				isStaff = true
			}
		}
	}

	// In-memory cache check (8 seconds TTL)
	cacheKey := "er-live-status-data"
	if cachedVal, found := h.cache.Get(cacheKey); found {
		if erData, ok := cachedVal.(*models.ERStatusData); ok {
			c.JSON(http.StatusOK, filterERResponse(erData, isStaff, isTvMode))
			return
		}
	}

	// 1. Fetch active patients
	activePatientsQuery := `
		SELECT 
			pt.hn,
			er.vn,
			concat(coalesce(pt.pname, ''), coalesce(pt.fname, ''), ' ', coalesce(pt.lname, '')) as ptname,
			YEAR(current_date)-YEAR(pt.birthday) as age,
			i.bedno,
			time(er.enter_er_time) as enter_time,
			er.er_list,
			eel.er_emergency_level_name,
			er.er_emergency_level_id,
			er.observe,
			edt.name as dch_type_name,
			w.name as wardname,
			h.name as hosname 
		FROM er_regist er 
		left outer join vn_stat vn on er.vn=vn.vn 
		left outer join patient pt on vn.hn=pt.hn 
		left outer join er_emergency_level eel on er.er_emergency_level_id=eel.er_emergency_level_id 
		left outer join er_dch_type edt on er.er_dch_type=edt.er_dch_type 
		left outer join an_stat an on er.vn=an.vn 
		left outer join iptadm i on an.an=i.an  
		left outer join ward w on an.ward=w.ward   
		left outer join referout r on vn.vn=r.vn 
		left outer join hospcode h on r.refer_hospcode=h.hospcode 
		WHERE er.vstdate = current_date 
			and ((er.er_dch_type in ('2','3','5','6','7','8','9') and w.name is null) and h.name is null) 
		ORDER BY er.enter_er_time DESC
	`

	var activePatients []models.ERPatient
	err := h.db.Select(&activePatients, activePatientsQuery)
	if err != nil {
		log.Printf("[ERROR] Active patients query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "ไม่สามารถดึงข้อมูลสถานะห้องฉุกเฉินได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
		})
		return
	}

	// 2. Count triage categories
	var criticalCount, emergencyCount, urgencyCount, semiUrgencyCount, nonUrgencyCount int
	for _, p := range activePatients {
		levelStr := fmt.Sprintf("%v", p.EREmergencyLevelID)
		switch levelStr {
		case "1":
			criticalCount++
		case "2":
			emergencyCount++
		case "3":
			urgencyCount++
		case "4":
			semiUrgencyCount++
		case "5":
			nonUrgencyCount++
		}
	}

	// 3. Monthly stats: Pt Types
	ptTypesQuery := `
		select count(er.vn) as v, coalesce(ept.name, 'ไม่ระบุ') as name 
		from er_regist er 
		left outer join er_period ep on er.er_period=ep.er_period 
		left outer join er_pt_type ept on er.er_pt_type=ept.er_pt_type 
		where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
		group by er.er_pt_type
	`
	var ptTypes []models.PtTypeStat
	_ = h.db.Select(&ptTypes, ptTypesQuery)

	// 4. Monthly stats: Emergency levels
	emergencyLevelsQuery := `
		select count(er.vn) as v, coalesce(ept.er_emergency_level_name, 'ไม่ระบุ') as er_emergency_level_name 
		from er_regist er 
		left outer join er_period ep on er.er_period=ep.er_period 
		left outer join er_emergency_level ept on er.er_emergency_level_id=ept.er_emergency_level_id 
		where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
			and er.er_emergency_level_id is not null 
		group by ept.er_emergency_level_name 
		order by ept.er_emergency_level_id
	`
	var emergencyLevels []models.EmergencyLevelStat
	_ = h.db.Select(&emergencyLevels, emergencyLevelsQuery)

	// 5. Monthly stats: Discharge types
	dischargeTypesQuery := `
		select count(er.vn) as v, coalesce(ept.name, 'ไม่ระบุ') as name 
		from er_regist er 
		left outer join er_period ep on er.er_period=ep.er_period 
		left outer join er_dch_type ept on er.er_dch_type=ept.er_dch_type 
		where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
			and ept.er_dch_type is not null 
		group by ept.name 
		order by ept.er_dch_type
	`
	var dischargeTypes []models.DischargeTypeStat
	_ = h.db.Select(&dischargeTypes, dischargeTypesQuery)

	// 6. Error status patients
	errorStatusQuery := `
		SELECT 
			d.name as nname,
			er.vstdate,
			pt.hn,
			er.vn,
			edt.name as status_name
		FROM er_regist er 
		left outer join vn_stat vn on er.vn=vn.vn 
		left outer join patient pt on vn.hn=pt.hn 
		left outer join er_dch_type edt on er.er_dch_type=edt.er_dch_type 
		left outer join doctor d on er.er_doctor=d.code 
		WHERE (er.vstdate between DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 day),INTERVAL - 7 MONTH) 
					 and DATE_ADD(DATE_ADD(CURDATE(),INTERVAL -1 day),INTERVAL 0 MONTH) ) 
			and (er.er_dch_type in ('5','6','7','8','9')) 
		ORDER BY er.vstdate DESC
	`
	var errorStatusRows []models.ERErrorPatient
	_ = h.db.Select(&errorStatusRows, errorStatusQuery)

	data := &models.ERStatusData{
		ActivePatients: activePatients,
		ErrorStatusList: models.ERErrorStatusList{
			Total: len(errorStatusRows),
			List:  errorStatusRows,
		},
		Summary: models.ERSummary{
			TotalActive: len(activePatients),
			Critical:    criticalCount,
			Emergency:   emergencyCount,
			Urgency:     urgencyCount,
			SemiUrgency: semiUrgencyCount,
			NonUrgency:  nonUrgencyCount,
		},
		Stats: models.ERStats{
			PtTypes:         ptTypes,
			EmergencyLevels: emergencyLevels,
			DischargeTypes:  dischargeTypes,
		},
	}

	// Cache result for 8 seconds
	h.cache.Set(cacheKey, data, 8*time.Second)

	c.JSON(http.StatusOK, filterERResponse(data, isStaff, isTvMode))
}

func filterERResponse(data *models.ERStatusData, isStaff, isTvMode bool) gin.H {
	if isStaff || isTvMode {
		return gin.H{
			"activePatients":  data.ActivePatients,
			"errorStatusList": data.ErrorStatusList,
			"summary":         data.Summary,
			"stats":           data.Stats,
		}
	}

	return gin.H{
		"activePatients": []models.ERPatient{},
		"errorStatusList": gin.H{
			"total": data.ErrorStatusList.Total,
			"list":  []models.ERErrorPatient{},
		},
		"summary": data.Summary,
		"stats":   data.Stats,
	}
}
