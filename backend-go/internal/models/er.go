package models

type ERPatient struct {
	HN                   string  `db:"hn" json:"hn"`
	VN                   string  `db:"vn" json:"vn"`
	PtName               string  `db:"ptname" json:"ptname"`
	Age                  int     `db:"age" json:"age"`
	BedNo                *string `db:"bedno" json:"bedno"`
	EnterTime            string  `db:"enter_time" json:"enter_time"`
	ERList               *string `db:"er_list" json:"er_list"`
	EREmergencyLevelName string  `db:"er_emergency_level_name" json:"er_emergency_level_name"`
	EREmergencyLevelID   any     `db:"er_emergency_level_id" json:"er_emergency_level_id"`
	Observe              *string `db:"observe" json:"observe"`
	DchTypeName          *string `db:"dch_type_name" json:"dch_type_name"`
	WardName             *string `db:"wardname" json:"wardname"`
	HosName              *string `db:"hosname" json:"hosname"`
}

type ERErrorPatient struct {
	VstDate    string  `db:"vstdate" json:"vstdate"`
	HN         string  `db:"hn" json:"hn"`
	VN         string  `db:"vn" json:"vn"`
	StatusName *string `db:"status_name" json:"status_name"`
	NName      *string `db:"nname" json:"nname"`
}

type ERSummary struct {
	TotalActive int `json:"totalActive"`
	Critical    int `json:"critical"`
	Emergency   int `json:"emergency"`
	Urgency     int `json:"urgency"`
	SemiUrgency int `json:"semiUrgency"`
	NonUrgency  int `json:"nonUrgency"`
}

type PtTypeStat struct {
	V    int    `db:"v" json:"v"`
	Name string `db:"name" json:"name"`
}

type EmergencyLevelStat struct {
	V                    int    `db:"v" json:"v"`
	EREmergencyLevelName string `db:"er_emergency_level_name" json:"er_emergency_level_name"`
}

type DischargeTypeStat struct {
	V    int    `db:"v" json:"v"`
	Name string `db:"name" json:"name"`
}

type ERStats struct {
	PtTypes         []PtTypeStat         `json:"ptTypes"`
	EmergencyLevels []EmergencyLevelStat `json:"emergencyLevels"`
	DischargeTypes  []DischargeTypeStat  `json:"dischargeTypes"`
}

type ERErrorStatusList struct {
	Total int              `json:"total"`
	List  []ERErrorPatient `json:"list"`
}

type ERStatusData struct {
	ActivePatients  []ERPatient       `json:"activePatients"`
	ErrorStatusList ERErrorStatusList `json:"errorStatusList"`
	Summary         ERSummary         `json:"summary"`
	Stats           ERStats           `json:"stats"`
}
