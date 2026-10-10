package models

type LabTrackerPendingItem struct {
	HN          string  `db:"hn" json:"hn"`
	PatientName string  `db:"ptname" json:"patientName"`
	FormName    *string `db:"form_name" json:"formName"`
	OrderTime   string  `db:"order_time" json:"orderTime"`
	ReceiveTime string  `db:"receive_time" json:"receiveTime"`
	DoctorName  string  `db:"name" json:"doctorName"`
}

type LabTrackerReportedItem struct {
	HN          string  `db:"hn" json:"hn"`
	PatientName string  `db:"ptname" json:"patientName"`
	ReportTime  string  `db:"report_time" json:"reportTime"`
	Ovstost     *string `db:"ovstost" json:"ovstost"`
	DoctorName  string  `db:"name" json:"doctorName"`
}

type LabTrackerReportResult struct {
	Success    bool                     `json:"success"`
	SenderName string                   `json:"senderName"`
	Pending    []LabTrackerPendingItem  `json:"pending"`
	Reported   []LabTrackerReportedItem `json:"reported"`
}

type LabTrackerDoctorItem struct {
	Code  string `db:"code" json:"code"`
	Name  string `db:"name" json:"name"`
	Count int    `db:"cc" json:"count"`
}

type LabTrackerDoctorsResult struct {
	Success    bool                   `json:"success"`
	Doctors    []LabTrackerDoctorItem `json:"doctors"`
	Others     []LabTrackerDoctorItem `json:"others"`
	TotalCount int                    `json:"totalCount"`
}

type LabTrackerDetailReported struct {
	FormName *string `db:"form_name" json:"formName"`
	ItemName string  `db:"lab_items_name" json:"itemName"`
	Result   string  `db:"lab_order_result" json:"result"`
	RefValue *string `db:"lab_items_normal_value" json:"refValue"`
}

type LabTrackerDetailPending struct {
	FormName *string `db:"form_name" json:"formName"`
	ItemName string  `db:"lab_items_name" json:"itemName"`
	IsOutLab string  `db:"items_is_outlab" json:"isOutLab"`
}

type LabTrackerDetailResult struct {
	Success     bool                       `json:"success"`
	HN          string                     `json:"hn"`
	PatientName string                     `json:"patientName"`
	Reported    []LabTrackerDetailReported `json:"reported"`
	Pending     []LabTrackerDetailPending  `json:"pending"`
}
