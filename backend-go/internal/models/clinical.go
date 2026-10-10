package models

// ── Patient Visit Search & Details ──

type PatientVisitItem struct {
	HN            string `db:"hn" json:"hn"`
	CID           string `db:"cid" json:"cid"`
	PtName        string `db:"ptname" json:"ptname"`
	VN            string `db:"vn" json:"vn"`
	AN            *string `db:"an" json:"an"`
	DateText      string `json:"dateText"`
	Department    string `db:"department" json:"department"`
	CC            string `db:"cc" json:"cc"`
	StatusName    string `db:"status_name" json:"statusName"`
	OpdDrugsCount int    `json:"opdDrugsCount"`
	OpdLabsCount  int    `json:"opdLabsCount"`
	IpdDrugsCount int    `json:"ipdDrugsCount"`
	IpdLabsCount  int    `json:"ipdLabsCount"`

	DayV   *string `db:"dayv"`
	MonthV *string `db:"monthv"`
	YearV  *string `db:"yearv"`
	Co1    *int    `db:"co1"`
	Co2    *int    `db:"co2"`
	Clab   *int    `db:"clab"`
	Clab2  *int    `db:"clab2"`
}

type VisitScreeningInfo struct {
	Bps         any     `db:"bps" json:"bps"`
	Bpd         any     `db:"bpd" json:"bpd"`
	Bw          any     `db:"bw" json:"bw"`
	Height      any     `db:"height" json:"height"`
	Pulse       any     `db:"pulse" json:"pulse"`
	Temperature any     `db:"temperature" json:"temperature"`
	RR          any     `db:"rr" json:"rr"`
	CC          *string `db:"cc" json:"cc"`
	Hpi         *string `db:"hpi" json:"hpi"`
	Pe          *string `db:"pe" json:"pe"`
	Pmh         *string `db:"pmh" json:"pmh"`
	Department  *string `db:"department" json:"department"`
	DxMain      *string `db:"name" json:"dxMain"`
	DxSub0      *string `db:"dx0name" json:"dxSub0"`
	DxSub1      *string `db:"dx1name" json:"dxSub1"`
	DxSub2      *string `db:"dx2name" json:"dxSub2"`
}

type VisitDrugItem struct {
	DateText string  `json:"dateText,omitempty"`
	Name     string  `json:"name"`
	Strength *string `json:"strength,omitempty"`
	Qty      any     `json:"qty"`
	Units    *string `json:"units,omitempty"`
	Usage    string  `json:"usage"`
}

type VisitLabItem struct {
	DateText string  `json:"dateText,omitempty"`
	FormName *string `json:"formName,omitempty"`
	ItemName string  `json:"itemName"`
	Result   string  `json:"result"`
	RefValue *string `json:"refValue,omitempty"`
}

type VisitPatientHeader struct {
	HN        string  `json:"hn"`
	CID       string  `json:"cid"`
	Name      string  `json:"name"`
	Age       int     `json:"age"`
	DateText  string  `json:"dateText"`
	Diagnosis *string `json:"diagnosis,omitempty"`
}

type ClinicalVisitDetails struct {
	Type    string              `json:"type"`
	Patient VisitPatientHeader  `json:"patient"`
	Screen  *VisitScreeningInfo `json:"screen,omitempty"`
	Drugs   []VisitDrugItem     `json:"drugs"`
	Labs    []VisitLabItem      `json:"labs"`
	Xray    *string             `json:"xray"`
}

// ── IPD Ward Roster ──

type WardPatientRecord struct {
	HN        string `db:"hn" json:"hn"`
	PtName    string `db:"ptname" json:"ptname"`
	Age       int    `db:"age" json:"age"`
	RegDate   string `db:"regdate" json:"regdate"`
	AdmitDays int    `db:"admit_days" json:"admitDays"`
	BedNo     string `db:"bedno" json:"bedno"`
	Ward      string `db:"ward" json:"ward"`
	WardGroup string `json:"wardGroup"`
}

type WardSectionConfig struct {
	ID          string              `json:"id"`
	Title       string              `json:"title"`
	ShortTitle  string              `json:"shortTitle"`
	Floor       string              `json:"floor"`
	BadgeColor  string              `json:"badgeColor"`
	AccentColor string              `json:"accentColor"`
	Patients    []WardPatientRecord `json:"patients"`
}

type WardRosterResponse struct {
	TotalPatients int                 `json:"totalPatients"`
	UpdatedAt     string              `json:"updatedAt"`
	Sections      []WardSectionConfig `json:"sections"`
}

// ── Drug Dispense Status ──

type PaidDrugPatient struct {
	HN          string  `db:"hn" json:"hn"`
	PtName      string  `db:"ptname" json:"ptname"`
	ServiceTime *string `db:"service_time" json:"service_time"`
	TimeLast    *string `db:"timelast" json:"timelast"`
	Department  string  `db:"department" json:"department"`
}

type PrintedDrugPatient struct {
	HN          string  `db:"hn" json:"hn"`
	PtName      string  `db:"ptname" json:"ptname"`
	ServiceTime *string `db:"service_time" json:"service_time"`
	TimeLast    *string `db:"timelast" json:"timelast"`
}

type DrugStatusData struct {
	PaidPatients    []PaidDrugPatient    `json:"paidPatients"`
	PrintedPatients []PrintedDrugPatient `json:"printedPatients"`
	UpdatedAt       string               `json:"updatedAt"`
}

// ── Bed Occupancy ──

type SpecialtyBreakdown struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type IcnpClassification struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type DeliveryRoomDetail struct {
	Beds         int     `json:"beds"`
	Occupied     int     `json:"occupied"`
	Remaining    int     `json:"remaining"`
	UsagePercent float64 `json:"usagePercent"`
}

type WardExtra struct {
	OnVentilator *int                `json:"onVentilator,omitempty"`
	CiCount      *int                `json:"ciCount,omitempty"`
	VipPersons   *int                `json:"vipPersons,omitempty"`
	PreDelivery  *DeliveryRoomDetail `json:"preDelivery,omitempty"`
	PostDelivery *DeliveryRoomDetail `json:"postDelivery,omitempty"`
}

type WardOccupancy struct {
	ID                  string               `json:"id"`
	Name                string               `json:"name"`
	TotalBeds           int                  `json:"totalBeds"`
	OccupiedBeds        int                  `json:"occupiedBeds"`
	RemainingBeds       int                  `json:"remainingBeds"`
	UsagePercent        float64              `json:"usagePercent"`
	OccupancyRate       *float64             `json:"occupancyRate"`
	AdmitToday          int                  `json:"admitToday"`
	DischargeToday      int                  `json:"dischargeToday"`
	Specialties         []SpecialtyBreakdown `json:"specialties"`
	IcnpClassifications []IcnpClassification `json:"icnpClassifications"`
	UnclassifiedBeds    []string             `json:"unclassifiedBeds"`
	Extra               *WardExtra           `json:"extra,omitempty"`
}

type OccupancyFormula struct {
	TotalAdmDays int `json:"totalAdmDays"`
	DaysInMonth  int `json:"daysInMonth"`
}

type BedOccupancyData struct {
	OpdPatientCount     int              `json:"opdPatientCount"`
	TotalBeds           int              `json:"totalBeds"`
	TotalOccupied       int              `json:"totalOccupied"`
	TotalRemaining      int              `json:"totalRemaining"`
	TotalUsagePercent   float64          `json:"totalUsagePercent"`
	OccupancyRate       float64          `json:"occupancyRate"`
	OccupancyFormula    OccupancyFormula `json:"occupancyFormula"`
	TotalAdmitToday     int              `json:"totalAdmitToday"`
	TotalDischargeToday int              `json:"totalDischargeToday"`
	Wards               []WardOccupancy  `json:"wards"`
	UpdatedAt           string           `json:"updatedAt"`
}

// ── Appointment Mismatch ──

type AppointmentMismatchRecord struct {
	HN         string `db:"hn" json:"hn"`
	Department string `db:"department" json:"department"`
	VstDate    string `db:"vstdate" json:"vstdate"`
	NextDate   string `db:"nextdate" json:"nextdate"`
	AppUser    string `db:"app_user" json:"appUser"`
}

type AppointmentMismatchData struct {
	TotalMismatches int                         `json:"totalMismatches"`
	UpdatedAt       string                      `json:"updatedAt"`
	Mismatches      []AppointmentMismatchRecord `json:"mismatches"`
}

