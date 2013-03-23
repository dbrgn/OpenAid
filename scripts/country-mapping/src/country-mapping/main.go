package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
)

func lookup(country string) (string, string, string) {
	if len(country) == 0 {
		return "", "", ""
	}

	var input struct {
		Query string `json:"query"`
		Limit int    `json:"limit"`
	}
	input.Query = "[ a.countryCode, a.lat, a.lon | " +
		"a <- geonames, " +
		"a.featureClass == \"A\" && a.featureCode == \"PCLI\" && " +
		"a.altnames =~ \"" + country + "\" ]"
	input.Limit = 2

	msg, err := json.Marshal(input)
	if err != nil {
		log.Fatal(err)
	}
	r := strings.NewReader(string(msg))
	resp, err := http.Post("https://data.mingle.io", "", r)
	if err != nil {
		log.Fatal(err)
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	var output struct {
		Body [][]interface{} `json:"Body"`
	}
	err = json.Unmarshal(data, &output)
	if err != nil {
		log.Fatal(err)
	}

	if len(output.Body) != 0 {
		x := output.Body[0]
		code := x[0].(string)
		lat := x[1].(float64)
		lon := x[2].(float64)
		return code, strconv.FormatFloat(lat, 'f', 10, 64), strconv.FormatFloat(lon, 'f', 10, 64)
	}

	return "", "", ""
}

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	var name = flag.String("name", "", "\tattribute name")
	var in = flag.String("in", "", "\tinput file name")
	var out = flag.String("out", "", "\toutput file name")
	flag.Parse()

	inFile, err := os.Open(*in)
	if err != nil {
		log.Fatal(err)
	}
	defer inFile.Close()

	idx := -1
	inBuf := bufio.NewReader(inFile)
	output := ""
	for no := 0; ; no++ {
		log.Printf("line %v", no)

		row, _ := inBuf.ReadString('\n')
		if len(row) == 0 {
			break
		}

		tab, prefix := "", ""
		for i, attr := range strings.Split(row, "\t") {
			if no == 0 {
				if attr == *name {
					idx = i
				}
				prefix = "country_code\tlat\tlon\t"
			} else {
				if i == idx {
					tab = "\t"
					code, lat, lon := lookup(attr)
					if len(code) == 0 {
						log.Printf("failed to lookup '%v'", attr)
					}
					prefix = code + tab + lat + tab + lon + tab
				}
			}

		}

		row = prefix + row
		output += row
	}

	ioutil.WriteFile(*out, []byte(output), 0666)
}
