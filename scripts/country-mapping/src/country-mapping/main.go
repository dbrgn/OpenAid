package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
)

func lookup(country string) string {
	query := "{\"query\":\"[ a.countryCode | a <- geonames, a.featureClass == \\\"A\\\" && a.featureCode == \\\"PCLI\\\" && a.altnames =~ \\\"" + country + "\\\" ]\", \"limit\": 1}"
	r := strings.NewReader(query)
	resp, err := http.Post("https://data.mingle.io", "", r)
	if err != nil {
		log.Fatal(err)
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	var output struct {
		Body [][]string
	}
	err = json.Unmarshal(data, &output)
	if err != nil {
		log.Fatal(err)
	}

	if len(output.Body) != 0 {
		return output.Body[0][0]
	}

	return ""
}

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	var in = flag.String("in", "", "\tinput file name")
	var out = flag.String("out", "", "\toutput file name")
	flag.Parse()

	inFile, err := os.Open(*in)
	if err != nil {
		log.Fatal(err)
	}
	defer inFile.Close()

	inBuf := bufio.NewReader(inFile)
	output := ""
	for no := 0; ; no++ {
		res := ""
		tab := ""

		str, _ := inBuf.ReadString('\n')
		if len(str) == 0 {
			break
		}

		log.Printf("line %v", no)
		if no == 0 {
			res = "country_code\tlat\tlon" + str
		} else {
			country := ""
			for idx, attr := range strings.Split(str, "\t") {
				if idx == 2 {
					country = attr
				}
				res += tab + attr
				tab = "\t"
			}

			code := lookup(country)
			if len(code) == 0 {
				log.Printf("failed to lookup '%v'", country)
			}
			res = code + tab + res
		}

		output += res
	}

	ioutil.WriteFile(*out, []byte(output), 0666)
}
