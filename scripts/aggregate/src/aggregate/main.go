package main

import (
	"encoding/csv"
	"flag"
	"log"
	"os"
	"strconv"
	"strings"
)

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	var key = flag.String("key", "", "\tname of the group key attribute")
	var value = flag.String("value", "", "\tname of the value atrribute")
	flag.Parse()

	r := csv.NewReader(os.Stdin)
	data, err := r.ReadAll()
	if err != nil {
		log.Fatal(err)
	}

	w := os.Stdout
	res := make(map[string]float64, 0)
	keyIdx, valueIdx := -1, -1
	for line, rec := range data {
		for i, attr := range rec {
			attr = strings.Trim(attr, " \r\n")
			if line == 0 {
				if attr == *key {
					keyIdx = i
				} else if attr == *value {
					valueIdx = i
				}
			}
		}
		if line == 0 {
			w.WriteString(strconv.Quote("Name") + "," + strconv.Quote("Ct. Value") + "\n")
		}
		if keyIdx < 0 || valueIdx < 0 {
			log.Printf("atrributes not found")
			return
		}
		k := strings.Trim(rec[keyIdx], " \r\n")
		v := strings.Trim(rec[valueIdx], " \r\n")
		f, _ := strconv.ParseFloat(v, 64)
		res[k] = res[k] + f
	}
	for k, v := range res {
		k = strconv.Quote(k)
		vs := strconv.FormatFloat(v, 'f', 5, 64)
		w.WriteString(k + "," + vs + "\n")
	}
}
