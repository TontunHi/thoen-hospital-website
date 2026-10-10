package models

type RawAppointment struct {
	HN          string  `db:"hn"`
	PtName      string  `db:"ptname"`
	AppointDate any     `db:"appoint_date"`
	AppointTime string  `db:"appoint_time"`
	ClinicName  *string `db:"clinic_name"`
	DoctorName  *string `db:"doctor_name"`
	AppointNote *string `db:"appoint_note"`
	AppNo       *string `db:"app_no"`
}

type AppointmentItem struct {
	HN          string `json:"hn"`
	PtName      string `json:"ptname"`
	AppointDate string `json:"appoint_date"`
	AppointTime string `json:"appoint_time"`
	ClinicName  string `json:"clinic_name"`
	DoctorName  string `json:"doctor_name"`
	AppointNote string `json:"appoint_note"`
}

type AppointmentResponse struct {
	Success      bool              `json:"success"`
	Appointments []AppointmentItem `json:"appointments"`
}
