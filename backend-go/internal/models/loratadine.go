package models

type LoratadineItem struct {
	HN         string `db:"hn" json:"hn"`
	Fullname   string `db:"fullname" json:"fullname"`
	Age        int    `db:"age" json:"age"`
	Status     string `db:"status" json:"status"`
	Vstdate    string `db:"vstdate" json:"vstdate"`
	Rxdate     string `db:"rxdate" json:"rxdate"`
	Rxtime     string `db:"rxtime" json:"rxtime"`
	Qty        any    `db:"qty" json:"qty"`
	DoctorName string `db:"doctor_name" json:"doctor_name"`
	Department string `db:"department" json:"department"`
}

type LoratadineSummary struct {
	TotalCount int `json:"totalCount"`
	TotalQty   int `json:"totalQty"`
	OpdCount   int `json:"opdCount"`
	IpdCount   int `json:"ipdCount"`
	AdultCount int `json:"adultCount"`
}

type LoratadineResponse struct {
	Success bool              `json:"success"`
	Items   []LoratadineItem  `json:"items"`
	Summary LoratadineSummary `json:"summary"`
}
