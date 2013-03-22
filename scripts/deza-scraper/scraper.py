# -*- coding: utf-8 -*-
from __future__ import print_function, division, absolute_import, unicode_literals

import re
import json

import requests
import grequests
from bs4 import BeautifulSoup


BASE_URL = 'http://www.deza.admin.ch'
COUNTRIES_URL = 'http://www.deza.admin.ch/en/Home/Countries'

print('Starting...')

# Fetch website
r = requests.get(COUNTRIES_URL)

# Parse HTML
soup = BeautifulSoup(r.text)
table = soup.find(id='spalteContentPlus').find_all('table')[1]
links = table.find_all('a', href=re.compile('\/Home\/Countries\/.+'))
urls = [BASE_URL + link['href'] for link in links]

# Fetch all country pages
print('Fetching country page URLs...')
rs = (grequests.get(u) for u in urls)
pages = grequests.map(rs)

# Parse the pages
data = {}
for page in pages:
    soup = BeautifulSoup(page.text)
    country = soup.find(id='breadcrumb').find_all('a')[-1].text.replace('\n', ' ')
    data[country] = {'2010': {}, '2011': {}}
    print('Parsing country %s...' % country)
    stats = soup.find('table', 'statdb')
    section = 'other'
    for tr in stats.find_all('tr'):
        td = tr.find('td', re.compile('statdb\d\d'))
        if not td:
            continue
        columns = tr.find_all('td')
        cls = td['class'][0]
        if cls == 'statdb11' and columns[1].text == '':
            section = td.text
            data[country]['2010'][section] = {}
            data[country]['2011'][section] = {}
        elif cls == 'statdb31':
            data[country]['2010'][section][columns[0].text] = columns[1].text
            data[country]['2011'][section][columns[0].text] = columns[2].text

with open('data.json', 'w') as jsonfile:
    jsonfile.write(json.dumps(data, indent=2))
