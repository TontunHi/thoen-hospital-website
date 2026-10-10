package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"thoen-hospital-backend/internal/database"
	"thoen-hospital-backend/internal/models"
)

type ClinicalLabHandler struct {
	db *database.HosxpDB
}

func NewClinicalLabHandler(db *database.HosxpDB) *ClinicalLabHandler {
	return &ClinicalLabHandler{db: db}
}

type searchRequest struct {
	Query string `json:"query"`
}

func (h *ClinicalLabHandler) Search(c *gin.Context) {
	var req searchRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Query) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกหมายเลขบัตรประชาชน หรือ HN"})
		return
	}

	searchQuery := strings.TrimSpace(req.Query)

	sql := `
		SELECT 
			o.cc,
			pt.hn,
			if((SELECT count(lo2.lab_order_number) FROM lab_head lh2 join lab_order lo2 on lh2.lab_order_number=lo2.lab_order_number WHERE lh2.vn=ov.an and lo2.confirm = 'Y' limit 1),(SELECT count(lo2.lab_order_number) from lab_head lh2 join lab_order lo2 on lh2.lab_order_number=lo2.lab_order_number where lh2.vn=ov.an and lo2.confirm = 'Y' limit 1),null) as clab2,
			if((SELECT count(lo.lab_order_number) from lab_head lh join lab_order lo on lh.lab_order_number=lo.lab_order_number where lh.vn=o.vn and lo.confirm = 'Y' limit 1)>0,(SELECT count(lo.lab_order_number) from lab_head lh join lab_order lo on lh.lab_order_number=lo.lab_order_number where lh.vn=o.vn and lo.confirm = 'Y' limit 1),null) as clab,
			if((SELECT count(o1.icode) from opitemrece o1 join drugitems d on o1.icode=d.icode where o1.vn=o.vn limit 1)>0,(SELECT count(o1.icode) from opitemrece o1 join drugitems d on o1.icode=d.icode where o1.vn=o.vn limit 1),null) as co1,
			if((SELECT count(o1.icode) from opitemrece o1 join drugitems d on o1.icode=d.icode where o1.an=ov.an limit 1)>0,(SELECT count(o1.icode) from opitemrece o1 join drugitems d on o1.icode=d.icode where o1.an=ov.an limit 1),null) as co2,
			ovs.name as status_name,
			o.vn,
			ov.an,
			pt.cid,
			concat(coalesce(pt.pname, ''), coalesce(pt.fname, ''), ' ', coalesce(pt.lname, '')) as ptname, 
			year(o.vstdate)+543 as yearv, 
			case month(o.vstdate) 
				when '1' then 'ม.ค.' 
				when '2' then 'ก.พ.' 
				when '3' then 'มี.ค.' 
				when '4' then 'เม.ย.' 
				when '5' then 'พ.ค.' 
				when '6' then 'มิ.ย.' 
				when '7' then 'ก.ค.' 
				when '8' then 'ส.ค.' 
				when '9' then 'ก.ย.' 
				when '10' then 'ต.ค.' 
				when '11' then 'พ.ย.' 
				when '12' then 'ธ.ค.'
			end as monthv,
			day(o.vstdate) as dayv,  
			coalesce(k.department, '') as department 
		FROM opdscreen o 
		left outer join patient pt on o.hn=pt.hn 
		left outer join kskdepartment k on o.screen_dep=k.depcode 
		left outer join ovst ov on o.vn=ov.vn 
		left outer join ovstost ovs on ov.ovstost=ovs.ovstost 
		WHERE (pt.cid = ? or pt.hn = ?) 
		ORDER BY o.vn DESC
	`

	var rows []models.PatientVisitItem
	err := h.db.Select(&rows, sql, searchQuery, searchQuery)
	if err != nil {
		log.Printf("[ERROR] Patient visits search query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบหลัก"})
		return
	}

	for i := range rows {
		day := ""
		month := ""
		year := ""
		if rows[i].DayV != nil {
			day = *rows[i].DayV
		}
		if rows[i].MonthV != nil {
			month = *rows[i].MonthV
		}
		if rows[i].YearV != nil {
			year = *rows[i].YearV
		}
		rows[i].DateText = strings.TrimSpace(fmt.Sprintf("%s %s %s", day, month, year))

		if rows[i].Co1 != nil {
			rows[i].OpdDrugsCount = *rows[i].Co1
		}
		if rows[i].Clab != nil {
			rows[i].OpdLabsCount = *rows[i].Clab
		}
		if rows[i].Co2 != nil {
			rows[i].IpdDrugsCount = *rows[i].Co2
		}
		if rows[i].Clab2 != nil {
			rows[i].IpdLabsCount = *rows[i].Clab2
		}
	}

	if len(rows) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"patients": []models.PatientVisitItem{},
			"message":  "ไม่พบประวัติการรักษาของผู้ป่วยรายนี้",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"patients": rows,
	})
}

func (h *ClinicalLabHandler) GetDetail(c *gin.Context) {
	vn := strings.TrimSpace(c.Query("vn"))
	an := strings.TrimSpace(c.Query("an"))

	if vn == "" && an == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุหมายเลข VN หรือ AN"})
		return
	}

	if vn != "" {
		// OPD Details
		details, err := h.getOpdDetails(vn)
		if err != nil || details == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลการตรวจรักษา OPD นี้"})
			return
		}
		c.JSON(http.StatusOK, details)
		return
	}

	// IPD Details
	details, err := h.getIpdDetails(an)
	if err != nil || details == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลการรักษา IPD นี้"})
		return
	}
	c.JSON(http.StatusOK, details)
}

func (h *ClinicalLabHandler) getOpdDetails(vn string) (*models.ClinicalVisitDetails, error) {
	patientSql := `
		SELECT o.hn, pt.cid, concat(coalesce(pt.pname, ''), coalesce(pt.fname, ''), ' ', coalesce(pt.lname, '')) as ptname,
		YEAR(CURDATE())-YEAR(pt.birthday) as ptage, o.vn,
		year(o.vstdate)+543 as yearv, 
		case month(o.vstdate) 
			when '1' then 'ม.ค.' when '2' then 'ก.พ.' when '3' then 'มี.ค.' when '4' then 'เม.ย.' when '5' then 'พ.ค.' when '6' then 'มิ.ย.' when '7' then 'ก.ค.' when '8' then 'ส.ค.' when '9' then 'ก.ย.' when '10' then 'ต.ค.' when '11' then 'พ.ย.' when '12' then 'ธ.ค.'
		end as monthv,
		day(o.vstdate) as dayv 
		FROM opdscreen o 
		join patient pt on pt.hn=o.hn 
		WHERE vn = ?
	`
	var pRows []struct {
		HN     string  `db:"hn"`
		CID    string  `db:"cid"`
		PtName string  `db:"ptname"`
		PtAge  int     `db:"ptage"`
		DayV   *string `db:"dayv"`
		MonthV *string `db:"monthv"`
		YearV  *string `db:"yearv"`
	}
	if err := h.db.Select(&pRows, patientSql, vn); err != nil || len(pRows) == 0 {
		return nil, err
	}
	p := pRows[0]

	screenSql := `
		SELECT 
			concat(ic1.code,' : ',ic1.name) as dx0name,
			concat(ic2.code,' : ',ic2.name) as dx1name,
			concat(ic3.code,' : ',ic3.name) as dx2name,
			o.pe,
			concat(ic.code,' : ',ic.name) as name,
			o.bpd, o.bps, o.bw, o.cc, o.pulse, o.temperature, o.rr, o.height, o.hpi, o.pmh,
			k.department 
		FROM opdscreen o  
		left outer join kskdepartment k on o.screen_dep=k.depcode 
		left outer join vn_stat vn on o.vn=vn.vn 
		left outer join icd101 ic on vn.pdx=ic.code 
		left outer join icd101 ic1 on vn.dx0=ic1.code 
		left outer join icd101 ic2 on vn.dx1=ic2.code 
		left outer join icd101 ic3 on vn.dx2=ic3.code 
		WHERE o.vn = ?
	`
	var screenRows []models.VisitScreeningInfo
	_ = h.db.Select(&screenRows, screenSql, vn)
	var screen *models.VisitScreeningInfo
	if len(screenRows) > 0 {
		screen = &screenRows[0]
	}

	drugSql := `
		SELECT dr.name1, d.strength, dr.name2, dr.name3, d.name, o.qty, d.units,
		su.sp_name as sname, su.name1 as sname1, su.name2 as sname2, su.name3 as sname3 
		FROM opitemrece o  
		join drugitems d on o.icode=d.icode 
		left outer join drugusage dr on o.drugusage=dr.drugusage 
		left outer join sp_use su on o.sp_use=su.sp_use 
		WHERE vn = ? and o.qty <> '0'
	`
	var rawDrugs []struct {
		Name     string  `db:"name"`
		Strength *string `db:"strength"`
		Qty      any     `db:"qty"`
		Units    *string `db:"units"`
		Name1    *string `db:"name1"`
		Name2    *string `db:"name2"`
		Name3    *string `db:"name3"`
		Sname1   *string `db:"sname1"`
		Sname2   *string `db:"sname2"`
		Sname3   *string `db:"sname3"`
	}
	_ = h.db.Select(&rawDrugs, drugSql, vn)

	drugs := make([]models.VisitDrugItem, len(rawDrugs))
	for i, d := range rawDrugs {
		usageParts := make([]string, 0, 6)
		for _, u := range []*string{d.Name1, d.Name2, d.Name3, d.Sname1, d.Sname2, d.Sname3} {
			if u != nil && *u != "" {
				usageParts = append(usageParts, *u)
			}
		}
		drugs[i] = models.VisitDrugItem{
			Name:     d.Name,
			Strength: d.Strength,
			Qty:      d.Qty,
			Units:    d.Units,
			Usage:    strings.Join(usageParts, " "),
		}
	}

	labSql := `
		SELECT lh.vn, lh.hn, l.lab_items_name, lo.lab_order_result, lh.form_name, l.lab_items_normal_value 
		FROM lab_head lh 
		left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
		left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
		WHERE lh.vn = ? and lo.confirm = 'Y' and lo.lab_order_result is not null
	`
	var rawLabs []struct {
		FormName *string `db:"form_name"`
		ItemName string  `db:"lab_items_name"`
		Result   string  `db:"lab_order_result"`
		RefValue *string `db:"lab_items_normal_value"`
	}
	_ = h.db.Select(&rawLabs, labSql, vn)

	labs := make([]models.VisitLabItem, len(rawLabs))
	for i, l := range rawLabs {
		labs[i] = models.VisitLabItem{
			FormName: l.FormName,
			ItemName: l.ItemName,
			Result:   l.Result,
			RefValue: l.RefValue,
		}
	}

	xraySql := `SELECT xray_list FROM xray_head WHERE vn = ?`
	var xrayRows []struct {
		XrayList *string `db:"xray_list"`
	}
	_ = h.db.Select(&xrayRows, xraySql, vn)
	var xray *string
	if len(xrayRows) > 0 {
		xray = xrayRows[0].XrayList
	}

	day := ""
	month := ""
	year := ""
	if p.DayV != nil {
		day = *p.DayV
	}
	if p.MonthV != nil {
		month = *p.MonthV
	}
	if p.YearV != nil {
		year = *p.YearV
	}

	return &models.ClinicalVisitDetails{
		Type: "OPD",
		Patient: models.VisitPatientHeader{
			HN:       p.HN,
			CID:      p.CID,
			Name:     p.PtName,
			Age:      p.PtAge,
			DateText: strings.TrimSpace(fmt.Sprintf("%s %s %s", day, month, year)),
		},
		Screen: screen,
		Drugs:  drugs,
		Labs:   labs,
		Xray:   xray,
	}, nil
}

func (h *ClinicalLabHandler) getIpdDetails(an string) (*models.ClinicalVisitDetails, error) {
	patientSql := `
		SELECT concat(ic.code,' : ',ic.tname) as tname, o.hn, pt.cid, concat(coalesce(pt.pname, ''), coalesce(pt.fname, ''), ' ', coalesce(pt.lname, '')) as ptname,
		YEAR(CURDATE())-YEAR(pt.birthday) as ptage, o.vn,
		year(o.regdate)+543 as yearv, 
		case month(o.regdate) 
			when '1' then 'ม.ค.' when '2' then 'ก.พ.' when '3' then 'มี.ค.' when '4' then 'เม.ย.' when '5' then 'พ.ค.' when '6' then 'มิ.ย.' when '7' then 'ก.ค.' when '8' then 'ส.ค.' when '9' then 'ก.ย.' when '10' then 'ต.ค.' when '11' then 'พ.ย.' when '12' then 'ธ.ค.'
		end as monthv,
		day(o.regdate) as dayv 
		FROM an_stat o 
		join patient pt on pt.hn=o.hn  
		left outer join icd101 ic on o.pdx=ic.code 
		WHERE o.an = ?
	`
	var pRows []struct {
		TName  *string `db:"tname"`
		HN     string  `db:"hn"`
		CID    string  `db:"cid"`
		PtName string  `db:"ptname"`
		PtAge  int     `db:"ptage"`
		DayV   *string `db:"dayv"`
		MonthV *string `db:"monthv"`
		YearV  *string `db:"yearv"`
	}
	if err := h.db.Select(&pRows, patientSql, an); err != nil || len(pRows) == 0 {
		return nil, err
	}
	p := pRows[0]

	drugSql := `
		SELECT dr.name1, d.strength, dr.name2, dr.name3, d.name, o.qty, d.units,
		year(o.rxdate)+543 as yearv, 
		case month(o.rxdate) 
			when '1' then 'ม.ค.' when '2' then 'ก.พ.' when '3' then 'มี.ค.' when '4' then 'เม.ย.' when '5' then 'พ.ค.' when '6' then 'มิ.ย.' when '7' then 'ก.ค.' when '8' then 'ส.ค.' when '9' then 'ก.ย.' when '10' then 'ต.ค.' when '11' then 'พ.ย.' when '12' then 'ธ.ค.'
		end as monthv,
		day(o.rxdate) as dayv 
		FROM opitemrece o  
		join drugitems d on o.icode=d.icode 
		left outer join drugusage dr on o.drugusage=dr.drugusage 
		WHERE o.an = ? and o.qty <> '0' 
		ORDER BY o.rxdate
	`
	var rawDrugs []struct {
		Name     string  `db:"name"`
		Strength *string `db:"strength"`
		Qty      any     `db:"qty"`
		Units    *string `db:"units"`
		Name1    *string `db:"name1"`
		Name2    *string `db:"name2"`
		Name3    *string `db:"name3"`
		DayV     *string `db:"dayv"`
		MonthV   *string `db:"monthv"`
		YearV    *string `db:"yearv"`
	}
	_ = h.db.Select(&rawDrugs, drugSql, an)

	drugs := make([]models.VisitDrugItem, len(rawDrugs))
	for i, d := range rawDrugs {
		usageParts := make([]string, 0, 3)
		for _, u := range []*string{d.Name1, d.Name2, d.Name3} {
			if u != nil && *u != "" {
				usageParts = append(usageParts, *u)
			}
		}
		day := ""
		month := ""
		year := ""
		if d.DayV != nil {
			day = *d.DayV
		}
		if d.MonthV != nil {
			month = *d.MonthV
		}
		if d.YearV != nil {
			year = *d.YearV
		}
		drugs[i] = models.VisitDrugItem{
			DateText: strings.TrimSpace(fmt.Sprintf("%s %s %s", day, month, year)),
			Name:     d.Name,
			Strength: d.Strength,
			Qty:      d.Qty,
			Units:    d.Units,
			Usage:    strings.Join(usageParts, " "),
		}
	}

	labSql := `
		SELECT lh.vn, lh.hn, l.lab_items_name, lo.lab_order_result, lh.form_name, l.lab_items_normal_value,
		year(lh.report_date)+543 as yearv, 
		case month(lh.report_date) 
			when '1' then 'ม.ค.' when '2' then 'ก.พ.' when '3' then 'มี.ค.' when '4' then 'เม.ย.' when '5' then 'พ.ค.' when '6' then 'มิ.ย.' when '7' then 'ก.ค.' when '8' then 'ส.ค.' when '9' then 'ก.ย.' when '10' then 'ต.ค.' when '11' then 'พ.ย.' when '12' then 'ธ.ค.'
		end as monthv,
		day(lh.report_date) as dayv 
		FROM lab_head lh 
		left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
		left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
		WHERE lh.vn = ? and lo.confirm = 'Y' 
		ORDER BY lh.report_date
	`
	var rawLabs []struct {
		FormName *string `db:"form_name"`
		ItemName string  `db:"lab_items_name"`
		Result   string  `db:"lab_order_result"`
		RefValue *string `db:"lab_items_normal_value"`
		DayV     *string `db:"dayv"`
		MonthV   *string `db:"monthv"`
		YearV    *string `db:"yearv"`
	}
	_ = h.db.Select(&rawLabs, labSql, an)

	labs := make([]models.VisitLabItem, len(rawLabs))
	for i, l := range rawLabs {
		day := ""
		month := ""
		year := ""
		if l.DayV != nil {
			day = *l.DayV
		}
		if l.MonthV != nil {
			month = *l.MonthV
		}
		if l.YearV != nil {
			year = *l.YearV
		}
		labs[i] = models.VisitLabItem{
			DateText: strings.TrimSpace(fmt.Sprintf("%s %s %s", day, month, year)),
			FormName: l.FormName,
			ItemName: l.ItemName,
			Result:   l.Result,
			RefValue: l.RefValue,
		}
	}

	xraySql := `SELECT xray_list FROM xray_head WHERE vn = ?`
	var xrayRows []struct {
		XrayList *string `db:"xray_list"`
	}
	_ = h.db.Select(&xrayRows, xraySql, an)
	var xray *string
	if len(xrayRows) > 0 {
		xray = xrayRows[0].XrayList
	}

	day := ""
	month := ""
	year := ""
	if p.DayV != nil {
		day = *p.DayV
	}
	if p.MonthV != nil {
		month = *p.MonthV
	}
	if p.YearV != nil {
		year = *p.YearV
	}

	return &models.ClinicalVisitDetails{
		Type: "IPD",
		Patient: models.VisitPatientHeader{
			HN:        p.HN,
			CID:       p.CID,
			Name:      p.PtName,
			Age:       p.PtAge,
			DateText:  strings.TrimSpace(fmt.Sprintf("%s %s %s", day, month, year)),
			Diagnosis: p.TName,
		},
		Drugs: drugs,
		Labs:  labs,
		Xray:  xray,
	}, nil
}
